/**
 * Модуль автообновлений для Animatrona
 *
 * Использует electron-updater для автоматического обновления приложения.
 * Поддерживает GitHub Releases как источник обновлений.
 *
 * Улучшенная версия: без блокирующих диалогов, с changelog из GitHub API
 */

import type { BrowserWindow } from 'electron'
import { app, net } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateDownloadedEvent, type UpdateInfo } from 'electron-updater'

import { createModuleLogger } from './utils/logger'

const log = createModuleLogger('Updater')

// Настройки автообновления
autoUpdater.autoDownload = false // Не скачивать автоматически
autoUpdater.autoInstallOnAppQuit = true // Установить при выходе

// Перенаправляем логгер electron-updater через наш логгер
autoUpdater.logger = {
  info: (message: string) => log.info(message),
  warn: (message: string) => log.warn(message),
  error: (message: string) => log.error(message),
  debug: (message: string) => log.debug(message),
}

/**
 * Статус обновления для UI
 */
export interface UpdateStatus {
  /** Текущий статус */
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  /** Информация о доступном обновлении */
  updateInfo: UpdateInfo | null
  /** Прогресс загрузки (0-100) */
  downloadProgress: number
  /** Сообщение об ошибке */
  error: string | null
  /** Скорость загрузки (bytes/s) */
  downloadSpeed: number
  /** Оставшееся время загрузки (секунды) */
  downloadEta: number
}

// Синглтон состояния обновлений
let updateStatus: UpdateStatus = {
  status: 'idle',
  updateInfo: null,
  downloadProgress: 0,
  error: null,
  downloadSpeed: 0,
  downloadEta: 0,
}

// Ссылка на главное окно для IPC
let mainWindowRef: BrowserWindow | null = null

// Кэш changelog для текущей версии
let changelogCache: { version: string; changelog: string } | null = null

/**
 * Форматирует ошибку electron-updater в понятное сообщение
 */
function formatUpdateError(error: Error): string {
  const msg = error.message || ''

  // 404 — latest.yml не найден (нет релизов на GitHub)
  if (msg.includes('Cannot find latest') || msg.includes('404')) {
    return 'Обновления пока недоступны'
  }

  // Нет интернета или DNS ошибка
  if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
    return 'Нет подключения к интернету'
  }

  // Таймаут
  if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
    return 'Превышено время ожидания'
  }

  // SSL ошибка
  if (msg.includes('certificate') || msg.includes('SSL')) {
    return 'Ошибка безопасного соединения'
  }

  // Ошибка записи файла
  if (msg.includes('EACCES') || msg.includes('EPERM')) {
    return 'Нет прав для записи файла обновления'
  }

  // Для остальных — первая строка без HTTP headers
  const firstLine = msg.split('\n')[0]
  return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine
}

/**
 * Получить текущий статус обновления
 */
export function getUpdateStatus(): UpdateStatus {
  return { ...updateStatus }
}

/**
 * Получить changelog из GitHub Releases
 */
export async function fetchChangelog(version: string): Promise<string | null> {
  // Проверяем кэш
  if (changelogCache && changelogCache.version === version) {
    return changelogCache.changelog
  }

  try {
    const url = `https://api.github.com/repos/kamiletar/animatrona/releases/tags/v${version}`
    const request = net.request({
      url,
      method: 'GET',
    })

    // Устанавливаем User-Agent (GitHub требует)
    request.setHeader('User-Agent', 'Animatrona-Update-Client')

    return await new Promise<string>((resolve, reject) => {
      let data = ''

      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }

        response.on('data', (chunk) => {
          data += chunk.toString()
        })

        response.on('end', () => {
          try {
            const release = JSON.parse(data)
            const changelog = release.body || 'Нет описания'
            // Кэшируем
            changelogCache = { version, changelog }
            resolve(changelog)
          } catch (error) {
            reject(error)
          }
        })

        response.on('error', (error) => {
          reject(error)
        })
      })

      request.on('error', (error) => {
        reject(error)
      })

      request.end()
    })
  } catch (error) {
    log.error('Failed to fetch changelog', { error })
    return null
  }
}

/**
 * Уведомить renderer о изменении статуса
 */
function notifyRenderer(): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('updater:status', updateStatus)
  }
}

/**
 * Инициализация автообновлений
 */
export function initAutoUpdater(mainWindow: BrowserWindow): void {
  // Сохраняем ссылку на окно
  mainWindowRef = mainWindow

  // В development режиме не проверяем обновления
  if (!app.isPackaged) {
    log.info('Skipping update check in development mode')
    return
  }

  // Обработчики событий
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...')
    updateStatus = { ...updateStatus, status: 'checking', error: null }
    mainWindow.webContents.send('updater:checking')
    notifyRenderer()
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info('Update available', { version: info.version })
    updateStatus = { ...updateStatus, status: 'available', updateInfo: info, error: null }
    mainWindow.webContents.send('updater:available', info)
    notifyRenderer()

    // Fetch changelog асинхронно и отправляем в renderer
    fetchChangelog(info.version)
      .then((changelog) => {
        if (changelog) {
          mainWindow.webContents.send('updater:changelog', { version: info.version, changelog })
        }
      })
      .catch((error) => {
        log.error('Failed to load changelog', { error })
      })
  })

  autoUpdater.on('update-not-available', () => {
    log.info('No updates available')
    updateStatus = { ...updateStatus, status: 'not-available', error: null }
    mainWindow.webContents.send('updater:not-available')
    notifyRenderer()
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    log.info('Download progress', { percent: progress.percent.toFixed(1) })
    updateStatus = {
      ...updateStatus,
      status: 'downloading',
      downloadProgress: progress.percent,
      downloadSpeed: progress.bytesPerSecond,
      downloadEta: progress.bytesPerSecond > 0 ? (progress.total - progress.transferred) / progress.bytesPerSecond : 0,
      error: null,
    }
    mainWindow.webContents.send('updater:progress', progress)
    notifyRenderer()
  })

  autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
    log.info('Update downloaded', { version: info.version })
    updateStatus = {
      ...updateStatus,
      status: 'downloaded',
      downloadProgress: 100,
      updateInfo: info,
      error: null,
    }
    mainWindow.webContents.send('updater:downloaded', info)
    notifyRenderer()

    // НЕ показываем блокирующий диалог - renderer покажет toast уведомление
    // Пользователь сам решит когда устанавливать через UI
  })

  autoUpdater.on('error', (error) => {
    const friendlyMessage = formatUpdateError(error)
    log.error('Update error', { message: friendlyMessage })
    updateStatus = { ...updateStatus, status: 'error', error: friendlyMessage }
    mainWindow.webContents.send('updater:error', friendlyMessage)
    notifyRenderer()
  })

  // НЕ проверяем обновления автоматически!
  // Renderer сам вызовет checkForUpdates() если autoCheck включён в настройках
  // См. use-update-notifications.ts
}

/**
 * Проверить наличие обновлений
 */
export async function checkForUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates()
  } catch {
    // Ошибка проверки обновлений — игнорируем
  }
}

/**
 * Скачать обновление
 */
export async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate()
  } catch {
    // Ошибка скачивания — игнорируем
  }
}

/**
 * Установить скачанное обновление и перезапустить
 */
export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true)
}

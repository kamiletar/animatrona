/**
 * Модуль автообновлений для Animatrona
 *
 * Использует electron-updater для автоматического обновления приложения.
 * Поддерживает GitHub Releases как источник обновлений.
 *
 * Улучшенная версия: без блокирующих диалогов, с changelog из GitHub API
 */

import type { BrowserWindow } from 'electron'
import { app } from 'electron'
import { net } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateDownloadedEvent, type UpdateInfo } from 'electron-updater'

// Настройки автообновления
autoUpdater.autoDownload = false // Не скачивать автоматически
autoUpdater.autoInstallOnAppQuit = true // Установить при выходе

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
    console.error('[Updater] Ошибка получения changelog:', error)
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
    console.warn('[Updater] Пропуск проверки обновлений в development режиме')
    return
  }

  // Обработчики событий
  autoUpdater.on('checking-for-update', () => {
    console.warn('[Updater] Проверка наличия обновлений...')
    updateStatus = { ...updateStatus, status: 'checking', error: null }
    mainWindow.webContents.send('updater:checking')
    notifyRenderer()
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.warn(`[Updater] Доступно обновление: v${info.version}`)
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
        console.error('[Updater] Не удалось загрузить changelog:', error)
      })
  })

  autoUpdater.on('update-not-available', () => {
    console.warn('[Updater] Обновлений нет')
    updateStatus = { ...updateStatus, status: 'not-available', error: null }
    mainWindow.webContents.send('updater:not-available')
    notifyRenderer()
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    console.warn(`[Updater] Прогресс загрузки: ${progress.percent.toFixed(1)}%`)
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
    console.warn(`[Updater] Обновление загружено: v${info.version}`)
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
    console.error('[Updater] Ошибка:', error.message)
    updateStatus = { ...updateStatus, status: 'error', error: error.message }
    mainWindow.webContents.send('updater:error', error.message)
    notifyRenderer()
  })

  // Проверяем обновления при запуске (с задержкой)
  setTimeout(() => {
    checkForUpdates()
  }, 5000)
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

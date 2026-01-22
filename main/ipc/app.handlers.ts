/* eslint-disable no-console */
/**
 * IPC handlers для информации о приложении
 */

import { app, ipcMain, Notification, powerSaveBlocker } from 'electron'
import * as fs from 'fs'
import * as os from 'os'

/** Параметры системного уведомления */
export interface NotificationOptions {
  title: string
  body: string
  /** Тип уведомления (влияет на иконку/звук) */
  type?: 'info' | 'success' | 'error'
}

/** Состояние блокировки сна */
interface PowerSaveState {
  /** ID блокировщика (null если не активен) */
  blockerId: number | null
  /** Авто-блокировка включена (при транскодировании) */
  autoEnabled: boolean
  /** Ручная блокировка включена */
  manualEnabled: boolean
  /** Идёт транскодирование */
  isTranscoding: boolean
  /** Идёт воспроизведение видео */
  isPlaybackActive: boolean
}

/** Глобальное состояние блокировки сна */
const powerSaveState: PowerSaveState = {
  blockerId: null,
  autoEnabled: true, // По умолчанию авто-блокировка включена
  manualEnabled: false,
  isTranscoding: false,
  isPlaybackActive: false,
}

/** Информация о диске */
export interface DiskInfo {
  total: number // Общий размер в байтах
  free: number // Свободно в байтах
  used: number // Использовано в байтах
  usedPercent: number // Процент использования (0-100)
}

/** Кеш размера библиотеки */
interface LibrarySizeCache {
  /** Путь к библиотеке */
  path: string | null
  /** Размер в байтах */
  size: number
  /** Timestamp последнего обновления */
  updatedAt: number
  /** Идёт ли расчёт */
  isCalculating: boolean
}

/** TTL кеша размера библиотеки (5 минут) */
const LIBRARY_SIZE_CACHE_TTL = 5 * 60 * 1000

/** Кеш размера библиотеки */
const librarySizeCache: LibrarySizeCache = {
  path: null,
  size: 0,
  updatedAt: 0,
  isCalculating: false,
}

/**
 * Получает информацию о диске для указанного пути
 * Использует Node.js fs.statfs (доступен с Node.js 18.15+)
 */
async function getDiskInfo(targetPath: string): Promise<DiskInfo | null> {
  try {
    const stats = await fs.promises.statfs(targetPath)

    // statfs возвращает размеры в блоках
    const blockSize = stats.bsize
    const total = stats.blocks * blockSize
    const free = stats.bfree * blockSize // bfree — свободные блоки
    const used = total - free
    const usedPercent = total > 0 ? Math.round((used / total) * 100) : 0

    return { total, free, used, usedPercent }
  } catch (error) {
    console.error('[App] Error getting disk info:', error)
    return null
  }
}

/**
 * Рекурсивно подсчитывает размер папки
 */
async function getFolderSize(folderPath: string): Promise<number> {
  let totalSize = 0

  try {
    const entries = await fs.promises.readdir(folderPath, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = `${folderPath}/${entry.name}`

      if (entry.isDirectory()) {
        totalSize += await getFolderSize(entryPath)
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(entryPath)
          totalSize += stat.size
        } catch {
          // Игнорируем ошибки доступа к отдельным файлам
        }
      }
    }
  } catch {
    // Папка не существует или нет доступа
  }

  return totalSize
}

/**
 * Обновляет состояние блокировки сна
 * Блокирует если: ручная блокировка ИЛИ (авто включена И (транскодирование ИЛИ воспроизведение))
 */
function updatePowerSaveBlocker(): void {
  const shouldBlock =
    powerSaveState.manualEnabled ||
    (powerSaveState.autoEnabled && (powerSaveState.isTranscoding || powerSaveState.isPlaybackActive))

  if (shouldBlock && powerSaveState.blockerId === null) {
    // Включаем блокировку
    powerSaveState.blockerId = powerSaveBlocker.start('prevent-display-sleep')
    console.log('[PowerSave] Блокировка сна ВКЛЮЧЕНА (id:', powerSaveState.blockerId, ')')
  } else if (!shouldBlock && powerSaveState.blockerId !== null) {
    // Выключаем блокировку
    powerSaveBlocker.stop(powerSaveState.blockerId)
    console.log('[PowerSave] Блокировка сна ВЫКЛЮЧЕНА')
    powerSaveState.blockerId = null
  }
}

/** Экспорт для использования из других модулей (ImportQueueController) */
export function setPowerSaveTranscoding(isTranscoding: boolean): void {
  powerSaveState.isTranscoding = isTranscoding
  updatePowerSaveBlocker()
}

/**
 * Инвалидирует кеш размера библиотеки
 * Вызывать после импорта аниме
 */
export function invalidateLibrarySizeCache(): void {
  librarySizeCache.updatedAt = 0
  console.log('[App] Library size cache invalidated')
}

/**
 * Регистрирует IPC handlers для информации о приложении
 */
export function registerAppHandlers(): void {
  // Версия приложения
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  // Системные пути
  ipcMain.handle('app:getPath', (_event, name: string) => {
    return app.getPath(name as Parameters<typeof app.getPath>[0])
  })

  // Количество ядер CPU (для параллельного кодирования)
  ipcMain.handle('app:getCpuCount', () => {
    return os.cpus().length
  })

  // Информация о диске (для пути к библиотеке)
  ipcMain.handle('app:getDiskInfo', async (_event, targetPath?: string): Promise<DiskInfo | null> => {
    // Если путь не указан, используем путь к данным приложения
    const pathToCheck = targetPath || app.getPath('userData')
    return getDiskInfo(pathToCheck)
  })

  // Размер папки библиотеки (с кешированием)
  ipcMain.handle('app:getLibrarySize', async (_event, libraryPath: string, forceRefresh?: boolean): Promise<number> => {
    const now = Date.now()
    const isCacheValid =
      librarySizeCache.path === libraryPath &&
      librarySizeCache.updatedAt > 0 &&
      (now - librarySizeCache.updatedAt) < LIBRARY_SIZE_CACHE_TTL

    // Возвращаем кеш если валиден и не требуется принудительное обновление
    if (isCacheValid && !forceRefresh) {
      return librarySizeCache.size
    }

    // Если уже идёт расчёт — возвращаем старое значение
    if (librarySizeCache.isCalculating) {
      return librarySizeCache.size
    }

    // Запускаем расчёт
    librarySizeCache.isCalculating = true
    try {
      const size = await getFolderSize(libraryPath)
      librarySizeCache.path = libraryPath
      librarySizeCache.size = size
      librarySizeCache.updatedAt = Date.now()
      console.log('[App] Library size calculated:', (size / 1024 / 1024 / 1024).toFixed(2), 'GB')
      return size
    } finally {
      librarySizeCache.isCalculating = false
    }
  })

  // Инвалидация кеша размера библиотеки (вызывается после импорта)
  ipcMain.handle('app:invalidateLibrarySizeCache', () => {
    invalidateLibrarySizeCache()
    return true
  })

  // Системное уведомление
  ipcMain.handle('app:showNotification', (_event, options: NotificationOptions): boolean => {
    // Проверяем поддержку уведомлений
    if (!Notification.isSupported()) {
      console.warn('[App] Notifications not supported on this platform')
      return false
    }

    try {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        silent: false,
      })

      notification.show()
      return true
    } catch (error) {
      console.error('[App] Error showing notification:', error)
      return false
    }
  })

  // === Блокировка спящего режима ===

  // Получить текущее состояние
  ipcMain.handle('app:getPowerSaveState', () => {
    return {
      isBlocking: powerSaveState.blockerId !== null,
      autoEnabled: powerSaveState.autoEnabled,
      manualEnabled: powerSaveState.manualEnabled,
    }
  })

  // Переключить ручную блокировку
  ipcMain.handle('app:togglePowerSaveManual', () => {
    powerSaveState.manualEnabled = !powerSaveState.manualEnabled
    updatePowerSaveBlocker()
    return {
      isBlocking: powerSaveState.blockerId !== null,
      manualEnabled: powerSaveState.manualEnabled,
    }
  })

  // Установить авто-блокировку
  ipcMain.handle('app:setPowerSaveAuto', (_event, enabled: boolean) => {
    powerSaveState.autoEnabled = enabled
    updatePowerSaveBlocker()
    return { autoEnabled: powerSaveState.autoEnabled }
  })

  // Установить состояние воспроизведения (для плеера)
  ipcMain.handle('app:setPowerSavePlayback', (_event, isPlaying: boolean) => {
    powerSaveState.isPlaybackActive = isPlaying
    updatePowerSaveBlocker()
    return { isBlocking: powerSaveState.blockerId !== null }
  })
}

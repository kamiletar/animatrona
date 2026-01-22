/**
 * IPC handlers для управления очередью транскодирования
 *
 * Каналы:
 * - transcode:addToQueue — добавить файл в очередь
 * - transcode:removeFromQueue — удалить из очереди
 * - transcode:start — начать обработку очереди
 * - transcode:pauseItem — приостановить элемент
 * - transcode:resumeItem — возобновить элемент
 * - transcode:cancelItem — отменить элемент
 * - transcode:reorderQueue — изменить порядок
 * - transcode:updateSettings — обновить настройки элемента
 * - transcode:getQueue — получить текущую очередь
 * - transcode:getPauseCapabilities — проверить возможность паузы
 *
 * События (отправляются в renderer):
 * - transcode:progress — прогресс элемента
 * - transcode:statusChange — изменение статуса
 * - transcode:queueChange — изменение очереди
 */

import { ipcMain } from 'electron'
import type {
  DemuxResult,
  PerFileTranscodeSettings,
  QueueItem,
  QueueItemStatus,
  TranscodeProgressExtended,
} from '../../shared/types'
import { transcodeManager } from '../services/transcode-manager'
import { broadcastToWindows } from '../src/utils/broadcast'

// === THROTTLED PROGRESS BROADCAST ===

/** Интервал throttling для progress событий (мс) */
const PROGRESS_THROTTLE_MS = 100

/** Буфер для накопления progress событий */
const progressBuffer = new Map<string, TranscodeProgressExtended>()

/** Таймер для отправки буфера */
let progressFlushTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Добавляет progress в буфер и отправляет с throttling
 * Последнее значение для каждого id всегда отправляется
 */
function throttledProgressBroadcast(id: string, progress: TranscodeProgressExtended): void {
  // Сохраняем последнее значение (перезаписывает предыдущее)
  progressBuffer.set(id, progress)

  // Если таймер уже запущен — ждём его
  if (progressFlushTimer) {
    return
  }

  // Запускаем таймер для отправки буфера
  progressFlushTimer = setTimeout(() => {
    // Отправляем все накопленные progress события
    for (const [bufferedId, bufferedProgress] of progressBuffer) {
      broadcastToWindows('transcode:progress', bufferedId, bufferedProgress)
    }
    // Очищаем буфер
    progressBuffer.clear()
    progressFlushTimer = null
  }, PROGRESS_THROTTLE_MS)
}

/**
 * Регистрирует IPC handlers для очереди транскодирования
 */
export function registerTranscodeQueueHandlers(): void {
  // Подписываемся на события менеджера и транслируем их в renderer
  // Progress события throttled для снижения нагрузки на IPC
  transcodeManager.on('progress', (id: string, progress: TranscodeProgressExtended) => {
    throttledProgressBroadcast(id, progress)
  })

  transcodeManager.on('statusChange', (id: string, status: QueueItemStatus, error?: string) => {
    broadcastToWindows('transcode:statusChange', id, status, error)
  })

  transcodeManager.on('queueChange', (queue: QueueItem[]) => {
    broadcastToWindows('transcode:queueChange', queue)
  })

  transcodeManager.on('processingStarted', () => {
    broadcastToWindows('transcode:processingStarted')
  })

  transcodeManager.on('processingCompleted', () => {
    broadcastToWindows('transcode:processingCompleted')
  })

  // === Handlers ===

  // Добавить файл в очередь
  ipcMain.handle('transcode:addToQueue', async (_event, filePath: string, settings?: PerFileTranscodeSettings) => {
    try {
      const id = transcodeManager.addToQueue(filePath, settings)
      return { success: true, id }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Удалить из очереди
  ipcMain.handle('transcode:removeFromQueue', async (_event, id: string) => {
    try {
      const success = transcodeManager.removeFromQueue(id)
      return { success }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Начать обработку очереди
  ipcMain.handle('transcode:start', async () => {
    try {
      // Не await — запускаем асинхронно
      transcodeManager.startProcessing()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Приостановить элемент
  ipcMain.handle('transcode:pauseItem', async (_event, id: string) => {
    try {
      const success = transcodeManager.pauseItem(id)
      return { success }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Возобновить элемент
  ipcMain.handle('transcode:resumeItem', async (_event, id: string) => {
    try {
      const success = transcodeManager.resumeItem(id)
      return { success }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Отменить элемент
  ipcMain.handle('transcode:cancelItem', async (_event, id: string) => {
    try {
      const success = transcodeManager.cancelItem(id)
      return { success }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Изменить порядок очереди
  ipcMain.handle('transcode:reorderQueue', async (_event, orderedIds: string[]) => {
    try {
      transcodeManager.reorderQueue(orderedIds)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Обновить настройки элемента
  ipcMain.handle('transcode:updateSettings', async (_event, id: string, settings: PerFileTranscodeSettings) => {
    try {
      const success = transcodeManager.updateSettings(id, settings)
      return { success }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Получить текущую очередь
  ipcMain.handle('transcode:getQueue', async () => {
    try {
      const queue = transcodeManager.getQueue()
      return { success: true, queue }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        queue: [],
      }
    }
  })

  // Получить элемент по ID
  ipcMain.handle('transcode:getItem', async (_event, id: string) => {
    try {
      const item = transcodeManager.getItem(id)
      return { success: true, item }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Анализировать элемент
  ipcMain.handle('transcode:analyzeItem', async (_event, id: string, demuxResult: DemuxResult) => {
    try {
      await transcodeManager.analyzeItem(id, demuxResult)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Проверить возможность паузы
  ipcMain.handle('transcode:getPauseCapabilities', async () => {
    try {
      const capabilities = transcodeManager.getPauseCapabilities()
      return { success: true, ...capabilities }
    } catch (error) {
      return {
        success: false,
        available: false,
        method: 'none' as const,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Приостановить всю обработку
  ipcMain.handle('transcode:pauseAll', async () => {
    try {
      transcodeManager.pauseAll()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Возобновить всю обработку
  ipcMain.handle('transcode:resumeAll', async () => {
    try {
      transcodeManager.resumeAll()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Установить путь к библиотеке
  ipcMain.handle('transcode:setLibraryPath', async (_event, libraryPath: string) => {
    try {
      transcodeManager.setDefaultLibraryPath(libraryPath)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })
}

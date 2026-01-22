/* eslint-disable no-console */
/**
 * IPC handlers для Import Queue — Event-driven архитектура
 *
 * Команды (renderer → main):
 * - import-queue:add-items — добавить items в очередь
 * - import-queue:start — начать обработку
 * - import-queue:pause — приостановить очередь
 * - import-queue:resume — возобновить очередь
 * - import-queue:cancel-item — отменить item
 * - import-queue:remove-item — удалить item из очереди
 * - import-queue:get-state — получить текущее состояние
 * - import-queue:get-item — получить item по ID
 * - import-queue:clear-completed — очистить завершённые
 * - import-queue:set-auto-start — установить автозапуск
 *
 * Обновления (renderer → main, вызываются из ImportProcessor):
 * - import-queue:update-status — обновить статус item
 * - import-queue:update-progress — обновить прогресс item
 * - import-queue:update-vmaf-progress — обновить VMAF прогресс
 * - import-queue:set-vmaf-result — установить результат VMAF
 * - import-queue:set-import-result — установить результат импорта (animeId)
 *
 * События (main → renderer через BrowserWindow.webContents.send):
 * - import-queue:state-changed — полное состояние изменилось
 * - import-queue:item-status — статус item изменился
 * - import-queue:item-progress — прогресс item изменился
 *
 * @see ImportQueueController — единственный источник правды
 */

import { ipcMain } from 'electron'
import type {
  ImportQueueAddData,
  ImportQueueDetailProgress,
  ImportQueueStatus,
  ImportQueueVmafProgress,
  ImportQueueVmafResult,
} from '../../shared/types/import-queue'
import { ImportQueueController } from '../services/import-queue-controller'

/**
 * Регистрирует IPC handlers для очереди импорта
 */
export function registerImportQueueHandlers(): void {
  const controller = ImportQueueController.getInstance()

  // ==========================================
  // === Команды от renderer ===
  // ==========================================

  /**
   * Добавить items в очередь
   */
  ipcMain.handle('import-queue:add-items', async (_event, items: ImportQueueAddData[]) => {
    try {
      controller.addItems(items)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Начать обработку очереди
   */
  ipcMain.handle('import-queue:start', async () => {
    try {
      controller.startQueue()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Приостановить очередь
   */
  ipcMain.handle('import-queue:pause', async () => {
    try {
      controller.pauseQueue()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Возобновить очередь
   */
  ipcMain.handle('import-queue:resume', async () => {
    try {
      controller.resumeQueue()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Отменить item
   */
  ipcMain.handle('import-queue:cancel-item', async (_event, itemId: string) => {
    try {
      controller.cancelItem(itemId)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Удалить item из очереди
   */
  ipcMain.handle('import-queue:remove-item', async (_event, itemId: string) => {
    try {
      controller.removeItem(itemId)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Повторить обработку item с ошибкой
   */
  ipcMain.handle('import-queue:retry-item', async (_event, itemId: string) => {
    try {
      controller.retryItem(itemId)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Отменить всю очередь
   */
  ipcMain.handle('import-queue:cancel-all', async () => {
    try {
      controller.cancelAll()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Получить текущее состояние очереди
   * Вызывается при mount компонента для восстановления состояния
   */
  ipcMain.handle('import-queue:get-state', async () => {
    try {
      const state = controller.getState()
      return { success: true, data: state }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Получить item по ID
   */
  ipcMain.handle('import-queue:get-item', async (_event, itemId: string) => {
    try {
      const item = controller.getItem(itemId)
      return { success: true, data: item }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Очистить завершённые items
   */
  ipcMain.handle('import-queue:clear-completed', async () => {
    try {
      controller.clearCompleted()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Установить автозапуск
   */
  ipcMain.handle('import-queue:set-auto-start', async (_event, enabled: boolean) => {
    try {
      controller.setAutoStart(enabled)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Изменить порядок элементов в очереди (drag & drop)
   */
  ipcMain.handle('import-queue:reorder-items', async (_event, activeId: string, overId: string) => {
    try {
      controller.reorderItems(activeId, overId)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Обновить данные item (профиль, параллельность, sync offset и т.д.)
   * Только для pending items
   */
  ipcMain.handle(
    'import-queue:update-item',
    async (_event, itemId: string, data: Partial<ImportQueueAddData>) => {
      try {
        controller.updateItem(itemId, data)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // ==========================================
  // === Обновления от renderer (ImportProcessor) ===
  // ==========================================

  /**
   * Обновить статус item
   * Вызывается из ImportProcessor при изменении статуса
   */
  ipcMain.handle(
    'import-queue:update-status',
    async (_event, itemId: string, status: ImportQueueStatus, error?: string) => {
      try {
        controller.updateItemStatus(itemId, status, error)
        return { success: true }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }
  )

  /**
   * Обновить прогресс item
   * Вызывается из ImportProcessor при изменении прогресса
   */
  ipcMain.handle(
    'import-queue:update-progress',
    async (
      _event,
      itemId: string,
      progress: number,
      currentFileName?: string,
      currentStage?: string,
      detailProgress?: ImportQueueDetailProgress
    ) => {
      try {
        controller.updateItemProgress(itemId, progress, currentFileName, currentStage, detailProgress)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  /**
   * Обновить VMAF прогресс
   */
  ipcMain.handle(
    'import-queue:update-vmaf-progress',
    async (_event, itemId: string, vmafProgress: ImportQueueVmafProgress) => {
      try {
        controller.updateVmafProgress(itemId, vmafProgress)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  /**
   * Установить результат VMAF
   */
  ipcMain.handle(
    'import-queue:set-vmaf-result',
    async (_event, itemId: string, result: ImportQueueVmafResult) => {
      try {
        controller.setVmafResult(itemId, result)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  /**
   * Установить результат импорта (animeId)
   */
  ipcMain.handle('import-queue:set-import-result', async (_event, itemId: string, animeId: string) => {
    try {
      controller.setImportResult(itemId, animeId)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  console.log('[ImportQueueHandlers] Registered')
}

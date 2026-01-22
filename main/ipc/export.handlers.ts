/**
 * IPC handlers для экспорта сериала в MKV
 */

import { ipcMain } from 'electron'
import { exportManager, type ExportConfig } from '../services/export-manager'
import { broadcastToWindows } from '../src/utils/broadcast'

/**
 * Регистрация IPC handlers для экспорта
 */
export function registerExportHandlers(): void {
  /**
   * Запустить экспорт сериала
   */
  ipcMain.handle('export:start', async (_event, config: ExportConfig) => {
    return exportManager.startExport(config)
  })

  /**
   * Отменить текущий экспорт
   */
  ipcMain.handle('export:cancel', async () => {
    exportManager.cancel()
    return { success: true }
  })

  /**
   * Получить текущий прогресс экспорта
   */
  ipcMain.handle('export:getProgress', async () => {
    return exportManager.getProgress()
  })

  /**
   * Проверить, активен ли экспорт
   */
  ipcMain.handle('export:isActive', async () => {
    return exportManager.isActive()
  })

  // Подписываемся на события ExportManager
  exportManager.on('progress', (progress) => {
    broadcastToWindows('export:progress', progress)
  })

  exportManager.on('completed', (result) => {
    broadcastToWindows('export:completed', result)
  })

  exportManager.on('error', (error) => {
    broadcastToWindows('export:error', error)
  })
}

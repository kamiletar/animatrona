/**
 * IPC handlers для автообновлений
 */

import { app, ipcMain } from 'electron'
import { checkForUpdates, downloadUpdate, fetchChangelog, getUpdateStatus, installUpdate } from '../updater'

/**
 * Регистрирует IPC handlers для управления обновлениями
 */
export function registerUpdaterHandlers(): void {
  // Получить текущий статус обновлений
  ipcMain.handle('updater:status', () => {
    return getUpdateStatus()
  })

  // Получить версию приложения
  ipcMain.handle('updater:version', () => {
    return app.getVersion()
  })

  // Проверить наличие обновлений
  ipcMain.handle('updater:check', async () => {
    try {
      await checkForUpdates()
      return { success: true }
    } catch (error) {
      console.error('[IPC] updater:check error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Скачать обновление
  ipcMain.handle('updater:download', async () => {
    try {
      await downloadUpdate()
      return { success: true }
    } catch (error) {
      console.error('[IPC] updater:download error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Установить обновление и перезапустить
  ipcMain.handle('updater:install', () => {
    try {
      installUpdate()
      return { success: true }
    } catch (error) {
      console.error('[IPC] updater:install error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Получить changelog из GitHub Releases
  ipcMain.handle('updater:getChangelog', async (_, version: string) => {
    try {
      const changelog = await fetchChangelog(version)
      return { success: true, changelog }
    } catch (error) {
      console.error('[IPC] updater:getChangelog error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })
}

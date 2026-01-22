/**
 * IPC handlers для настроек системного трея
 *
 * Синхронизирует настройки трея между renderer (БД) и main process
 */

import { ipcMain } from 'electron'

import { getTraySettings, updateTraySettings } from '../tray'

/** Настройки трея */
export interface TraySettings {
  minimizeToTray: boolean
  closeToTray: boolean
  showTrayNotification: boolean
}

/**
 * Регистрирует IPC handlers для настроек трея
 */
export function registerTrayHandlers(): void {
  // Получить текущие настройки трея из main process
  ipcMain.handle('tray:getSettings', (): TraySettings => {
    return getTraySettings()
  })

  // Обновить настройки трея (вызывается из renderer при изменении в UI)
  ipcMain.handle('tray:updateSettings', (_event, settings: Partial<TraySettings>): void => {
    updateTraySettings(settings)
  })
}

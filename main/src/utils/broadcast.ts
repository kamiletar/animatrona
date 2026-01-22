/**
 * Утилита для отправки событий во все окна Electron
 */

import { BrowserWindow } from 'electron'

/**
 * Отправляет событие во все открытые окна приложения
 * @param channel - Название IPC канала
 * @param args - Аргументы для передачи
 */
export function broadcastToWindows(channel: string, ...args: unknown[]): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }
}

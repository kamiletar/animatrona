/**
 * IPC handlers для управления окном (frameless title bar)
 */

import { BrowserWindow, ipcMain } from 'electron'

/**
 * Регистрирует IPC handlers для управления окном
 */
export function registerWindowHandlers(): void {
  // Минимизировать окно
  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  // Максимизировать / Восстановить окно
  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
    return win?.isMaximized() ?? false
  })

  // Закрыть окно
  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  // Проверить, максимизировано ли окно
  ipcMain.handle('window:isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
  })

  // Получить платформу (для позиционирования кнопок)
  ipcMain.handle('window:getPlatform', () => {
    return process.platform // 'win32' | 'darwin' | 'linux'
  })
}

/**
 * Настраивает listeners для отслеживания состояния maximize/unmaximize
 * Вызывать после создания mainWindow
 */
export function setupWindowStateListeners(mainWindow: BrowserWindow): void {
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximizeChanged', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximizeChanged', false)
  })
}

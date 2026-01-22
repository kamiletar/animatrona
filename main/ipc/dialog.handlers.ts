/**
 * IPC handlers для диалогов файловой системы
 */

import { dialog, ipcMain } from 'electron'

import type { FileFilter } from '../../shared/types'
import { allowFilePath, allowPath } from '../protocols/allowed-paths'

/**
 * Регистрирует IPC handlers для диалогов
 */
export function registerDialogHandlers(): void {
  // Выбор файла
  ipcMain.handle('dialog:selectFile', async (_event, filters?: FileFilter[]) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: filters || [
          { name: 'Видео', extensions: ['mkv', 'mp4', 'avi', 'webm'] },
          { name: 'Все файлы', extensions: ['*'] },
        ],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      const filePath = result.filePaths[0]
      // Добавляем директорию файла в whitelist для media:// протокола
      allowFilePath(filePath)

      return filePath
    } catch (error) {
      console.error('[IPC] dialog:selectFile error:', error)
      return null
    }
  })

  // Выбор нескольких файлов
  ipcMain.handle('dialog:selectFiles', async (_event, filters?: FileFilter[]) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: filters || [
          { name: 'Видео', extensions: ['mkv', 'mp4', 'avi', 'webm'] },
          { name: 'Все файлы', extensions: ['*'] },
        ],
      })

      if (result.canceled) {
        return []
      }

      // Добавляем директории выбранных файлов в whitelist
      for (const filePath of result.filePaths) {
        allowFilePath(filePath)
      }

      return result.filePaths
    } catch (error) {
      console.error('[IPC] dialog:selectFiles error:', error)
      return []
    }
  })

  // Выбор папки
  ipcMain.handle('dialog:selectFolder', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      const folderPath = result.filePaths[0]
      // Добавляем папку в whitelist для media:// протокола
      allowPath(folderPath)

      return folderPath
    } catch (error) {
      console.error('[IPC] dialog:selectFolder error:', error)
      return null
    }
  })

  // Сохранение файла
  ipcMain.handle('dialog:saveFile', async (_event, defaultName?: string, filters?: FileFilter[]) => {
    try {
      const result = await dialog.showSaveDialog({
        defaultPath: defaultName,
        filters: filters || [
          { name: 'Видео MKV', extensions: ['mkv'] },
          { name: 'Все файлы', extensions: ['*'] },
        ],
      })

      if (result.canceled || !result.filePath) {
        return null
      }

      return result.filePath
    } catch (error) {
      console.error('[IPC] dialog:saveFile error:', error)
      return null
    }
  })
}

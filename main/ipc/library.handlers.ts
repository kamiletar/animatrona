/**
 * IPC хендлеры для библиотеки
 *
 * Управление путями и структурой библиотеки
 */

import { ipcMain } from 'electron'
import {
  ensureAnimeDirectory,
  ensureEpisodeDirectory,
  getDefaultLibraryPath,
  resolveOutputPath,
  type OutputPathOptions,
} from '../services/output-path-resolver'

/**
 * Регистрирует IPC хендлеры для библиотеки
 */
export function registerLibraryHandlers(): void {
  /**
   * Получить путь к библиотеке по умолчанию
   * @returns Путь к папке Videos/Animatrona
   */
  ipcMain.handle('library:getDefaultPath', async () => {
    return getDefaultLibraryPath()
  })

  /**
   * Получить путь к папке эпизода
   * @param options - Параметры (libraryPath, animeName, seasonNumber, episodeNumber)
   * @returns Полный путь к папке эпизода
   */
  ipcMain.handle('library:resolveOutputPath', async (_event, options: OutputPathOptions) => {
    return resolveOutputPath(options)
  })

  /**
   * Создать структуру папок для эпизода
   * @param options - Параметры (libraryPath, animeName, seasonNumber, episodeNumber)
   * @returns Путь к созданной папке
   */
  ipcMain.handle('library:ensureEpisodeDirectory', async (_event, options: OutputPathOptions) => {
    return ensureEpisodeDirectory(options)
  })

  /**
   * Создать папку для аниме (для постера и других общих файлов)
   * @param libraryPath - Путь к библиотеке
   * @param animeName - Название аниме
   * @returns Путь к созданной папке аниме
   */
  ipcMain.handle('library:ensureAnimeDirectory', async (_event, libraryPath: string, animeName: string) => {
    return ensureAnimeDirectory(libraryPath, animeName)
  })
}

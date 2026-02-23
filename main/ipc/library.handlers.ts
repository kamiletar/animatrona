/**
 * IPC хендлеры для библиотеки
 *
 * Управление путями и структурой библиотеки
 */

import {
  ensureAnimeDirectory,
  ensureEpisodeDirectory,
  getDefaultLibraryPath,
  type OutputPathOptions,
  resolveOutputPath,
} from '../services/output-path-resolver'
import { createHandler } from '../utils/ipc-handler-factory'

/**
 * Регистрирует IPC хендлеры для библиотеки
 */
export function registerLibraryHandlers(): void {
  // Получить путь к библиотеке по умолчанию
  createHandler('library:getDefaultPath', () => getDefaultLibraryPath())

  // Получить путь к папке эпизода
  createHandler('library:resolveOutputPath', (options: OutputPathOptions) => resolveOutputPath(options))

  // Создать структуру папок для эпизода
  createHandler('library:ensureEpisodeDirectory', (options: OutputPathOptions) => ensureEpisodeDirectory(options))

  // Создать папку для аниме
  createHandler(
    'library:ensureAnimeDirectory',
    (libraryPath: string, animeName: string) => ensureAnimeDirectory(libraryPath, animeName),
  )
}

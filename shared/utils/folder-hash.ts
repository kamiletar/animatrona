/**
 * Утилита для генерации хэша папки
 *
 * Используется для идентификации аниме в системе _user/
 * Хэш генерируется из относительного пути папки (от корня библиотеки)
 */

import * as crypto from 'crypto'
import * as path from 'path'

/**
 * Генерирует хэш из относительного пути
 * @param relativePath - Относительный путь от корня библиотеки
 * @returns Первые 16 символов SHA-256 хэша
 */
export function generateFolderHash(relativePath: string): string {
  // Нормализуем путь: заменяем backslash на forward slash для кроссплатформенности
  const normalizedPath = relativePath.replace(/\\/g, '/')

  // Генерируем SHA-256 хэш
  const hash = crypto.createHash('sha256').update(normalizedPath, 'utf8').digest('hex')

  // Возвращаем первые 16 символов (достаточно для уникальности)
  return hash.slice(0, 16)
}

/**
 * Вычисляет относительный путь от библиотеки до папки аниме
 * @param libraryPath - Путь к корню библиотеки
 * @param animeFolderPath - Полный путь к папке аниме
 * @returns Относительный путь (например "Fullmetal Alchemist" или "2024/Spring/Anime Name")
 */
export function getRelativePath(libraryPath: string, animeFolderPath: string): string {
  // Нормализуем пути
  const normalizedLibrary = path.normalize(libraryPath)
  const normalizedAnime = path.normalize(animeFolderPath)

  // Получаем относительный путь
  const relative = path.relative(normalizedLibrary, normalizedAnime)

  // Заменяем backslash на forward slash для консистентности
  return relative.replace(/\\/g, '/')
}

/**
 * Генерирует идентификатор аниме для системы _user/
 * @param libraryPath - Путь к корню библиотеки
 * @param animeFolderPath - Полный путь к папке аниме
 */
export function generateAnimeIdentifier(
  libraryPath: string,
  animeFolderPath: string
): { folderHash: string; relativePath: string } {
  const relativePath = getRelativePath(libraryPath, animeFolderPath)
  const folderHash = generateFolderHash(relativePath)

  return { folderHash, relativePath }
}

/**
 * Генерирует относительный путь эпизода от папки аниме
 * @param animeFolderPath - Путь к папке аниме
 * @param episodeFolderPath - Путь к папке эпизода
 * @returns Относительный путь (например "Season 1/Episode 1")
 */
export function getEpisodeRelativePath(animeFolderPath: string, episodeFolderPath: string): string {
  const normalizedAnime = path.normalize(animeFolderPath)
  const normalizedEpisode = path.normalize(episodeFolderPath)

  const relative = path.relative(normalizedAnime, normalizedEpisode)

  return relative.replace(/\\/g, '/')
}

/**
 * Строит полный путь к файлу данных аниме в _user/
 * @param libraryPath - Путь к корню библиотеки
 * @param folderHash - Хэш папки аниме
 * @returns Полный путь к файлу (например "C:/Library/_user/anime/a1b2c3d4e5f67890.json")
 */
export function getUserAnimeDataPath(libraryPath: string, folderHash: string): string {
  return path.join(libraryPath, '_user', 'anime', `${folderHash}.json`)
}

/**
 * Строит путь к индексному файлу _user/
 * @param libraryPath - Путь к корню библиотеки
 * @returns Полный путь к user-data.json
 */
export function getUserDataIndexPath(libraryPath: string): string {
  return path.join(libraryPath, '_user', 'user-data.json')
}

/**
 * Строит путь к папке _user/anime/
 * @param libraryPath - Путь к корню библиотеки
 */
export function getUserAnimeFolderPath(libraryPath: string): string {
  return path.join(libraryPath, '_user', 'anime')
}

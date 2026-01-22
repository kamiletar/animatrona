/**
 * Сервис управления пользовательскими данными в папке _user/
 *
 * Структура:
 * Library/_user/
 * ├── user-data.json           # Индексный файл
 * └── anime/
 *     └── {folderHash}.json    # Данные аниме + все эпизоды
 *
 * Этот сервис работает ТОЛЬКО с пользовательскими данными.
 * Релизные данные (shikimoriId, isBdRemux) — в anime.meta.json через meta-writer.ts
 */

import * as fs from 'fs/promises'
import * as path from 'path'

import type { SelectedTrack, TrackPreferences, WatchStatusMeta } from '../../../shared/types/backup'
import type { UserAnimeData, UserDataIndex, UserEpisodeData } from '../../../shared/types/user-data'
import { USER_DATA_VERSION } from '../../../shared/types/user-data'
import {
  generateAnimeIdentifier,
  getEpisodeRelativePath,
  getUserAnimeDataPath,
  getUserAnimeFolderPath,
  getUserDataIndexPath,
} from '../../../shared/utils/folder-hash'

// =============================================================================
// ИНИЦИАЛИЗАЦИЯ
// =============================================================================

/**
 * Инициализирует структуру папок _user/ если не существует
 */
export async function initUserDataFolder(libraryPath: string): Promise<void> {
  const animeFolder = getUserAnimeFolderPath(libraryPath)

  // Создаём папки
  await fs.mkdir(animeFolder, { recursive: true })

  // Создаём индексный файл если не существует
  const indexPath = getUserDataIndexPath(libraryPath)
  try {
    await fs.access(indexPath)
  } catch {
    // Файл не существует — создаём
    const index: UserDataIndex = {
      version: USER_DATA_VERSION,
      libraryPath,
      stats: {
        animeCount: 0,
        episodesWithProgress: 0,
        lastUpdated: new Date().toISOString(),
      },
      animeIndex: {},
    }
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8')
  }
}

// =============================================================================
// ЧТЕНИЕ/ЗАПИСЬ ИНДЕКСА
// =============================================================================

/**
 * Читает индексный файл _user/user-data.json
 */
export async function readUserDataIndex(libraryPath: string): Promise<UserDataIndex | null> {
  const indexPath = getUserDataIndexPath(libraryPath)
  try {
    const content = await fs.readFile(indexPath, 'utf-8')
    return JSON.parse(content) as UserDataIndex
  } catch {
    return null
  }
}

/**
 * Записывает индексный файл
 */
export async function writeUserDataIndex(libraryPath: string, index: UserDataIndex): Promise<void> {
  const indexPath = getUserDataIndexPath(libraryPath)
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8')
}

/**
 * Обновляет статистику в индексе
 * @internal Для будущего использования (периодическое обновление индекса)
 */
async function _updateIndexStats(libraryPath: string): Promise<void> {
  const index = await readUserDataIndex(libraryPath)
  if (!index) return

  // Считаем статистику из файлов
  const animeFolder = getUserAnimeFolderPath(libraryPath)
  let animeCount = 0
  let episodesWithProgress = 0

  try {
    const files = await fs.readdir(animeFolder)
    for (const file of files) {
      if (!file.endsWith('.json')) continue

      const filePath = path.join(animeFolder, file)
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const data = JSON.parse(content) as UserAnimeData
        animeCount++
        episodesWithProgress += Object.keys(data.episodes).length
      } catch {
        // Битый файл — пропускаем
      }
    }
  } catch {
    // Папка не существует
  }

  index.stats = {
    animeCount,
    episodesWithProgress,
    lastUpdated: new Date().toISOString(),
  }

  await writeUserDataIndex(libraryPath, index)
}

// Экспорт для будущего использования
export { _updateIndexStats as updateIndexStats }

// =============================================================================
// CRUD АНИМЕ ДАННЫХ
// =============================================================================

/**
 * Читает пользовательские данные аниме
 * @param libraryPath - Путь к библиотеке
 * @param animeFolderPath - Полный путь к папке аниме
 */
export async function readUserAnimeData(
  libraryPath: string,
  animeFolderPath: string
): Promise<UserAnimeData | null> {
  const { folderHash } = generateAnimeIdentifier(libraryPath, animeFolderPath)
  const dataPath = getUserAnimeDataPath(libraryPath, folderHash)

  try {
    const content = await fs.readFile(dataPath, 'utf-8')
    return JSON.parse(content) as UserAnimeData
  } catch {
    return null
  }
}

/**
 * Читает пользовательские данные аниме по хэшу
 */
export async function readUserAnimeDataByHash(
  libraryPath: string,
  folderHash: string
): Promise<UserAnimeData | null> {
  const dataPath = getUserAnimeDataPath(libraryPath, folderHash)

  try {
    const content = await fs.readFile(dataPath, 'utf-8')
    return JSON.parse(content) as UserAnimeData
  } catch {
    return null
  }
}

/**
 * Записывает пользовательские данные аниме
 */
export async function writeUserAnimeData(
  libraryPath: string,
  animeFolderPath: string,
  data: UserAnimeData
): Promise<void> {
  // Инициализируем папки если нужно
  await initUserDataFolder(libraryPath)

  const { folderHash } = generateAnimeIdentifier(libraryPath, animeFolderPath)
  const dataPath = getUserAnimeDataPath(libraryPath, folderHash)

  // Обновляем updatedAt
  data.updatedAt = new Date().toISOString()

  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8')

  // Обновляем индекс
  const index = await readUserDataIndex(libraryPath)
  if (index) {
    index.animeIndex[folderHash] = data.identifier.relativePath
    await writeUserDataIndex(libraryPath, index)
  }
}

/**
 * Создаёт или обновляет данные аниме
 */
export async function upsertUserAnimeData(
  libraryPath: string,
  animeFolderPath: string,
  updates: Partial<Pick<UserAnimeData, 'watchStatus' | 'userRating' | 'watchedAt' | 'trackPreferences'>>
): Promise<UserAnimeData> {
  let existing = await readUserAnimeData(libraryPath, animeFolderPath)
  const now = new Date().toISOString()

  if (!existing) {
    // Создаём новую запись
    const { folderHash, relativePath } = generateAnimeIdentifier(libraryPath, animeFolderPath)
    existing = {
      version: USER_DATA_VERSION,
      identifier: { folderHash, relativePath },
      watchStatus: 'NOT_STARTED',
      userRating: null,
      watchedAt: null,
      trackPreferences: {},
      episodes: {},
      createdAt: now,
      updatedAt: now,
    }
  }

  // Применяем обновления
  const updated: UserAnimeData = {
    ...existing,
    ...updates,
    updatedAt: now,
  }

  await writeUserAnimeData(libraryPath, animeFolderPath, updated)
  return updated
}

/**
 * Удаляет данные аниме
 */
export async function deleteUserAnimeData(libraryPath: string, animeFolderPath: string): Promise<void> {
  const { folderHash } = generateAnimeIdentifier(libraryPath, animeFolderPath)
  const dataPath = getUserAnimeDataPath(libraryPath, folderHash)

  try {
    await fs.unlink(dataPath)
  } catch {
    // Файл не существует
  }

  // Удаляем из индекса
  const index = await readUserDataIndex(libraryPath)
  if (index) {
    delete index.animeIndex[folderHash]
    await writeUserDataIndex(libraryPath, index)
  }
}

// =============================================================================
// CRUD ПРОГРЕССА ЭПИЗОДА
// =============================================================================

export interface UpdateEpisodeProgressParams {
  libraryPath: string
  animeFolderPath: string
  episodeFolderPath: string
  currentTime: number
  completed: boolean
  volume?: number
  selectedAudio: SelectedTrack | null
  selectedSubtitle: SelectedTrack | null
}

/**
 * Обновляет прогресс просмотра эпизода
 */
export async function updateEpisodeProgress(params: UpdateEpisodeProgressParams): Promise<void> {
  const { libraryPath, animeFolderPath, episodeFolderPath } = params

  // Получаем или создаём данные аниме
  let animeData = await readUserAnimeData(libraryPath, animeFolderPath)
  const now = new Date().toISOString()

  if (!animeData) {
    const { folderHash, relativePath } = generateAnimeIdentifier(libraryPath, animeFolderPath)
    animeData = {
      version: USER_DATA_VERSION,
      identifier: { folderHash, relativePath },
      watchStatus: 'WATCHING',
      userRating: null,
      watchedAt: null,
      trackPreferences: {},
      episodes: {},
      createdAt: now,
      updatedAt: now,
    }
  }

  // Получаем относительный путь эпизода
  const episodeKey = getEpisodeRelativePath(animeFolderPath, episodeFolderPath)

  // Обновляем прогресс эпизода
  animeData.episodes[episodeKey] = {
    currentTime: params.currentTime,
    completed: params.completed,
    volume: params.volume,
    lastWatchedAt: now,
    selectedAudio: params.selectedAudio,
    selectedSubtitle: params.selectedSubtitle,
  }

  await writeUserAnimeData(libraryPath, animeFolderPath, animeData)
}

/**
 * Читает прогресс конкретного эпизода
 */
export async function readEpisodeProgress(
  libraryPath: string,
  animeFolderPath: string,
  episodeFolderPath: string
): Promise<UserEpisodeData | null> {
  const animeData = await readUserAnimeData(libraryPath, animeFolderPath)
  if (!animeData) return null

  const episodeKey = getEpisodeRelativePath(animeFolderPath, episodeFolderPath)
  return animeData.episodes[episodeKey] ?? null
}

/**
 * Удаляет прогресс эпизода
 */
export async function deleteEpisodeProgress(
  libraryPath: string,
  animeFolderPath: string,
  episodeFolderPath: string
): Promise<void> {
  const animeData = await readUserAnimeData(libraryPath, animeFolderPath)
  if (!animeData) return

  const episodeKey = getEpisodeRelativePath(animeFolderPath, episodeFolderPath)
  delete animeData.episodes[episodeKey]

  await writeUserAnimeData(libraryPath, animeFolderPath, animeData)
}

// =============================================================================
// СТАТУС ПРОСМОТРА
// =============================================================================

/**
 * Обновляет статус просмотра аниме
 */
export async function updateWatchStatus(
  libraryPath: string,
  animeFolderPath: string,
  watchStatus: WatchStatusMeta,
  watchedAt?: string | null
): Promise<void> {
  await upsertUserAnimeData(libraryPath, animeFolderPath, {
    watchStatus,
    watchedAt: watchedAt ?? (watchStatus === 'COMPLETED' ? new Date().toISOString() : null),
  })
}

/**
 * Обновляет оценку аниме
 */
export async function updateUserRating(
  libraryPath: string,
  animeFolderPath: string,
  userRating: number | null
): Promise<void> {
  await upsertUserAnimeData(libraryPath, animeFolderPath, { userRating })
}

/**
 * Обновляет предпочтения дорожек
 */
export async function updateTrackPreferences(
  libraryPath: string,
  animeFolderPath: string,
  trackPreferences: TrackPreferences
): Promise<void> {
  await upsertUserAnimeData(libraryPath, animeFolderPath, { trackPreferences })
}

// =============================================================================
// ЭКСПОРТ ВСЕХ ДАННЫХ
// =============================================================================

/**
 * Экспортирует все пользовательские данные (для бэкапа)
 */
export async function exportAllUserData(
  libraryPath: string
): Promise<{ index: UserDataIndex; anime: UserAnimeData[] }> {
  const index = await readUserDataIndex(libraryPath)
  if (!index) {
    return {
      index: {
        version: USER_DATA_VERSION,
        libraryPath,
        stats: { animeCount: 0, episodesWithProgress: 0, lastUpdated: new Date().toISOString() },
        animeIndex: {},
      },
      anime: [],
    }
  }

  const anime: UserAnimeData[] = []
  const animeFolder = getUserAnimeFolderPath(libraryPath)

  try {
    const files = await fs.readdir(animeFolder)
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const filePath = path.join(animeFolder, file)
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        anime.push(JSON.parse(content) as UserAnimeData)
      } catch {
        // Битый файл
      }
    }
  } catch {
    // Папка не существует
  }

  return { index, anime }
}

/**
 * IPC хендлеры для backup/restore системы
 *
 * Архитектура:
 * - anime.meta.json — ТОЛЬКО релизные данные (в папке аниме)
 * - _user/ — пользовательские данные (в корне библиотеки)
 */

import type { AnimeMeta, SelectedTrack, TrackPreferences, WatchStatusMeta } from '../../shared/types/backup'
import type { UserAnimeData, UserEpisodeData } from '../../shared/types/user-data'
import {
  deleteAnimeMeta,
  hasAnimeMeta,
  readAnimeMeta,
  updateAnimeMeta,
  writeAnimeMeta,
} from '../services/backup/meta-writer'
import { type LibraryScanResult, quickScanLibrary, scanLibraryForRestore } from '../services/backup/restore-library'
import {
  deleteEpisodeProgress,
  deleteUserAnimeData,
  exportAllUserData,
  initUserDataFolder,
  readEpisodeProgress,
  readUserAnimeData,
  readUserDataIndex,
  updateEpisodeProgress,
  updateTrackPreferences,
  updateUserRating,
  updateWatchStatus,
} from '../services/backup/user-data-service'
import { createHandler } from '../utils/ipc-handler-factory'

/**
 * Регистрирует IPC хендлеры для backup/restore
 */
export function registerBackupHandlers(): void {
  // ==========================================================================
  // ANIME META — РЕЛИЗНЫЕ ДАННЫЕ
  // ==========================================================================

  /** Записать anime.meta.json (только релизные данные) */
  createHandler(
    'backup:writeAnimeMeta',
    (params: {
      animeFolder: string
      shikimoriId: number | null
      isBdRemux: boolean
      fallbackInfo: { name: string; originalName?: string; year?: number }
    }) => writeAnimeMeta(params),
  )

  /** Обновить anime.meta.json (частичное обновление) */
  createHandler(
    'backup:updateAnimeMeta',
    (
      animeFolder: string,
      updates: {
        shikimoriId?: number | null
        isBdRemux?: boolean
        fallbackInfo?: { name: string; originalName?: string; year?: number }
      },
    ) => updateAnimeMeta(animeFolder, updates),
  )

  /** Прочитать anime.meta.json */
  createHandler('backup:readAnimeMeta', (animeFolder: string): Promise<AnimeMeta | null> => readAnimeMeta(animeFolder))

  /** Проверить существование anime.meta.json */
  createHandler('backup:hasAnimeMeta', (animeFolder: string) => hasAnimeMeta(animeFolder))

  /** Удалить anime.meta.json */
  createHandler('backup:deleteAnimeMeta', (animeFolder: string) => deleteAnimeMeta(animeFolder))

  // ==========================================================================
  // USER DATA — ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ В _user/
  // ==========================================================================

  /** Инициализировать папку _user/ */
  createHandler('userData:init', (libraryPath: string) => initUserDataFolder(libraryPath))

  /** Обновить статус просмотра аниме */
  createHandler(
    'userData:updateWatchStatus',
    (libraryPath: string, animeFolderPath: string, watchStatus: WatchStatusMeta, watchedAt?: string | null) =>
      updateWatchStatus(libraryPath, animeFolderPath, watchStatus, watchedAt),
  )

  /** Обновить оценку аниме */
  createHandler(
    'userData:updateUserRating',
    (libraryPath: string, animeFolderPath: string, userRating: number | null) =>
      updateUserRating(libraryPath, animeFolderPath, userRating),
  )

  /** Обновить предпочтения дорожек */
  createHandler(
    'userData:updateTrackPreferences',
    (libraryPath: string, animeFolderPath: string, trackPreferences: TrackPreferences) =>
      updateTrackPreferences(libraryPath, animeFolderPath, trackPreferences),
  )

  /** Обновить прогресс эпизода */
  createHandler(
    'userData:updateEpisodeProgress',
    (params: {
      libraryPath: string
      animeFolderPath: string
      episodeFolderPath: string
      currentTime: number
      completed: boolean
      volume?: number
      selectedAudio: SelectedTrack | null
      selectedSubtitle: SelectedTrack | null
    }) => updateEpisodeProgress(params),
  )

  /** Прочитать прогресс эпизода */
  createHandler(
    'userData:readEpisodeProgress',
    (libraryPath: string, animeFolderPath: string, episodeFolderPath: string): Promise<UserEpisodeData | null> =>
      readEpisodeProgress(libraryPath, animeFolderPath, episodeFolderPath),
  )

  /** Прочитать данные аниме пользователя */
  createHandler(
    'userData:readAnimeData',
    (libraryPath: string, animeFolderPath: string): Promise<UserAnimeData | null> =>
      readUserAnimeData(libraryPath, animeFolderPath),
  )

  /** Удалить прогресс эпизода */
  createHandler(
    'userData:deleteEpisodeProgress',
    (libraryPath: string, animeFolderPath: string, episodeFolderPath: string) =>
      deleteEpisodeProgress(libraryPath, animeFolderPath, episodeFolderPath),
  )

  /** Удалить все данные аниме */
  createHandler(
    'userData:deleteAnimeData',
    (libraryPath: string, animeFolderPath: string) => deleteUserAnimeData(libraryPath, animeFolderPath),
  )

  /** Прочитать индекс _user/ */
  createHandler('userData:readIndex', (libraryPath: string) => readUserDataIndex(libraryPath))

  /** Экспортировать все пользовательские данные */
  createHandler('userData:exportAll', (libraryPath: string) => exportAllUserData(libraryPath))

  // ==========================================================================
  // RESTORE LIBRARY
  // ==========================================================================

  /** Быстрое сканирование библиотеки — только статистика */
  createHandler('backup:quickScanLibrary', async (libraryPath: string) => {
    const result = await quickScanLibrary(libraryPath)
    return { stats: result.stats, error: result.error }
  })

  /** Полное сканирование библиотеки для восстановления */
  createHandler(
    'backup:scanLibraryForRestore',
    (libraryPath: string, loadShikimori = true): Promise<LibraryScanResult> =>
      scanLibraryForRestore(libraryPath, loadShikimori),
  )
}

/**
 * IPC хендлеры для backup/restore системы
 *
 * Архитектура:
 * - anime.meta.json — ТОЛЬКО релизные данные (в папке аниме)
 * - _user/ — пользовательские данные (в корне библиотеки)
 */

import { ipcMain } from 'electron'

import type { AnimeMeta, SelectedTrack, TrackPreferences, WatchStatusMeta } from '../../shared/types/backup'
import type { UserAnimeData, UserEpisodeData } from '../../shared/types/user-data'
import {
  deleteAnimeMeta,
  hasAnimeMeta,
  readAnimeMeta,
  updateAnimeMeta,
  writeAnimeMeta,
} from '../services/backup/meta-writer'
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
import { quickScanLibrary, scanLibraryForRestore, type LibraryScanResult } from '../services/backup/restore-library'

/**
 * Регистрирует IPC хендлеры для backup/restore
 */
export function registerBackupHandlers(): void {
  // ==========================================================================
  // ANIME META — РЕЛИЗНЫЕ ДАННЫЕ
  // ==========================================================================

  /**
   * Записать anime.meta.json (только релизные данные)
   */
  ipcMain.handle(
    'backup:writeAnimeMeta',
    async (
      _event,
      params: {
        animeFolder: string
        shikimoriId: number | null
        isBdRemux: boolean
        fallbackInfo: { name: string; originalName?: string; year?: number }
      }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await writeAnimeMeta(params)
        return { success: true }
      } catch (error) {
        console.error('[backup] writeAnimeMeta error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Обновить anime.meta.json (частичное обновление)
   */
  ipcMain.handle(
    'backup:updateAnimeMeta',
    async (
      _event,
      animeFolder: string,
      updates: {
        shikimoriId?: number | null
        isBdRemux?: boolean
        fallbackInfo?: { name: string; originalName?: string; year?: number }
      }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await updateAnimeMeta(animeFolder, updates)
        return { success: true }
      } catch (error) {
        console.error('[backup] updateAnimeMeta error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Прочитать anime.meta.json
   */
  ipcMain.handle(
    'backup:readAnimeMeta',
    async (_event, animeFolder: string): Promise<{ success: boolean; data?: AnimeMeta | null; error?: string }> => {
      try {
        const data = await readAnimeMeta(animeFolder)
        return { success: true, data }
      } catch (error) {
        console.error('[backup] readAnimeMeta error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Проверить существование anime.meta.json
   */
  ipcMain.handle(
    'backup:hasAnimeMeta',
    async (_event, animeFolder: string): Promise<{ success: boolean; exists?: boolean; error?: string }> => {
      try {
        const exists = await hasAnimeMeta(animeFolder)
        return { success: true, exists }
      } catch (error) {
        console.error('[backup] hasAnimeMeta error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Удалить anime.meta.json
   */
  ipcMain.handle(
    'backup:deleteAnimeMeta',
    async (_event, animeFolder: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await deleteAnimeMeta(animeFolder)
        return { success: true }
      } catch (error) {
        console.error('[backup] deleteAnimeMeta error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  // ==========================================================================
  // USER DATA — ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ В _user/
  // ==========================================================================

  /**
   * Инициализировать папку _user/
   */
  ipcMain.handle(
    'userData:init',
    async (_event, libraryPath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await initUserDataFolder(libraryPath)
        return { success: true }
      } catch (error) {
        console.error('[userData] init error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Обновить статус просмотра аниме
   */
  ipcMain.handle(
    'userData:updateWatchStatus',
    async (
      _event,
      libraryPath: string,
      animeFolderPath: string,
      watchStatus: WatchStatusMeta,
      watchedAt?: string | null
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await updateWatchStatus(libraryPath, animeFolderPath, watchStatus, watchedAt)
        return { success: true }
      } catch (error) {
        console.error('[userData] updateWatchStatus error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Обновить оценку аниме
   */
  ipcMain.handle(
    'userData:updateUserRating',
    async (
      _event,
      libraryPath: string,
      animeFolderPath: string,
      userRating: number | null
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await updateUserRating(libraryPath, animeFolderPath, userRating)
        return { success: true }
      } catch (error) {
        console.error('[userData] updateUserRating error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Обновить предпочтения дорожек
   */
  ipcMain.handle(
    'userData:updateTrackPreferences',
    async (
      _event,
      libraryPath: string,
      animeFolderPath: string,
      trackPreferences: TrackPreferences
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await updateTrackPreferences(libraryPath, animeFolderPath, trackPreferences)
        return { success: true }
      } catch (error) {
        console.error('[userData] updateTrackPreferences error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Обновить прогресс эпизода
   */
  ipcMain.handle(
    'userData:updateEpisodeProgress',
    async (
      _event,
      params: {
        libraryPath: string
        animeFolderPath: string
        episodeFolderPath: string
        currentTime: number
        completed: boolean
        volume?: number
        selectedAudio: SelectedTrack | null
        selectedSubtitle: SelectedTrack | null
      }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await updateEpisodeProgress(params)
        return { success: true }
      } catch (error) {
        console.error('[userData] updateEpisodeProgress error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Прочитать прогресс эпизода
   */
  ipcMain.handle(
    'userData:readEpisodeProgress',
    async (
      _event,
      libraryPath: string,
      animeFolderPath: string,
      episodeFolderPath: string
    ): Promise<{ success: boolean; data?: UserEpisodeData | null; error?: string }> => {
      try {
        const data = await readEpisodeProgress(libraryPath, animeFolderPath, episodeFolderPath)
        return { success: true, data }
      } catch (error) {
        console.error('[userData] readEpisodeProgress error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Прочитать данные аниме пользователя
   */
  ipcMain.handle(
    'userData:readAnimeData',
    async (
      _event,
      libraryPath: string,
      animeFolderPath: string
    ): Promise<{ success: boolean; data?: UserAnimeData | null; error?: string }> => {
      try {
        const data = await readUserAnimeData(libraryPath, animeFolderPath)
        return { success: true, data }
      } catch (error) {
        console.error('[userData] readAnimeData error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Удалить прогресс эпизода
   */
  ipcMain.handle(
    'userData:deleteEpisodeProgress',
    async (
      _event,
      libraryPath: string,
      animeFolderPath: string,
      episodeFolderPath: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await deleteEpisodeProgress(libraryPath, animeFolderPath, episodeFolderPath)
        return { success: true }
      } catch (error) {
        console.error('[userData] deleteEpisodeProgress error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Удалить все данные аниме
   */
  ipcMain.handle(
    'userData:deleteAnimeData',
    async (
      _event,
      libraryPath: string,
      animeFolderPath: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await deleteUserAnimeData(libraryPath, animeFolderPath)
        return { success: true }
      } catch (error) {
        console.error('[userData] deleteAnimeData error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Прочитать индекс _user/
   */
  ipcMain.handle(
    'userData:readIndex',
    async (_event, libraryPath: string): Promise<{ success: boolean; data?: unknown; error?: string }> => {
      try {
        const data = await readUserDataIndex(libraryPath)
        return { success: true, data }
      } catch (error) {
        console.error('[userData] readIndex error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Экспортировать все пользовательские данные
   */
  ipcMain.handle(
    'userData:exportAll',
    async (_event, libraryPath: string): Promise<{ success: boolean; data?: unknown; error?: string }> => {
      try {
        const data = await exportAllUserData(libraryPath)
        return { success: true, data }
      } catch (error) {
        console.error('[userData] exportAll error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  // ==========================================================================
  // RESTORE LIBRARY
  // ==========================================================================

  /**
   * Быстрое сканирование библиотеки — только статистика
   */
  ipcMain.handle(
    'backup:quickScanLibrary',
    async (
      _event,
      libraryPath: string
    ): Promise<{ success: boolean; stats?: LibraryScanResult['stats']; error?: string }> => {
      try {
        const result = await quickScanLibrary(libraryPath)
        return { success: result.success, stats: result.stats, error: result.error }
      } catch (error) {
        console.error('[backup] quickScanLibrary error:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Полное сканирование библиотеки для восстановления
   */
  ipcMain.handle(
    'backup:scanLibraryForRestore',
    async (_event, libraryPath: string, loadShikimori = true): Promise<LibraryScanResult> => {
      try {
        return await scanLibraryForRestore(libraryPath, loadShikimori)
      } catch (error) {
        console.error('[backup] scanLibraryForRestore error:', error)
        return {
          success: false,
          animes: [],
          stats: { totalAnimes: 0, totalEpisodes: 0, withShikimoriId: 0 },
          warnings: [],
          error: String(error),
        }
      }
    }
  )
}

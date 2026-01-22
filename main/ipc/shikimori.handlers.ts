/**
 * IPC handlers для Shikimori API
 */

import { ipcMain } from 'electron'

import type { ShikimoriSearchOptions } from '../services/shikimori'
import {
  downloadPoster,
  getAnimeDetails,
  getAnimeExtended,
  getAnimeWithRelated,
  searchAnime,
} from '../services/shikimori'

/**
 * Регистрирует IPC handlers для Shikimori API
 */
export function registerShikimoriHandlers(): void {
  // Поиск аниме
  ipcMain.handle('shikimori:search', async (_event, options: ShikimoriSearchOptions) => {
    try {
      const results = await searchAnime(options)
      return { success: true, data: results }
    } catch (error) {
      console.error('[IPC] shikimori:search error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Получить детали аниме по ID
  ipcMain.handle('shikimori:getDetails', async (_event, shikimoriId: number) => {
    try {
      const details = await getAnimeDetails(shikimoriId)
      if (!details) {
        return { success: false, error: 'Аниме не найдено' }
      }
      return { success: true, data: details }
    } catch (error) {
      console.error('[IPC] shikimori:getDetails error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Скачать постер
  ipcMain.handle(
    'shikimori:downloadPoster',
    async (_event, posterUrl: string, animeId: string, options?: { fileName?: string; savePath?: string }) => {
      try {
        const result = await downloadPoster(posterUrl, animeId, options)
        return result
      } catch (error) {
        console.error('[IPC] shikimori:downloadPoster error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // Получить аниме со связанными
  ipcMain.handle('shikimori:getWithRelated', async (_event, shikimoriId: number) => {
    try {
      const result = await getAnimeWithRelated(shikimoriId)
      if (!result) {
        return { success: false, error: 'Аниме не найдено' }
      }
      return { success: true, data: result }
    } catch (error) {
      console.error('[IPC] shikimori:getWithRelated error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Получить расширенные метаданные аниме (v0.5.1)
  ipcMain.handle('shikimori:getExtended', async (_event, shikimoriId: number) => {
    try {
      const result = await getAnimeExtended(shikimoriId)
      if (!result) {
        return { success: false, error: 'Аниме не найдено' }
      }
      return { success: true, data: result }
    } catch (error) {
      console.error('[IPC] shikimori:getExtended error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })
}

/**
 * IPC handlers для генерации манифестов
 */

import { ipcMain } from 'electron'

import type { DemuxResult } from '../../shared/types'
import type { GenerateManifestOptions } from '../../shared/types/manifest'
import {
  generateManifestFromDemux,
  readManifest,
  updateManifestNavigation,
  updateManifestThumbnails,
} from '../services/manifest-generator'

/**
 * Регистрирует IPC handlers для работы с манифестами
 */
export function registerManifestHandlers(): void {
  // Генерация манифеста из результатов demux
  ipcMain.handle('manifest:generate', async (_event, demuxResult: DemuxResult, options: GenerateManifestOptions) => {
    try {
      const result = generateManifestFromDemux(demuxResult, options)
      return result
    } catch (error) {
      console.error('[IPC] manifest:generate error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Чтение существующего манифеста
  ipcMain.handle('manifest:read', async (_event, manifestPath: string) => {
    try {
      const manifest = readManifest(manifestPath)
      if (!manifest) {
        return { success: false, error: 'Манифест не найден' }
      }
      return { success: true, data: manifest }
    } catch (error) {
      console.error('[IPC] manifest:read error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Обновление навигации в манифесте
  ipcMain.handle(
    'manifest:updateNavigation',
    async (
      _event,
      manifestPath: string,
      navigation: {
        nextEpisode?: { id: string; manifestPath: string }
        prevEpisode?: { id: string; manifestPath: string }
      }
    ) => {
      try {
        const success = updateManifestNavigation(manifestPath, navigation)
        return { success }
      } catch (error) {
        console.error('[IPC] manifest:updateNavigation error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // Обновление thumbnails в манифесте
  ipcMain.handle(
    'manifest:updateThumbnails',
    async (
      _event,
      manifestPath: string,
      thumbnails: {
        vttPath: string
        spritePath: string
      }
    ) => {
      try {
        const success = updateManifestThumbnails(manifestPath, thumbnails)
        return { success }
      } catch (error) {
        console.error('[IPC] manifest:updateThumbnails error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )
}

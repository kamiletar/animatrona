/**
 * IPC handlers для работы с франшизами
 *
 * Синхронизация связей между аниме из Shikimori API
 */

import { ipcMain } from 'electron'

import type { ShikimoriRelationKind } from '../services/shikimori'
import { getAnimeWithRelated } from '../services/shikimori'
import {
  clearFranchiseCache,
  getFranchiseGraph,
  getFranchiseName,
  getRootShikimoriId,
} from '../services/shikimori/franchise-api'

/** Маппинг типов связей Shikimori -> наши enum'ы */
const RELATION_KIND_MAP: Record<ShikimoriRelationKind, string> = {
  sequel: 'SEQUEL',
  prequel: 'PREQUEL',
  side_story: 'SIDE_STORY',
  parent_story: 'PARENT_STORY',
  summary: 'SUMMARY',
  full_story: 'FULL_STORY',
  spin_off: 'SPIN_OFF',
  adaptation: 'ADAPTATION',
  character: 'CHARACTER',
  alternative_version: 'ALTERNATIVE_VERSION',
  alternative_setting: 'ALTERNATIVE_SETTING',
  other: 'OTHER',
}

/** Данные о связанном аниме для сохранения в БД */
export interface RelatedAnimeData {
  shikimoriId: number
  relationKind: string
  name: string | null
  posterUrl: string | null
  year: number | null
  kind: string | null
}

/**
 * Регистрирует IPC handlers для работы с франшизами
 */
export function registerFranchiseHandlers(): void {
  /**
   * Получить связанные аниме из Shikimori по ID
   * Возвращает данные для сохранения в AnimeRelation
   */
  ipcMain.handle('franchise:fetchRelated', async (_event, shikimoriId: number) => {
    try {
      const animeWithRelated = await getAnimeWithRelated(shikimoriId)
      if (!animeWithRelated) {
        return { success: false, error: 'Аниме не найдено на Shikimori' }
      }

      // Преобразуем данные из Shikimori в формат для БД
      const relatedAnimes: RelatedAnimeData[] = []

      for (const related of animeWithRelated.related) {
        // Пропускаем если это манга (anime === null)
        if (!related.anime) {
          continue
        }

        // Пропускаем музыкальные видео — это видео библиотека
        if (related.anime.kind === 'music') {
          continue
        }

        const relationKind = RELATION_KIND_MAP[related.relationKind] || 'OTHER'

        relatedAnimes.push({
          shikimoriId: parseInt(related.anime.id, 10),
          relationKind,
          name: related.anime.russian || related.anime.name,
          posterUrl: related.anime.poster?.mainUrl || null,
          year: related.anime.airedOn?.year || null,
          kind: related.anime.kind || null,
        })
      }

      return {
        success: true,
        data: {
          sourceAnime: {
            shikimoriId: parseInt(animeWithRelated.id, 10),
            name: animeWithRelated.russian || animeWithRelated.name,
            /** ID франшизы из Shikimori (строка, например "tondemo_skill_de_isekai_hourou_meshi") */
            franchise: animeWithRelated.franchise,
          },
          relatedAnimes,
        },
      }
    } catch (error) {
      console.error('[IPC] franchise:fetchRelated error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Получить граф франшизы из REST API Shikimori
   * Возвращает полный граф с узлами (аниме) и связями между ними
   */
  ipcMain.handle('franchise:fetchGraph', async (_event, shikimoriId: number) => {
    try {
      const graph = await getFranchiseGraph(shikimoriId)
      if (!graph) {
        return {
          success: true,
          data: null,
          message: 'Аниме не имеет франшизы',
        }
      }

      // Вычисляем rootShikimoriId и название франшизы
      const rootShikimoriId = getRootShikimoriId(graph)
      const franchiseName = getFranchiseName(graph)

      return {
        success: true,
        data: {
          graph,
          rootShikimoriId,
          franchiseName,
        },
      }
    } catch (error) {
      console.error('[IPC] franchise:fetchGraph error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /**
   * Очистить кэш графов франшиз
   */
  ipcMain.handle('franchise:clearCache', async () => {
    try {
      clearFranchiseCache()
      return { success: true }
    } catch (error) {
      console.error('[IPC] franchise:clearCache error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })
}

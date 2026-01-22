'use client'

/**
 * Хук для инициализации всех мутаций импорта
 * Собирает 13 мутаций в одном месте для удобства
 */

import {
  useCreateAudioTrack,
  useCreateChapter,
  useCreateEpisode,
  useCreateSubtitleFont,
  useCreateSubtitleTrack,
  useDeleteAnime,
  useUpdateAnime,
  useUpdateAudioTrack,
  useUpdateEpisode,
  useUpsertAnime,
  useUpsertEpisode,
  useUpsertFile,
  useUpsertFranchise,
  useUpsertSeason,
} from '@/lib/hooks'

/**
 * Хук для инициализации всех мутаций импорта
 *
 * @returns Объект со всеми мутациями для импорта
 */
export function useImportMutations() {
  return {
    // Anime
    upsertAnime: useUpsertAnime(),
    updateAnime: useUpdateAnime(),
    deleteAnime: useDeleteAnime(),

    // Season
    upsertSeason: useUpsertSeason(),

    // Episode
    createEpisode: useCreateEpisode(),
    upsertEpisode: useUpsertEpisode(),
    updateEpisode: useUpdateEpisode(),

    // Audio
    createAudioTrack: useCreateAudioTrack(),
    updateAudioTrack: useUpdateAudioTrack(),

    // Subtitles
    createSubtitleTrack: useCreateSubtitleTrack(),
    createSubtitleFont: useCreateSubtitleFont(),

    // Chapters
    createChapter: useCreateChapter(),

    // Franchise
    upsertFranchise: useUpsertFranchise(),

    // Files
    upsertFile: useUpsertFile(),
  }
}

/** Тип возвращаемого значения useImportMutations */
export type ImportMutations = ReturnType<typeof useImportMutations>

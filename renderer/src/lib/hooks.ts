'use client'

/**
 * React Query хуки для CRUD операций
 * Все операции используют Server Actions + TanStack Query
 *
 * @remarks
 * Хуки созданы с использованием фабрик из hooks-factory.ts
 * для устранения дублирования кода
 */

import {
  createAnimeRelation,
  createManyAnimeRelations,
  deleteAnimeRelation,
  deleteManyAnimeRelations,
  findManyAnimeRelations,
  updateAnimeRelation,
} from '@/app/_actions/anime-relation.action'
import {
  createAnime,
  deleteAnime,
  findManyAnime,
  findUniqueAnime,
  updateAnime,
  upsertAnimeByShikimoriId,
} from '@/app/_actions/anime.action'
import { createAudioTrack, deleteAudioTrack, updateAudioTrack } from '@/app/_actions/audio-track.action'
import {
  copyChaptersToEpisodes,
  createChapter,
  deleteChapter,
  findChaptersByEpisodeId,
  updateChapter,
} from '@/app/_actions/chapter.action'
import {
  createEncodingProfile,
  deleteEncodingProfile,
  duplicateEncodingProfile,
  findFirstEncodingProfile,
  findManyEncodingProfiles,
  findUniqueEncodingProfile,
  setDefaultEncodingProfile,
  updateEncodingProfile,
} from '@/app/_actions/encoding-profile.action'
import {
  createEpisode,
  deleteEpisode,
  findManyEpisodes,
  findUniqueEpisode,
  updateEpisode,
  upsertEpisode,
} from '@/app/_actions/episode.action'
import { getAllFandubbers, getAllStudios } from '@/app/_actions/extended-metadata.action'
import { createFile, findManyFiles, upsertFile } from '@/app/_actions/file.action'
import {
  type AvailableItem,
  type FilterCounts,
  getAvailableDirectors,
  getAvailableGenres,
  getAvailableStudios,
  getFilterCounts,
  getLocalDubGroups,
} from '@/app/_actions/filter-counts.action'
import {
  createFranchise,
  deleteFranchise,
  findManyFranchises,
  findUniqueFranchise,
  updateFranchise,
  upsertFranchiseByShikimoriId,
} from '@/app/_actions/franchise.action'
import { createGenre, findManyGenres } from '@/app/_actions/genre.action'
import { createSeason, findManySeasons, upsertSeason } from '@/app/_actions/season.action'
import {
  getSettings,
  getSettingsWithProfile,
  setDefaultProfile,
  updateSettings,
  upsertSettings,
} from '@/app/_actions/settings.action'
import { createSubtitleFont } from '@/app/_actions/subtitle-font.action'
import { createSubtitleTrack, deleteSubtitleTrack, updateSubtitleTrack } from '@/app/_actions/subtitle-track.action'
import { findUniqueWatchProgress, upsertWatchProgress } from '@/app/_actions/watch-progress.action'
import type { ChapterType, Prisma } from '@/generated/prisma'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createCreateHook,
  createCRUDHooks,
  createDeleteHook,
  createFindManyHook,
  createUpdateHook,
} from './hooks-factory'

// ============================================================
// Anime — полный CRUD через фабрику
// ============================================================

const animeHooks = createCRUDHooks({
  keys: { list: 'animes', single: 'anime' },
  actions: {
    findMany: findManyAnime,
    findUnique: findUniqueAnime,
    create: createAnime,
    update: updateAnime,
    delete: deleteAnime,
  },
  // Инвалидация episode при обновлении anime, чтобы свежие данные
  // (например, lastSelectedAudioDubGroup) были доступны при смене эпизода
  invalidation: {
    additional: ['episode'],
  },
})

export const useFindManyAnime = animeHooks.useFindMany
export const useFindUniqueAnime = animeHooks.useFindUnique
export const useCreateAnime = animeHooks.useCreate
export const useUpdateAnime = animeHooks.useUpdate
export const useDeleteAnime = animeHooks.useDelete

/** Mutation хук для upsert Anime по shikimoriId */
export function useUpsertAnime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ data }: { data: Prisma.AnimeUncheckedCreateInput }) => upsertAnimeByShikimoriId(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['animes'] })
    },
  })
}

// ============================================================
// Episode — полный CRUD через фабрику
// ============================================================

const episodeHooks = createCRUDHooks({
  keys: { list: 'episodes', single: 'episode' },
  actions: {
    findMany: findManyEpisodes,
    findUnique: findUniqueEpisode,
    create: createEpisode,
    update: updateEpisode,
    delete: deleteEpisode,
  },
})

export const useFindManyEpisode = episodeHooks.useFindMany
export const useFindUniqueEpisode = episodeHooks.useFindUnique
export const useCreateEpisode = episodeHooks.useCreate
export const useUpdateEpisode = episodeHooks.useUpdate
export const useDeleteEpisode = episodeHooks.useDelete

/** Mutation хук для upsert Episode по animeId + number */
export function useUpsertEpisode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ data }: { data: Prisma.EpisodeUncheckedCreateInput }) => upsertEpisode(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
    },
  })
}

// ============================================================
// Franchise — полный CRUD через фабрику
// ============================================================

const franchiseHooks = createCRUDHooks({
  keys: { list: 'franchises', single: 'franchise' },
  actions: {
    findMany: findManyFranchises,
    findUnique: findUniqueFranchise,
    create: createFranchise,
    update: updateFranchise,
    delete: deleteFranchise,
  },
})

export const useFindManyFranchise = franchiseHooks.useFindMany
export const useFindUniqueFranchise = franchiseHooks.useFindUnique
export const useCreateFranchise = franchiseHooks.useCreate
export const useUpdateFranchise = franchiseHooks.useUpdate
export const useDeleteFranchise = franchiseHooks.useDelete

/** Mutation хук для upsert Franchise по shikimoriFranchiseId */
export function useUpsertFranchise() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ shikimoriFranchiseId, name }: { shikimoriFranchiseId: string; name: string }) =>
      upsertFranchiseByShikimoriId(shikimoriFranchiseId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['franchises'] })
    },
  })
}

// ============================================================
// EncodingProfile — CRUD + специальные операции
// ============================================================

const encodingProfileHooks = createCRUDHooks({
  keys: { list: 'encodingProfiles', single: 'encodingProfile' },
  actions: {
    findMany: findManyEncodingProfiles,
    findUnique: findUniqueEncodingProfile,
    create: createEncodingProfile,
    update: updateEncodingProfile,
    delete: deleteEncodingProfile,
  },
})

export const useFindManyEncodingProfile = encodingProfileHooks.useFindMany
export const useFindUniqueEncodingProfile = encodingProfileHooks.useFindUnique
export const useCreateEncodingProfile = encodingProfileHooks.useCreate
export const useUpdateEncodingProfile = encodingProfileHooks.useUpdate
export const useDeleteEncodingProfile = encodingProfileHooks.useDelete

/** Query хук для useFindFirst EncodingProfile (поиск по умолчанию) */
export function useFindFirstEncodingProfile(
  args?: Prisma.EncodingProfileFindFirstArgs,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['encodingProfileFirst', args],
    queryFn: () => findFirstEncodingProfile(args),
    enabled: options?.enabled,
  })
}

/** Mutation хук для дублирования EncodingProfile */
export function useDuplicateEncodingProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, newName }: { id: string; newName?: string }) => duplicateEncodingProfile(id, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encodingProfiles'] })
    },
  })
}

/** Mutation хук для установки профиля по умолчанию */
export function useSetDefaultEncodingProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => setDefaultEncodingProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encodingProfiles'] })
      queryClient.invalidateQueries({ queryKey: ['encodingProfileFirst'] })
    },
  })
}

// ============================================================
// AnimeRelation — CRUD + bulk операции
// ============================================================

export const useFindManyAnimeRelation = createFindManyHook({
  queryKey: 'animeRelations',
  queryFn: findManyAnimeRelations,
})

export const useCreateAnimeRelation = createCreateHook({
  listKey: 'animeRelations',
  mutationFn: createAnimeRelation,
})

export const useUpdateAnimeRelation = createUpdateHook({
  listKey: 'animeRelations',
  singleKey: 'animeRelation',
  mutationFn: updateAnimeRelation,
})

export const useDeleteAnimeRelation = createDeleteHook({
  listKey: 'animeRelations',
  mutationFn: deleteAnimeRelation,
})

/** Mutation хук для создания множества AnimeRelation */
export function useCreateManyAnimeRelation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ data }: { data: Prisma.AnimeRelationCreateManyInput[] }) => createManyAnimeRelations(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['animeRelations'] })
    },
  })
}

/** Mutation хук для удаления множества AnimeRelation */
export function useDeleteManyAnimeRelation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ where }: { where: Prisma.AnimeRelationWhereInput }) => deleteManyAnimeRelations(where),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['animeRelations'] })
    },
  })
}

// ============================================================
// Genre — findMany + create
// ============================================================

export const useFindManyGenre = createFindManyHook({
  queryKey: 'genres',
  queryFn: findManyGenres,
})

export const useCreateGenre = createCreateHook({
  listKey: 'genres',
  mutationFn: createGenre,
})

// ============================================================
// Season — findMany + create
// ============================================================

export const useFindManySeason = createFindManyHook({
  queryKey: 'seasons',
  queryFn: findManySeasons,
})

export const useCreateSeason = createCreateHook({
  listKey: 'seasons',
  mutationFn: createSeason,
})

export const useUpsertSeason = createCreateHook({
  listKey: 'seasons',
  mutationFn: upsertSeason,
})

// ============================================================
// Studio, Fandubber — read-only
// ============================================================

export const useFindManyStudio = createFindManyHook({
  queryKey: 'studios',
  queryFn: getAllStudios,
})

export const useFindManyFandubber = createFindManyHook({
  queryKey: 'fandubbers',
  queryFn: getAllFandubbers,
})

// ============================================================
// File — create, upsert, findMany
// ============================================================

export const useFindManyFile = createFindManyHook({
  queryKey: 'files',
  queryFn: findManyFiles,
})

export const useCreateFile = createCreateHook({
  listKey: 'files',
  mutationFn: createFile,
})

/** Mutation хук для upsert File (создание или обновление по пути) */
export function useUpsertFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ data }: { data: Prisma.FileCreateInput }) => upsertFile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
    },
  })
}

// ============================================================
// AudioTrack — с predicate инвалидацией episode
// ============================================================

export const useCreateAudioTrack = createCreateHook({
  listKey: 'audioTracks',
  mutationFn: createAudioTrack,
})

export const useUpdateAudioTrack = createUpdateHook({
  listKey: 'audioTracks',
  singleKey: 'audioTrack',
  mutationFn: updateAudioTrack,
  predicateInvalidation: 'episode',
})

export const useDeleteAudioTrack = createDeleteHook({
  listKey: 'audioTracks',
  mutationFn: deleteAudioTrack,
  predicateInvalidation: 'episode',
})

// ============================================================
// SubtitleTrack — с predicate инвалидацией episode
// ============================================================

export const useCreateSubtitleTrack = createCreateHook({
  listKey: 'subtitleTracks',
  mutationFn: createSubtitleTrack,
})

export const useUpdateSubtitleTrack = createUpdateHook({
  listKey: 'subtitleTracks',
  singleKey: 'subtitleTrack',
  mutationFn: updateSubtitleTrack,
  predicateInvalidation: 'episode',
})

export const useDeleteSubtitleTrack = createDeleteHook({
  listKey: 'subtitleTracks',
  mutationFn: deleteSubtitleTrack,
  predicateInvalidation: 'episode',
})

// ============================================================
// SubtitleFont — create only с дополнительной инвалидацией
// ============================================================

export const useCreateSubtitleFont = createCreateHook({
  listKey: 'subtitleFonts',
  mutationFn: createSubtitleFont,
  additionalInvalidation: ['subtitleTracks'],
})

// ============================================================
// Chapter — custom queries + predicate инвалидация
// ============================================================

/** Query хук для получения глав эпизода */
export function useFindChaptersByEpisodeId(episodeId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['chapters', episodeId],
    queryFn: () => findChaptersByEpisodeId(episodeId),
    enabled: options?.enabled ?? !!episodeId,
  })
}

/** Mutation хук для создания Chapter */
export function useCreateChapter() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ data }: { data: Prisma.ChapterUncheckedCreateInput }) => createChapter(data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chapters'] })
      queryClient.invalidateQueries({ queryKey: ['chapters', variables.data.episodeId] })
      queryClient.invalidateQueries({ queryKey: ['episode'] })
    },
  })
}

export const useUpdateChapter = createUpdateHook({
  listKey: 'chapters',
  singleKey: 'chapter',
  mutationFn: updateChapter,
  additionalInvalidation: ['episode'],
})

export const useDeleteChapter = createDeleteHook({
  listKey: 'chapters',
  mutationFn: deleteChapter,
  additionalInvalidation: ['episode'],
})

/** Mutation хук для копирования глав между эпизодами */
export function useCopyChaptersToEpisodes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      sourceEpisodeId,
      targetEpisodeIds,
      chapterTypes,
    }: {
      sourceEpisodeId: string
      targetEpisodeIds: string[]
      chapterTypes?: ChapterType[]
    }) => {
      return copyChaptersToEpisodes(sourceEpisodeId, targetEpisodeIds, chapterTypes)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters'] })
      queryClient.invalidateQueries({ queryKey: ['episode'] })
    },
  })
}

// ============================================================
// WatchProgress — composite key (animeId_episodeId)
// ============================================================

/** Query хук для useFindUnique WatchProgress */
export function useFindUniqueWatchProgress(
  args: { where: { animeId_episodeId: { animeId: string; episodeId: string } }; include?: Prisma.WatchProgressInclude },
  options?: { enabled?: boolean },
) {
  const { animeId, episodeId } = args.where.animeId_episodeId
  return useQuery({
    queryKey: ['watchProgress', animeId, episodeId],
    queryFn: () => findUniqueWatchProgress(animeId, episodeId, args.include),
    enabled: options?.enabled,
  })
}

/** Mutation хук для upsert WatchProgress */
export function useUpsertWatchProgress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      where,
      create,
      update,
    }: {
      where: { animeId_episodeId: { animeId: string; episodeId: string } }
      create: Prisma.WatchProgressUncheckedCreateInput
      update: Prisma.WatchProgressUncheckedUpdateInput
    }) => {
      const { animeId, episodeId } = where.animeId_episodeId
      return upsertWatchProgress(animeId, episodeId, { ...create, ...update })
    },
    onSuccess: (_result, variables) => {
      const { animeId, episodeId } = variables.where.animeId_episodeId
      // Инвалидируем кэш watchProgress
      queryClient.invalidateQueries({ queryKey: ['watchProgress', animeId, episodeId] })
      // Инвалидируем кэш anime чтобы обновить кнопку "Продолжить смотреть"
      queryClient.invalidateQueries({ queryKey: ['anime', animeId] })
    },
    onError: (error) => {
      console.error('[useUpsertWatchProgress] Error:', error)
    },
  })
}

// ============================================================
// Settings — singleton pattern
// ============================================================

/** Query хук для useFindUnique Settings */
export function useFindUniqueSettings(
  args: { where: { id: string }; include?: object },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['settings', args.where.id, args.include],
    queryFn: () => (args.include ? getSettingsWithProfile() : getSettings()),
    enabled: options?.enabled,
  })
}

/** Mutation хук для upsert Settings */
export function useUpsertSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      create: _create,
      update,
    }: {
      create: Prisma.SettingsCreateInput
      update: Prisma.SettingsUpdateInput
    }) => upsertSettings(update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

/** Mutation хук для обновления Settings */
export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ where: _where, data }: { where: { id: string }; data: Prisma.SettingsUpdateInput }) =>
      updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

/** Mutation хук для установки профиля по умолчанию в Settings */
export function useSetDefaultProfileInSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (profileId: string | null) => setDefaultProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

// ============================================================
// FilterCounts — faceted search counts
// ============================================================

/** Query хук для получения счётчиков фильтров (faceted search) */
export function useFilterCounts() {
  return useQuery({
    queryKey: ['filterCounts'],
    queryFn: () => getFilterCounts(),
    staleTime: 30_000, // 30 секунд — данные меняются редко
    gcTime: 60_000, // 1 минута в кэше
  })
}

export type { FilterCounts }

// ============================================================
// AvailableFilters — только сущности, которые есть в библиотеке
// ============================================================

/** Query хук для получения жанров, которые есть в библиотеке */
export function useAvailableGenres() {
  return useQuery({
    queryKey: ['availableGenres'],
    queryFn: () => getAvailableGenres(),
    staleTime: 60_000, // 1 минута
    gcTime: 300_000, // 5 минут в кэше
  })
}

/** Query хук для получения студий, которые есть в библиотеке */
export function useAvailableStudios() {
  return useQuery({
    queryKey: ['availableStudios'],
    queryFn: () => getAvailableStudios(),
    staleTime: 60_000,
    gcTime: 300_000,
  })
}

/** Query хук для получения локальных озвучек из AudioTrack.dubGroup */
export function useLocalDubGroups() {
  return useQuery({
    queryKey: ['localDubGroups'],
    queryFn: () => getLocalDubGroups(),
    staleTime: 60_000,
    gcTime: 300_000,
  })
}

/** Query хук для получения режиссёров, которые есть в библиотеке (v0.19.0) */
export function useAvailableDirectors() {
  return useQuery({
    queryKey: ['availableDirectors'],
    queryFn: () => getAvailableDirectors(),
    staleTime: 60_000,
    gcTime: 300_000,
  })
}

export type { AvailableItem }

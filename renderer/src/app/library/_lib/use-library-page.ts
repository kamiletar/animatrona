'use client'

/**
 * Хук со всей логикой страницы библиотеки
 * Управляет state, фильтрами, запросами и handlers
 *
 * v0.28.9: Переход на клиентский поиск Fuse.js через useSearchIds
 */

import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useSearchIds } from '@/app/_hooks/use-search'
import { useDebounce, useFilterParams } from '@/components/library'
import { toaster } from '@/components/ui/toaster'
import type { WatchStatus } from '@/generated/prisma'
import { useAvailableGenres, useFilterCounts, useFindManyAnime, useLocalDubGroups, useUpdateAnime } from '@/lib/hooks'

import { groupAnimeByFranchise } from './group-anime-by-franchise'
import type { AnimeWithFranchise, ViewMode } from './types'
import { VIEW_MODE_STORAGE_KEY } from './types'

/**
 * Основной хук страницы библиотеки
 */
export function useLibraryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const updateAnimeMutation = useUpdateAnime()

  // ===== Диалоги =====
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedAnimeId, setSelectedAnimeId] = useState<string | null>(null)

  // Drag & Drop импорт
  const [droppedFolderPath, setDroppedFolderPath] = useState<string | null>(null)

  // Открытие ImportWizard по query параметру (из WelcomeDialog)
  useEffect(() => {
    if (searchParams.get('openImport') === 'true') {
      setIsImportOpen(true)
      // Убираем параметр из URL чтобы не открывался повторно при обновлении
      router.replace('/library', { scroll: false })
    }
  }, [searchParams, router])

  /** Обработчик drop папки */
  const handleFolderDrop = useCallback((folderPath: string) => {
    setDroppedFolderPath(folderPath)
    setIsImportOpen(true)
  }, [])

  /** Обработчик закрытия диалога импорта */
  const handleImportOpenChange = useCallback((open: boolean) => {
    setIsImportOpen(open)
    // Сбрасываем droppedFolderPath при закрытии
    if (!open) {
      setDroppedFolderPath(null)
    }
  }, [])

  // ===== Режим отображения =====
  const [viewMode, setViewMode] = useState<ViewMode>('individual')

  // Восстановление режима из localStorage
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY) as ViewMode | null
    if (saved === 'individual' || saved === 'franchise') {
      setViewMode(saved)
    }
  }, [])

  // Сохранение режима в localStorage
  const handleViewModeChange = useCallback((details: { value: string | null }) => {
    const mode = (details.value || 'individual') as ViewMode
    setViewMode(mode)
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
  }, [])

  // ===== URL sync для фильтров =====
  const { params: urlParams, setParam, setParams, resetParams } = useFilterParams()

  // Локальный state для поиска (с debounce)
  const [searchInput, setSearchInput] = useState(urlParams.search)
  const debouncedSearch = useDebounce(searchInput, 250) // 250ms debounce для поиска

  // Клиентский поиск через Fuse.js — возвращает ID аниме для WHERE IN
  const searchIds = useSearchIds(debouncedSearch, 0) // 0ms — debounce уже применён выше

  // Синхронизация debouncedSearch с URL
  useEffect(() => {
    if (debouncedSearch !== urlParams.search) {
      setParam('search', debouncedSearch)
    }
  }, [debouncedSearch, urlParams.search, setParam])

  // Синхронизация URL → локальный state при навигации
  // Намеренно исключаем searchInput и debouncedSearch из deps — иначе бесконечный цикл
  useEffect(() => {
    if (urlParams.search !== searchInput && urlParams.search !== debouncedSearch) {
      setSearchInput(urlParams.search)
    }
  }, [urlParams.search])

  // ===== Данные для фильтров =====
  const { data: genresData } = useAvailableGenres()
  // v0.28.0: useAvailableStudios удалён — студии теперь в AnimeManifest (IPFS)
  const { data: dubGroupsData } = useLocalDubGroups()
  // v0.28.0: useAvailableDirectors удалён — режиссёры теперь в AnimeManifest (IPFS)

  // Faceted counts для фильтров
  const { data: filterCounts, isLoading: isLoadingCounts } = useFilterCounts()

  // ===== Загрузка аниме с фильтрами =====
  const {
    status,
    yearMin,
    yearMax,
    genre,
    studio,
    fandubber,
    director,
    episodesMin,
    episodesMax,
    resolution,
    bitDepth,
    sortBy,
    watchStatus: watchStatusFilter,
  } = urlParams

  const {
    data: animesData,
    isLoading,
    refetch,
  } = useFindManyAnime({
    where: {
      // FTS5 поиск через searchAnimeIds
      ...(searchIds !== null && {
        id: { in: searchIds },
      }),
      ...(status && { status: status as 'ONGOING' | 'COMPLETED' | 'ANNOUNCED' }),
      // Год — диапазон от-до
      ...((yearMin || yearMax) && {
        year: {
          ...(yearMin && { gte: parseInt(yearMin) }),
          ...(yearMax && { lte: parseInt(yearMax) }),
        },
      }),
      ...(genre && {
        genres: {
          some: { genreId: genre },
        },
      }),
      // Расширенные фильтры
      ...(studio && {
        studios: {
          some: { studioId: studio },
        },
      }),
      // Озвучка — ищем через локальные аудиодорожки (AudioTrack.dubGroup)
      ...(fandubber && {
        episodes: {
          some: {
            audioTracks: {
              some: { dubGroup: fandubber },
            },
          },
        },
      }),
      // Режиссёр
      ...(director && {
        persons: {
          some: {
            personId: director,
            role: 'DIRECTOR',
          },
        },
      }),
      ...((episodesMin || episodesMax) && {
        episodeCount: {
          ...(episodesMin && { gte: parseInt(episodesMin) }),
          ...(episodesMax && { lte: parseInt(episodesMax) }),
        },
      }),
      // Фильтры качества
      ...(resolution === '4k' && {
        episodes: { some: { videoHeight: { gte: 2160 } } },
      }),
      ...(resolution === '1080p' && {
        episodes: { some: { AND: [{ videoHeight: { gte: 1080 } }, { videoHeight: { lt: 2160 } }] } },
      }),
      ...(resolution === '720p' && {
        episodes: { some: { videoHeight: { lt: 1080 } } },
      }),
      ...(bitDepth === '10' && {
        episodes: { some: { videoBitDepth: { gte: 10 } } },
      }),
      ...(bitDepth === '8' && {
        episodes: { some: { videoBitDepth: 8 } },
      }),
      // Статус просмотра
      ...(watchStatusFilter && {
        watchStatus: watchStatusFilter as WatchStatus,
      }),
    },
    select: {
      id: true,
      name: true,
      originalName: true,
      year: true,
      status: true,
      rating: true,
      watchStatus: true,
      folderPath: true,
      shikimoriId: true,
      poster: { select: { path: true } },
      genres: {
        include: {
          genre: true,
        },
      },
      franchise: true,
      // Связи с незагруженными аниме (targetAnimeId = null)
      sourceRelations: {
        where: { targetAnimeId: null },
        select: {
          id: true,
          targetShikimoriId: true,
          targetName: true,
          targetPosterUrl: true,
          targetYear: true,
          targetKind: true,
          relationKind: true,
        },
      },
      _count: {
        select: { episodes: true },
      },
    },
    // Сортировка
    orderBy: (() => {
      switch (sortBy) {
        case 'title':
          return { name: 'asc' }
        case '-title':
          return { name: 'desc' }
        case '-updatedAt':
          return { updatedAt: 'desc' }
        case 'year':
          return { year: 'asc' }
        case '-year':
          return { year: 'desc' }
        case '-rating':
          return { rating: 'desc' }
        case '-episodeCount':
          return { episodeCount: 'desc' }
        default:
          return { updatedAt: 'desc' }
      }
    })(),
  })

  // Запрос для ВСЕХ shikimoriId (без фильтров) — нужен для корректной группировки по франшизам
  const { data: allAnimeShikimoriIds } = useFindManyAnime({
    select: { shikimoriId: true },
  })

  // Множество всех загруженных shikimoriId для передачи в groupAnimeByFranchise
  const allLoadedShikimoriIds = useMemo(
    () => new Set((allAnimeShikimoriIds || []).map((a) => a.shikimoriId).filter((id): id is number => id != null)),
    [allAnimeShikimoriIds],
  )

  // Преобразуем _count.episodes в episodeCount для AnimeGrid
  const animes: AnimeWithFranchise[] = useMemo(
    () =>
      (animesData || []).map((anime) => ({
        ...anime,
        episodeCount: (anime as unknown as { _count?: { episodes: number } })._count?.episodes ?? 0,
      })),
    [animesData],
  )

  const genres = genresData || []

  // Группировка аниме по франшизам
  const { franchiseGroups, standAloneAnimes } = useMemo(
    () => groupAnimeByFranchise(animes, allLoadedShikimoriIds),
    [animes, allLoadedShikimoriIds],
  )

  // ===== Handlers =====
  const handleReset = useCallback(() => {
    setSearchInput('')
    resetParams()
  }, [resetParams])

  const handleCardPlay = useCallback(
    (id: string) => {
      router.push(`/library/${id}`)
    },
    [router],
  )

  const handleCardExport = useCallback(
    (id: string) => {
      router.push(`/library/${id}?openExport=true`)
    },
    [router],
  )

  const handleCardRefreshMetadata = useCallback(
    (id: string) => {
      router.push(`/library/${id}`)
      toaster.info({ title: 'Откройте меню аниме и нажмите "Обновить метаданные"' })
    },
    [router],
  )

  const handleCardDelete = useCallback((id: string) => {
    setSelectedAnimeId(id)
    setIsDeleteDialogOpen(true)
  }, [])

  /**
   * Изменить статус просмотра аниме
   */
  const handleWatchStatusChange = useCallback(
    async (id: string, newStatus: WatchStatus) => {
      try {
        await updateAnimeMutation.mutateAsync({
          where: { id },
          data: { watchStatus: newStatus },
        })

        // Инвалидируем кэш
        await queryClient.invalidateQueries({ queryKey: ['Anime'] })

        toaster.success({ title: 'Статус обновлён' })
      } catch (error) {
        toaster.error({
          title: 'Ошибка',
          description: error instanceof Error ? error.message : 'Не удалось обновить статус',
        })
      }
    },
    [updateAnimeMutation, queryClient],
  )

  // Получаем выбранное аниме для диалога удаления
  const selectedAnime = selectedAnimeId ? animes.find((a) => a.id === selectedAnimeId) : null

  // Проверка: пустая библиотека без фильтров?
  const isEmptyWithoutFilters = !isLoading
    && animes.length === 0
    && !searchInput
    && !status
    && !yearMin
    && !yearMax
    && !genre
    && !studio
    && !fandubber
    && !director
    && !watchStatusFilter

  return {
    // State
    isImportOpen,
    setIsImportOpen,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    selectedAnimeId,
    setSelectedAnimeId,
    droppedFolderPath,
    viewMode,

    // Данные
    animes,
    genres,
    franchiseGroups,
    standAloneAnimes,
    isLoading,
    isEmptyWithoutFilters,
    selectedAnime,

    // Фильтры
    searchInput,
    setSearchInput,
    urlParams,
    setParam,
    setParams,
    filterCounts,
    isLoadingCounts,
    // v0.28.0: studiosData и directorsData удалены — данные теперь в AnimeManifest (IPFS)
    dubGroupsData: dubGroupsData || [],

    // Handlers
    handleFolderDrop,
    handleImportOpenChange,
    handleViewModeChange,
    handleReset,
    handleCardPlay,
    handleCardExport,
    handleCardRefreshMetadata,
    handleCardDelete,
    handleWatchStatusChange,
    refetch,
  }
}

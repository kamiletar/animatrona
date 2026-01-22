'use client'

import { Box, Button, Heading, HStack, Icon, SegmentGroup, Spinner, Text, VStack } from '@chakra-ui/react'
import { useQueryClient } from '@tanstack/react-query'
import nextDynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { LuGrid2X2, LuImport, LuLayers, LuRefreshCw } from 'react-icons/lu'

import { searchAnimeIds } from '@/app/_actions/search.action'
import { Header } from '@/components/layout'
import {
  AnimeFilters,
  AnimeGrid,
  DropZone,
  EmptyLibraryState,
  FranchiseCard,
  useDebounce,
  useFilterParams,
} from '@/components/library'
import { toaster } from '@/components/ui/toaster'
import type { WatchStatus } from '@/generated/prisma'
import {
  useAvailableDirectors,
  useAvailableGenres,
  useAvailableStudios,
  useFilterCounts,
  useFindManyAnime,
  useLocalDubGroups,
  useUpdateAnime,
} from '@/lib/hooks'
import { toMediaUrl } from '@/lib/media-url'

/** Тип режима отображения */
type ViewMode = 'individual' | 'franchise'

/** Ключ localStorage для сохранения режима */
const VIEW_MODE_STORAGE_KEY = 'animatrona:library:viewMode'

/** Связь с незагруженным аниме */
interface MissingAnimeRelation {
  id: string
  targetShikimoriId: number
  targetName: string | null
  targetPosterUrl: string | null
  targetYear: number | null
  targetKind: string | null
  relationKind: string
}

/** Тип аниме с данными франшизы */
interface AnimeWithFranchise {
  id: string
  name: string
  originalName?: string | null
  year?: number | null
  status: 'ONGOING' | 'COMPLETED' | 'ANNOUNCED'
  episodeCount: number
  rating?: number | null
  poster?: { path: string } | null
  genres?: { genre: { name: string } }[]
  franchise?: { id: string; name: string } | null
  /** Статус просмотра */
  watchStatus?: WatchStatus
  /** Связи с другими аниме (для определения отсутствующих) */
  sourceRelations?: MissingAnimeRelation[]
  /** Путь к папке аниме в библиотеке */
  folderPath?: string | null
  /** Shikimori ID для сверки с незагруженными */
  shikimoriId?: number | null
}

/** Группа аниме по франшизе */
interface FranchiseGroup {
  franchise: { id: string; name: string }
  animes: AnimeWithFranchise[]
  /** Незагруженные аниме франшизы (только для отображения) */
  missingAnimes: MissingAnimeRelation[]
}

/**
 * Группирует аниме по франшизам
 * Возвращает группы франшиз и одиночные аниме без франшизы
 * Собирает незагруженные аниме из sourceRelations
 *
 * @param animes — отфильтрованные аниме для отображения
 * @param allLoadedShikimoriIds — shikimoriId ВСЕХ загруженных аниме (без фильтров)
 *                                нужно для корректного определения missingAnimes
 */
function groupAnimeByFranchise(
  animes: AnimeWithFranchise[],
  allLoadedShikimoriIds: Set<number>,
): {
  franchiseGroups: FranchiseGroup[]
  standAloneAnimes: AnimeWithFranchise[]
} {
  const franchiseMap = new Map<string, FranchiseGroup>()
  const standAloneAnimes: AnimeWithFranchise[] = []

  // Используем переданный Set всех загруженных shikimoriId
  // Это позволяет корректно определять missing даже при активных фильтрах
  const loadedShikimoriIds = allLoadedShikimoriIds

  for (const anime of animes) {
    if (anime.franchise) {
      const existing = franchiseMap.get(anime.franchise.id)
      if (existing) {
        existing.animes.push(anime)
      } else {
        franchiseMap.set(anime.franchise.id, {
          franchise: anime.franchise,
          animes: [anime],
          missingAnimes: [],
        })
      }
    } else {
      standAloneAnimes.push(anime)
    }
  }

  // Собираем незагруженные аниме из sourceRelations
  for (const anime of animes) {
    if (!anime.franchise || !anime.sourceRelations) {continue}

    const group = franchiseMap.get(anime.franchise.id)
    if (!group) {continue}

    // Фильтруем связи: только незагруженные и с валидным targetName
    const missingFromThisAnime = anime.sourceRelations.filter((rel) => {
      // Пропускаем если аниме уже загружено (по Shikimori ID)
      if (loadedShikimoriIds.has(rel.targetShikimoriId)) {return false}
      // Пропускаем если уже есть в missingAnimes группы (дедупликация)
      if (group.missingAnimes.some((m) => m.targetShikimoriId === rel.targetShikimoriId)) {return false}
      // Пропускаем если нет названия
      if (!rel.targetName) {return false}
      return true
    })

    group.missingAnimes.push(...missingFromThisAnime)
  }

  // Сортируем группы по названию франшизы
  const franchiseGroups = Array.from(franchiseMap.values()).sort((a, b) =>
    a.franchise.name.localeCompare(b.franchise.name)
  )

  return { franchiseGroups, standAloneAnimes }
}

// Dynamic imports для диалогов — загружаются только при открытии
const ImportWizardDialog = nextDynamic(
  () => import('@/components/import/ImportWizardDialog').then((mod) => mod.ImportWizardDialog),
  { ssr: false, loading: () => <Spinner size="lg" color="purple.500" /> },
)

const DeleteAnimeDialog = nextDynamic(
  () => import('@/components/library/DeleteAnimeDialog').then((mod) => mod.DeleteAnimeDialog),
  { ssr: false, loading: () => <Spinner size="lg" color="purple.500" /> },
)

// Отключаем статическую генерацию для страницы библиотеки
export const dynamic = 'force-dynamic'

/** Пропсы для FranchiseView */
interface FranchiseViewProps {
  franchiseGroups: FranchiseGroup[]
  standAloneAnimes: AnimeWithFranchise[]
  isLoading?: boolean
  /** Колбэки для меню карточек */
  onPlay?: (id: string) => void
  onExport?: (id: string) => void
  onRefreshMetadata?: (id: string) => void
  onDelete?: (id: string) => void
  /** Колбэк для изменения статуса просмотра */
  onWatchStatusChange?: (id: string, status: WatchStatus) => void
}

/**
 * Компонент для отображения аниме сгруппированных по франшизам
 */
function FranchiseView({
  franchiseGroups,
  standAloneAnimes,
  isLoading,
  onPlay,
  onExport,
  onRefreshMetadata,
  onDelete,
  onWatchStatusChange,
}: FranchiseViewProps) {
  if (isLoading) {
    return (
      <VStack gap={4} align="stretch">
        {Array.from({ length: 4 }).map((_, i) => (
          <Box key={i} bg="bg.panel" borderRadius="lg" h="100px" animation="pulse 2s infinite" />
        ))}
      </VStack>
    )
  }

  const hasContent = franchiseGroups.length > 0 || standAloneAnimes.length > 0

  if (!hasContent) {
    return (
      <Box textAlign="center" py={16} px={4} borderRadius="xl" border="2px dashed" borderColor="border.subtle">
        <VStack gap={4}>
          <Icon as={LuLayers} boxSize={16} color="fg.subtle" />
          <Box>
            <Text fontSize="xl" fontWeight="semibold" color="fg.muted">
              Аниме не найдено
            </Text>
            <Text color="fg.subtle">Попробуйте изменить параметры поиска или добавьте новое аниме</Text>
          </Box>
        </VStack>
      </Box>
    )
  }

  return (
    <VStack gap={4} align="stretch">
      {/* Франшизы */}
      {franchiseGroups.map((group) => {
        // Первое аниме — главное (может быть TV сериал)
        const mainAnime = group.animes[0]
        const relatedAnimes = group.animes.slice(1)

        return (
          <FranchiseCard
            key={group.franchise.id}
            name={group.franchise.name}
            mainAnime={{
              id: mainAnime.id,
              title: mainAnime.name,
              posterUrl: toMediaUrl(mainAnime.poster?.path) || undefined,
              year: mainAnime.year,
              episodesTotal: mainAnime.episodeCount,
              episodesLoaded: mainAnime.episodeCount,
            }}
            relatedAnimes={relatedAnimes.map((anime) => ({
              id: anime.id,
              title: anime.name,
              posterUrl: toMediaUrl(anime.poster?.path) || undefined,
              year: anime.year,
              episodesTotal: anime.episodeCount,
              episodesLoaded: anime.episodeCount,
            }))}
            missingAnimes={group.missingAnimes.map((rel) => ({
              shikimoriId: rel.targetShikimoriId,
              title: rel.targetName || 'Без названия',
              posterUrl: rel.targetPosterUrl,
              year: rel.targetYear,
              kind: rel.targetKind,
            }))}
            defaultOpen={false}
          />
        )
      })}

      {/* Одиночные аниме без франшизы */}
      {standAloneAnimes.length > 0 && (
        <>
          {franchiseGroups.length > 0 && (
            <Text color="fg.subtle" fontSize="sm" mt={4}>
              Без франшизы ({standAloneAnimes.length})
            </Text>
          )}
          <AnimeGrid
            animes={standAloneAnimes}
            onPlay={onPlay}
            onExport={onExport}
            onRefreshMetadata={onRefreshMetadata}
            onDelete={onDelete}
            onWatchStatusChange={onWatchStatusChange}
          />
        </>
      )}
    </VStack>
  )
}

/**
 * Внутренний компонент страницы библиотеки
 * Выделен для Suspense boundary (useSearchParams требует Suspense)
 */
function LibraryPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const updateAnimeMutation = useUpdateAnime()

  // Диалоги
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
  const handleFolderDrop = (folderPath: string) => {
    setDroppedFolderPath(folderPath)
    setIsImportOpen(true)
  }

  /** Обработчик закрытия диалога импорта */
  const handleImportOpenChange = (open: boolean) => {
    setIsImportOpen(open)
    // Сбрасываем droppedFolderPath при закрытии
    if (!open) {
      setDroppedFolderPath(null)
    }
  }

  // Режим отображения (individual | franchise)
  const [viewMode, setViewMode] = useState<ViewMode>('individual')

  // Восстановление режима из localStorage
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY) as ViewMode | null
    if (saved === 'individual' || saved === 'franchise') {
      setViewMode(saved)
    }
  }, [])

  // Сохранение режима в localStorage
  const handleViewModeChange = (details: { value: string | null }) => {
    const mode = (details.value || 'individual') as ViewMode
    setViewMode(mode)
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
  }

  // URL sync для фильтров (v0.18.0)
  const { params: urlParams, setParam, setParams, resetParams } = useFilterParams()

  // Локальный state для поиска (с debounce)
  const [searchInput, setSearchInput] = useState(urlParams.search)
  const debouncedSearch = useDebounce(searchInput, 250) // 250ms debounce для поиска

  // FTS5 поиск — возвращает ID аниме для WHERE IN (v0.19.0)
  const [searchIds, setSearchIds] = useState<string[] | null>(null)

  // Вызов FTS5 поиска при изменении debouncedSearch
  useEffect(() => {
    if (!debouncedSearch) {
      setSearchIds(null)
      return
    }

    searchAnimeIds(debouncedSearch).then(setSearchIds)
  }, [debouncedSearch])

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

  // Деструктуризация для удобства
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

  // Загрузка данных для фильтров
  // Загружаем только те жанры/студии/озвучки/режиссёры, которые есть в библиотеке (v0.19.0)
  const { data: genresData } = useAvailableGenres()
  const { data: studiosData } = useAvailableStudios()
  const { data: dubGroupsData } = useLocalDubGroups()
  const { data: directorsData } = useAvailableDirectors()

  // Faceted counts для фильтров (v0.18.0)
  const { data: filterCounts, isLoading: isLoadingCounts } = useFilterCounts()

  // Загрузка аниме с фильтрами
  const {
    data: animesData,
    isLoading,
    refetch,
  } = useFindManyAnime({
    where: {
      // FTS5 поиск через searchAnimeIds (v0.19.0)
      // Используем id IN (...) вместо contains для регистронезависимого Unicode поиска
      ...(searchIds !== null && {
        id: { in: searchIds },
      }),
      ...(status && { status: status as 'ONGOING' | 'COMPLETED' | 'ANNOUNCED' }),
      // Год — диапазон от-до (v0.19.0)
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
      // Расширенные фильтры (v0.5.1)
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
      // Режиссёр (v0.19.0)
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
      // Фильтры качества (v0.6.35)
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
      // Статус просмотра (v0.9.0)
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
    // Сортировка (v0.7.0)
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
  // Позволяет определить missing аниме даже когда часть франшизы отфильтрована
  const { data: allAnimeShikimoriIds } = useFindManyAnime({
    select: { shikimoriId: true },
  })

  // Множество всех загруженных shikimoriId для передачи в groupAnimeByFranchise
  const allLoadedShikimoriIds = useMemo(
    () =>
      new Set(
        (allAnimeShikimoriIds || [])
          .map((a) => a.shikimoriId)
          .filter((id): id is number => id != null),
      ),
    [allAnimeShikimoriIds],
  )

  // Преобразуем _count.episodes в episodeCount для AnimeGrid
  const animes = (animesData || []).map((anime) => ({
    ...anime,
    episodeCount: (anime as unknown as { _count?: { episodes: number } })._count?.episodes ?? 0,
  }))
  const genres = genresData || []

  // Группировка аниме по франшизам
  // Передаём allLoadedShikimoriIds для корректного определения missing при активных фильтрах
  const { franchiseGroups, standAloneAnimes } = groupAnimeByFranchise(animes, allLoadedShikimoriIds)

  const handleReset = () => {
    setSearchInput('')
    resetParams()
  }

  // Обработчики меню карточек аниме
  const handleCardPlay = (id: string) => {
    router.push(`/library/${id}`)
  }

  const handleCardExport = (id: string) => {
    // Для экспорта нужны полные данные, переходим на страницу аниме
    router.push(`/library/${id}?openExport=true`)
  }

  const handleCardRefreshMetadata = (id: string) => {
    // Для обновления метаданных переходим на страницу аниме
    router.push(`/library/${id}`)
    toaster.info({ title: 'Откройте меню аниме и нажмите "Обновить метаданные"' })
  }

  const handleCardDelete = (id: string) => {
    setSelectedAnimeId(id)
    setIsDeleteDialogOpen(true)
  }

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

  return (
    <DropZone onFolderDrop={handleFolderDrop}>
      <Box minH="100vh" bg="bg" color="fg">
        <Header title="Библиотека" />

        <Box p={6}>
          <VStack gap={6} align="stretch">
            {/* Заголовок и действия */}
            <HStack justify="space-between">
              <Box>
                <Heading size="lg">Библиотека аниме</Heading>
                <Text color="fg.subtle">{animes.length} тайтлов в коллекции</Text>
              </Box>
              <HStack gap={2}>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <Icon as={LuRefreshCw} mr={2} />
                  Обновить
                </Button>
                <Button colorPalette="purple" size="sm" onClick={() => setIsImportOpen(true)}>
                  <Icon as={LuImport} mr={2} />
                  Импорт видео
                </Button>
              </HStack>
            </HStack>

            {/* Фильтры и переключатель режима */}
            <HStack justify="space-between" align="start" flexWrap="wrap" gap={4}>
              <Box flex={1} minW="300px">
                <AnimeFilters
                  search={searchInput}
                  onSearchChange={setSearchInput}
                  status={status}
                  onStatusChange={(v) => setParam('status', v)}
                  yearMin={yearMin}
                  onYearMinChange={(v) => setParam('yearMin', v)}
                  yearMax={yearMax}
                  onYearMaxChange={(v) => setParam('yearMax', v)}
                  onYearRangeClear={() => setParams({ yearMin: '', yearMax: '' })}
                  genre={genre}
                  onGenreChange={(v) => setParam('genre', v)}
                  genres={genres}
                  // Расширенные фильтры (v0.5.1)
                  studio={studio}
                  onStudioChange={(v) => setParam('studio', v)}
                  studios={studiosData || []}
                  fandubber={fandubber}
                  onFandubberChange={(v) => setParam('fandubber', v)}
                  fandubbers={dubGroupsData || []}
                  director={director}
                  onDirectorChange={(v) => setParam('director', v)}
                  directors={directorsData || []}
                  episodesMin={episodesMin}
                  onEpisodesMinChange={(v) => setParam('episodesMin', v)}
                  episodesMax={episodesMax}
                  onEpisodesMaxChange={(v) => setParam('episodesMax', v)}
                  onEpisodesRangeClear={() => setParams({ episodesMin: '', episodesMax: '' })}
                  // Фильтры качества (v0.6.35)
                  resolution={resolution}
                  onResolutionChange={(v) => setParam('resolution', v)}
                  bitDepth={bitDepth}
                  onBitDepthChange={(v) => setParam('bitDepth', v)}
                  onQualityClear={() => setParams({ resolution: '', bitDepth: '' })}
                  // Сортировка (v0.7.0)
                  sortBy={sortBy}
                  onSortChange={(v) => setParam('sortBy', v)}
                  // Статус просмотра (v0.9.0)
                  watchStatus={watchStatusFilter}
                  onWatchStatusChange={(v) => setParam('watchStatus', v)}
                  onReset={handleReset}
                  // Количество результатов для mobile
                  resultCount={animes.length}
                  // Faceted counts (v0.18.0)
                  counts={filterCounts}
                  isLoadingCounts={isLoadingCounts}
                />
              </Box>

              {/* Переключатель режима отображения */}
              <SegmentGroup.Root value={viewMode} onValueChange={handleViewModeChange} size="sm">
                <SegmentGroup.Indicator />
                <SegmentGroup.Item value="individual">
                  <SegmentGroup.ItemText>
                    <HStack gap={1}>
                      <Icon as={LuGrid2X2} boxSize={4} />
                      <Text>По отдельности</Text>
                    </HStack>
                  </SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
                <SegmentGroup.Item value="franchise">
                  <SegmentGroup.ItemText>
                    <HStack gap={1}>
                      <Icon as={LuLayers} boxSize={4} />
                      <Text>По франшизам</Text>
                    </HStack>
                  </SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
              </SegmentGroup.Root>
            </HStack>

            {/* Сетка аниме — зависит от режима отображения */}
            {/* Показываем EmptyLibraryState если библиотека пуста и нет фильтров */}
            {!isLoading
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
              ? <EmptyLibraryState onImport={() => setIsImportOpen(true)} />
              : viewMode === 'individual'
              ? (
                <AnimeGrid
                  animes={animes}
                  isLoading={isLoading}
                  onPlay={handleCardPlay}
                  onExport={handleCardExport}
                  onRefreshMetadata={handleCardRefreshMetadata}
                  onDelete={handleCardDelete}
                  onWatchStatusChange={handleWatchStatusChange}
                />
              )
              : (
                <FranchiseView
                  franchiseGroups={franchiseGroups}
                  standAloneAnimes={standAloneAnimes}
                  isLoading={isLoading}
                  onPlay={handleCardPlay}
                  onExport={handleCardExport}
                  onRefreshMetadata={handleCardRefreshMetadata}
                  onDelete={handleCardDelete}
                  onWatchStatusChange={handleWatchStatusChange}
                />
              )}
          </VStack>
        </Box>

        {/* Визард импорта видео */}
        <ImportWizardDialog
          open={isImportOpen}
          onOpenChange={handleImportOpenChange}
          initialFolderPath={droppedFolderPath}
        />

        {/* Диалог удаления аниме */}
        {selectedAnime && (
          <DeleteAnimeDialog
            open={isDeleteDialogOpen}
            onOpenChange={(open) => {
              setIsDeleteDialogOpen(open)
              if (!open) {setSelectedAnimeId(null)}
            }}
            anime={{
              id: selectedAnime.id,
              name: selectedAnime.name,
              episodeCount: selectedAnime.episodeCount,
              folderPath: selectedAnime.folderPath ?? null,
            }}
            onDeleted={() => {
              setSelectedAnimeId(null)
              refetch()
            }}
          />
        )}
      </Box>
    </DropZone>
  )
}

/**
 * Страница библиотеки аниме с Suspense boundary
 */
export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <Box minH="100vh" bg="bg" color="fg" display="flex" alignItems="center" justifyContent="center">
          <VStack gap={4}>
            <Spinner size="xl" color="purple.500" />
            <Text color="fg.muted">Загрузка библиотеки...</Text>
          </VStack>
        </Box>
      }
    >
      <LibraryPageContent />
    </Suspense>
  )
}

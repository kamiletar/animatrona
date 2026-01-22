'use client'

import { Box, Button, Icon, Spinner, Text, VStack } from '@chakra-ui/react'
import { useQueryClient } from '@tanstack/react-query'
import nextDynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { use, useCallback, useState } from 'react'
import { LuArrowLeft } from 'react-icons/lu'

import { updateAnime } from '@/app/_actions/anime.action'
import { syncAnimeRelations } from '@/app/_actions/anime-relation.action'
import { type ExtendedMetadataInput, saveExtendedMetadata } from '@/app/_actions/extended-metadata.action'
import { upsertFile } from '@/app/_actions/file.action'
import { syncFranchiseFromGraph, upsertFranchiseByShikimoriId } from '@/app/_actions/franchise.action'
import { Header } from '@/components/layout'
import { AboutTab, AnimeDetailTabs, AnimeHero, EpisodesTab, FranchiseTab, RelatedTab } from '@/components/library/anime-detail'
import { EpisodeNameEditor, VideoSection } from '@/components/library'
import { toaster } from '@/components/ui/toaster'
import type {
  Anime,
  AudioTrack,
  Chapter,
  Episode,
  File,
  Genre,
  GenreOnAnime,
  RelationKind,
  Season,
  SubtitleFont,
  SubtitleTrack,
  Theme,
  ThemeOnAnime,
  Video,
  WatchProgress,
  WatchStatus,
} from '@/generated/prisma'
import { useFindUniqueAnime, useUpdateAnime } from '@/lib/hooks'

// Dynamic imports для диалогов — загружаются только при открытии
const ImportWizardDialog = nextDynamic(
  () => import('@/components/import/ImportWizardDialog').then((mod) => mod.ImportWizardDialog),
  { ssr: false, loading: () => <Spinner size="lg" color="purple.500" /> }
)

const EditAnimeDialog = nextDynamic(
  () => import('@/components/library/EditAnimeDialog').then((mod) => mod.EditAnimeDialog),
  { ssr: false, loading: () => <Spinner size="lg" color="purple.500" /> }
)

const DeleteAnimeDialog = nextDynamic(
  () => import('@/components/library/DeleteAnimeDialog').then((mod) => mod.DeleteAnimeDialog),
  { ssr: false, loading: () => <Spinner size="lg" color="purple.500" /> }
)

const ExportSeriesDialog = nextDynamic(
  () => import('@/components/library/ExportSeriesDialog').then((mod) => mod.ExportSeriesDialog),
  { ssr: false, loading: () => <Spinner size="lg" color="purple.500" /> }
)

const AddTracksWizardDialog = nextDynamic(
  () => import('@/components/add-tracks/AddTracksWizardDialog').then((mod) => mod.AddTracksWizardDialog),
  { ssr: false, loading: () => <Spinner size="lg" color="purple.500" /> }
)

/** Тип SubtitleTrack с шрифтами */
type SubtitleTrackWithFonts = SubtitleTrack & {
  fonts: SubtitleFont[]
}

/** Тип Episode с дополнительными полями для карточек и экспорта */
type EpisodeWithDetails = Episode & {
  thumbnailPaths: string | null
  screenshotPaths: string | null
  audioTracks: AudioTrack[]
  subtitleTracks: SubtitleTrackWithFonts[]
  chapters: Chapter[]
  season: Season
  /** Настройки кодирования (v0.9.0) */
  encodingSettingsJson: string | null
  sourceSize: bigint | null
  transcodedSize: bigint | null
}

/** Тип Anime с включёнными связями */
type AnimeWithRelations = Anime & {
  genres: (GenreOnAnime & { genre: Genre })[]
  themes: (ThemeOnAnime & { theme: Theme })[]
  episodes: EpisodeWithDetails[]
  seasons: Season[]
  watchProgress: WatchProgress[]
  poster: File | null
  videos: Video[]
}

// Отключаем статическую генерацию для динамической страницы
export const dynamic = 'force-dynamic'

interface AnimePageProps {
  params: Promise<{ id: string }>
}

/**
 * Страница деталей аниме
 *
 * Редизайн v0.17.0:
 * - Hero section с blurred background
 * - Табы (Эпизоды default, О сериале, Связанные, Видео)
 * - Compact action menu
 */
export default function AnimePage({ params }: AnimePageProps) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const updateAnimeMutation = useUpdateAnime()

  // Диалоги
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isAddTracksDialogOpen, setIsAddTracksDialogOpen] = useState(false)
  const [isEpisodeNameEditorOpen, setIsEpisodeNameEditorOpen] = useState(false)
  const [importAnimeInfo, setImportAnimeInfo] = useState<{ shikimoriId: number; name: string | null } | null>(null)
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false)

  const { data, isLoading } = useFindUniqueAnime({
    where: { id },
    include: {
      genres: {
        include: {
          genre: true,
        },
      },
      themes: {
        include: {
          theme: true,
        },
      },
      episodes: {
        orderBy: { number: 'asc' },
        include: {
          audioTracks: true,
          subtitleTracks: {
            include: {
              fonts: true,
            },
          },
          chapters: true,
          season: true,
        },
      },
      seasons: true,
      watchProgress: {
        orderBy: { lastWatchedAt: 'desc' },
      },
      poster: true,
      videos: {
        orderBy: { kind: 'asc' },
      },
    },
  })

  // Приводим тип к AnimeWithRelations после проверки
  const anime = data as AnimeWithRelations | null | undefined

  /**
   * Обновить метаданные из Shikimori и сохранить в БД
   * Загружает жанры, студии, режиссёров, озвучки, связи, франшизы и постер
   */
  const handleRefreshMetadata = useCallback(async () => {
    if (!anime?.shikimoriId || !window.electronAPI) {
      toaster.error({ title: 'Нет Shikimori ID' })
      return
    }

    setIsRefreshingMetadata(true)

    try {
      // 1. Загружаем расширенные метаданные из Shikimori
      const result = await window.electronAPI.shikimori.getExtended(anime.shikimoriId)

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Не удалось загрузить метаданные')
      }

      // Сохраняем метаданные в БД
      const input: ExtendedMetadataInput = {
        studios: result.data.studios,
        personRoles: result.data.personRoles,
        characterRoles: result.data.characterRoles,
        fandubbers: result.data.fandubbers,
        fansubbers: result.data.fansubbers,
        externalLinks: result.data.externalLinks,
        videos: result.data.videos || [],
        nextEpisodeAt: result.data.nextEpisodeAt,
        genres: result.data.genres,
      }

      const saveResult = await saveExtendedMetadata(anime.id, input)

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Не удалось сохранить метаданные')
      }

      // 2. Обновляем постер (если есть новый URL)
      const posterUrl = result.data.poster?.originalUrl || result.data.poster?.mainUrl
      if (posterUrl && anime.folderPath) {
        try {
          const posterResult = await window.electronAPI.shikimori.downloadPoster(
            posterUrl,
            String(anime.shikimoriId),
            { savePath: anime.folderPath },
          )

          if (posterResult.success && posterResult.localPath) {
            const fileRecord = await upsertFile({
              filename: posterResult.filename ?? `${anime.shikimoriId}.jpg`,
              path: posterResult.localPath,
              mimeType: posterResult.mimeType ?? 'image/jpeg',
              size: posterResult.size ?? 0,
              width: posterResult.width,
              height: posterResult.height,
              blurDataURL: posterResult.blurDataURL,
              category: 'POSTER',
              source: 'shikimori',
            })

            await updateAnime(anime.id, { posterId: fileRecord.id })
          }
        } catch (posterError) {
          // Ошибка постера не критична, продолжаем
          console.error('[handleRefreshMetadata] Poster error:', posterError)
        }
      }

      // 3. Синхронизируем связи
      if (window.electronAPI.franchise) {
        const relationsResult = await window.electronAPI.franchise.fetchRelated(anime.shikimoriId)

        if (relationsResult.success && relationsResult.data) {
          const { relatedAnimes, sourceAnime } = relationsResult.data

          // Сохраняем связи в БД
          const relations = relatedAnimes.map((related) => ({
            targetShikimoriId: related.shikimoriId,
            relationKind: related.relationKind as RelationKind,
            targetName: related.name,
            targetPosterUrl: related.posterUrl,
            targetYear: related.year,
            targetKind: related.kind,
          }))

          await syncAnimeRelations(anime.id, relations)

          // Привязываем к франшизе через старый API (если есть franchise ID)
          if (sourceAnime.franchise) {
            const franchise = await upsertFranchiseByShikimoriId(sourceAnime.franchise, { name: anime.name })
            await updateAnime(anime.id, { franchiseId: franchise.id })
          }
        }

        // 4. Загружаем полный граф франшизы (REST API)
        try {
          const graphResult = await window.electronAPI.franchise.fetchGraph(anime.shikimoriId)

          if (graphResult.success && graphResult.data?.graph) {
            const graph = graphResult.data.graph
            const rootShikimoriId = Math.min(...graph.nodes.map((n) => n.id))

            await syncFranchiseFromGraph(graph, rootShikimoriId, anime.name)
          }
        } catch (graphError) {
          // Ошибка графа не критична, продолжаем
          console.error('[handleRefreshMetadata] Graph error:', graphError)
        }
      }

      toaster.success({ title: 'Метаданные, постер и франшиза обновлены' })
    } catch (error) {
      toaster.error({
        title: 'Ошибка обновления',
        description: error instanceof Error ? error.message : 'Неизвестная ошибка',
      })
    } finally {
      setIsRefreshingMetadata(false)
    }
  }, [anime?.id, anime?.shikimoriId, anime?.name, anime?.folderPath])

  /**
   * Изменить статус просмотра
   */
  const handleWatchStatusChange = useCallback(
    async (newStatus: WatchStatus) => {
      if (!anime) {return}

      try {
        await updateAnimeMutation.mutateAsync({
          where: { id: anime.id },
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
    [anime, updateAnimeMutation, queryClient],
  )

  if (isLoading) {
    return (
      <Box minH="100vh" bg="bg" color="fg">
        <Header title="Загрузка..." />
        <Box p={6}>
          <Text color="fg.subtle">Загрузка информации...</Text>
        </Box>
      </Box>
    )
  }

  if (!anime) {
    return (
      <Box minH="100vh" bg="bg" color="fg">
        <Header title="Не найдено" />
        <Box p={6}>
          <Text color="fg.subtle">Аниме не найдено</Text>
          <Link href="/library">
            <Button mt={4} variant="outline">
              <Icon as={LuArrowLeft} mr={2} />
              Вернуться в библиотеку
            </Button>
          </Link>
        </Box>
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg="bg" color="fg">
      <Header title={anime.name} />

      <VStack gap={0} align="stretch">
        {/* Навигация */}
        <Box px={6} py={3}>
          <Link href="/library">
            <Button variant="ghost" size="sm">
              <Icon as={LuArrowLeft} mr={2} />
              Назад к библиотеке
            </Button>
          </Link>
        </Box>

        {/* Hero Section */}
        <AnimeHero
          name={anime.name}
          originalName={anime.originalName}
          year={anime.year}
          status={anime.status}
          watchStatus={anime.watchStatus}
          rating={anime.rating}
          ageRating={anime.ageRating}
          source={anime.source}
          duration={anime.duration}
          episodeCount={anime.episodeCount}
          loadedEpisodeCount={anime.episodes?.length || 0}
          genres={anime.genres}
          themes={anime.themes}
          posterPath={anime.poster?.path}
          watchProgress={anime.watchProgress}
          episodes={anime.episodes?.map((ep) => ({
            id: ep.id,
            number: ep.number,
            durationMs: ep.durationMs,
          }))}
          actionMenuProps={{
            onEdit: () => setIsEditDialogOpen(true),
            onExport: () => setIsExportDialogOpen(true),
            onAddTracks: () => setIsAddTracksDialogOpen(true),
            onDelete: () => setIsDeleteDialogOpen(true),
            hasShikimoriId: !!anime.shikimoriId,
            isRefreshingMetadata,
            onRefreshMetadata: handleRefreshMetadata,
            watchStatus: anime.watchStatus,
            onWatchStatusChange: handleWatchStatusChange,
          }}
        />

        {/* Табы с контентом */}
        <Box px={6} py={4}>
          <AnimeDetailTabs
            episodeCount={anime.episodes?.length || 0}
            hasVideos={!!anime.videos && anime.videos.length > 0}
            hasFranchise={!!anime.shikimoriId}
          >
            {{
              episodes: (
                <EpisodesTab
                  episodes={anime.episodes || []}
                  watchProgress={anime.watchProgress}
                  isBdRemux={anime.isBdRemux}
                  onEditNames={() => setIsEpisodeNameEditorOpen(true)}
                />
              ),
              about: (
                <AboutTab description={anime.description} animeId={anime.id} shikimoriId={anime.shikimoriId} />
              ),
              related: (
                <RelatedTab
                  animeId={anime.id}
                  shikimoriId={anime.shikimoriId}
                  relationsCheckedAt={anime.relationsCheckedAt}
                  onDownloadClick={(shikimoriId, name) => {
                    setImportAnimeInfo({ shikimoriId, name })
                    setIsImportDialogOpen(true)
                  }}
                />
              ),
              franchise: (
                <FranchiseTab
                  animeId={anime.id}
                  shikimoriId={anime.shikimoriId}
                  franchiseId={anime.franchiseId}
                  animeName={anime.name}
                />
              ),
              videos: <VideoSection videos={anime.videos || []} />,
            }}
          </AnimeDetailTabs>
        </Box>
      </VStack>

      {/* Диалоги */}
      <DeleteAnimeDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        anime={{
          id: anime.id,
          name: anime.name,
          episodeCount: anime.episodes?.length || 0,
          folderPath: anime.folderPath,
        }}
        onDeleted={() => router.push('/library')}
      />

      <EditAnimeDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} anime={anime} />

      <ExportSeriesDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        anime={{
          id: anime.id,
          name: anime.name,
          year: anime.year,
          posterPath: anime.poster?.path,
          episodes: anime.episodes || [],
          // Для определения номера сезона во франшизе
          shikimoriId: anime.shikimoriId,
          franchiseId: anime.franchiseId,
        }}
      />

      <ImportWizardDialog
        open={isImportDialogOpen}
        onOpenChange={(open) => {
          setIsImportDialogOpen(open)
          if (!open) {
            setImportAnimeInfo(null)
          }
        }}
        preselectedShikimoriId={importAnimeInfo?.shikimoriId}
        preselectedName={importAnimeInfo?.name ?? undefined}
      />

      <AddTracksWizardDialog
        open={isAddTracksDialogOpen}
        onOpenChange={setIsAddTracksDialogOpen}
        animeId={anime.id}
        animeName={anime.name}
        animeFolderPath={anime.folderPath ?? ''}
        episodes={
          anime.episodes?.map((ep) => ({
            id: ep.id,
            number: ep.number,
            transcodedPath: ep.transcodedPath,
          })) || []
        }
      />

      <EpisodeNameEditor
        open={isEpisodeNameEditorOpen}
        onOpenChange={setIsEpisodeNameEditorOpen}
        episodes={
          anime.episodes?.map((ep) => ({
            id: ep.id,
            number: ep.number,
            name: ep.name,
          })) || []
        }
      />
    </Box>
  )
}

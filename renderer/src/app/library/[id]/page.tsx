'use client'

import { Box, Button, Icon, Spinner, Text, VStack } from '@chakra-ui/react'
import { useQueryClient } from '@tanstack/react-query'
import nextDynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { use, useCallback, useState } from 'react'
import { LuArrowLeft } from 'react-icons/lu'

import { updateAnime } from '@/app/_actions/anime.action'
import { createManyChapters, deleteChaptersByEpisodeId } from '@/app/_actions/chapter.action'
import { syncAnimeRelations } from '@/app/_actions/anime-relation.action'
import { saveGenresAndThemes, type ShikimoriGenreInput } from '@/app/_actions/genre.action'
import { upsertFile } from '@/app/_actions/file.action'
import { syncFranchiseFromGraph, upsertFranchiseByShikimoriId } from '@/app/_actions/franchise.action'
import { Header } from '@/components/layout'
import { AboutTab, AnimeDetailTabs, AnimeHero, EpisodesTab, FranchiseTab, RelatedTab, TracksTab } from '@/components/library/anime-detail'
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
  WatchProgress,
  WatchStatus,
} from '@/generated/prisma'
// v0.28.0: Video модель удалена, видео трейлеры теперь в AnimeManifest
import { useFindUniqueAnime, useUpdateAnime } from '@/lib/hooks'
import { toPlayableUrl } from '@/lib/media-url'
import { useAnimeManifest } from '@/lib/hooks/index'

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
  // v0.28.0: videos удалены из БД, теперь в AnimeManifest
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
  const [isPublishingToTracker, setIsPublishingToTracker] = useState(false)
  const [isDetectingIntros, setIsDetectingIntros] = useState(false)

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
      // v0.28.0: videos удалены из БД, теперь в AnimeManifest
    },
  })

  // Приводим тип к AnimeWithRelations после проверки
  const anime = data as AnimeWithRelations | null | undefined

  // v0.28.0: Загружаем AnimeManifest из IPFS для расширенных данных (видео, студии и т.д.)
  const { manifest } = useAnimeManifest(anime?.manifestCid)

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

      // Сохраняем жанры и темы в БД (остальные метаданные теперь в AnimeManifest)
      if (result.data.genres?.length) {
        const genres: ShikimoriGenreInput[] = result.data.genres.map((g) => ({
          id: g.id,
          name: g.name,
          russian: g.russian,
          kind: g.kind ?? 'genre',
        }))
        const saveResult = await saveGenresAndThemes(anime.id, genres)
        if (!saveResult.success) {
          console.warn('[RefreshMetadata] Failed to save genres:', saveResult.error)
        }
      }

      // Обновляем AnimeManifest в IPFS (если нужно)
      if (window.electronAPI?.animeManifest) {
        try {
          await window.electronAPI.animeManifest.update(anime.id)
        } catch (err) {
          console.warn('[RefreshMetadata] Failed to update AnimeManifest:', err)
        }
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

  /**
   * Опубликовать аниме на трекер
   */
  const handlePublishToTracker = useCallback(async () => {
    if (!anime?.manifestCid || !window.electronAPI) {
      toaster.error({ title: 'Нет манифеста для публикации' })
      return
    }

    setIsPublishingToTracker(true)

    try {
      const result = await window.electronAPI.ipfs.trackerPublish(anime.manifestCid)

      if (result.success && result.data?.success) {
        toaster.success({
          title: 'Опубликовано на трекер',
          description: result.data.episodeCount ? `${result.data.episodeCount} эп.` : undefined,
        })
      } else {
        toaster.error({
          title: 'Ошибка публикации',
          description: result.error || 'Неизвестная ошибка',
        })
      }
    } catch (error) {
      toaster.error({
        title: 'Ошибка публикации',
        description: error instanceof Error ? error.message : 'Неизвестная ошибка',
      })
    } finally {
      setIsPublishingToTracker(false)
    }
  }, [anime?.manifestCid])

  /**
   * Определить OP/ED постфактум из IPFS
   * Скачивает транскодированные видео во temp, запускает fingerprinting
   */
  const handleDetectIntros = useCallback(async () => {
    if (!anime?.episodes?.length || !window.electronAPI?.introDetector) {
      return
    }

    // Для каждого эпизода находим японскую аудиодорожку (оригинал)
    // Приоритет: title содержит "Оригинал" → language === 'ja' → первая дорожка с CID
    const episodesWithAudio: Array<{ id: string; audioCid: string; duration: number }> = []

    for (const ep of anime.episodes) {
      if (!ep.durationMs || !ep.audioTracks?.length) continue

      const tracks = ep.audioTracks.filter((t) => t.transcodedCid)
      if (tracks.length === 0) continue

      // Ищем оригинальную японскую дорожку
      // Приоритет: title "Оригинал" → language 'ja'/'jpn' → первая дорожка
      const japaneseTrack =
        tracks.find((t) => t.title?.toLowerCase().includes('оригинал')) ||
        tracks.find((t) => t.language === 'ja' || t.language === 'jpn') ||
        tracks.find((t) => t.title?.toLowerCase().includes('japanese')) ||
        tracks[0]

      episodesWithAudio.push({
        id: ep.id,
        audioCid: japaneseTrack.transcodedCid!,
        duration: ep.durationMs,
      })
    }

    if (episodesWithAudio.length < 2) {
      toaster.error({ title: 'Нужно минимум 2 эпизода с аудиодорожками для определения OP/ED' })
      return
    }

    setIsDetectingIntros(true)

    try {
      const results = await window.electronAPI.introDetector.detectFromIpfs(episodesWithAudio)

      // Сохраняем результаты: удаляем старые OP/ED главы, создаём новые
      let createdCount = 0

      for (const result of results) {
        const hasIntro = result.introStartMs !== null && result.introEndMs !== null
        const hasOutro = result.outroStartMs !== null && result.outroEndMs !== null

        if (!hasIntro && !hasOutro) continue

        // Удаляем старые OP/ED главы этого эпизода
        await deleteChaptersByEpisodeId(result.episodeId)

        // Создаём новые главы
        const chapters: Array<{
          episodeId: string
          type: 'OP' | 'ED'
          title: string
          startMs: number
          endMs: number
        }> = []

        if (hasIntro) {
          chapters.push({
            episodeId: result.episodeId,
            type: 'OP',
            title: 'Opening',
            startMs: result.introStartMs!,
            endMs: result.introEndMs!,
          })
        }

        if (hasOutro) {
          chapters.push({
            episodeId: result.episodeId,
            type: 'ED',
            title: 'Ending',
            startMs: result.outroStartMs!,
            endMs: result.outroEndMs!,
          })
        }

        if (chapters.length > 0) {
          await createManyChapters(chapters)
          createdCount += chapters.length
        }
      }

      // Инвалидируем кэш
      await queryClient.invalidateQueries({ queryKey: ['Anime'] })

      const foundIntros = results.filter((r) => r.introStartMs !== null).length
      const foundOutros = results.filter((r) => r.outroStartMs !== null).length

      toaster.success({
        title: 'Определение OP/ED завершено',
        description: `OP: ${foundIntros}, ED: ${foundOutros} из ${episodesWithAudio.length} эп.`,
      })
    } catch (error) {
      toaster.error({
        title: 'Ошибка определения OP/ED',
        description: error instanceof Error ? error.message : 'Неизвестная ошибка',
      })
    } finally {
      setIsDetectingIntros(false)
    }
  }, [anime?.episodes, queryClient])

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
          posterPath={anime.poster?.path ?? toPlayableUrl({ cid: anime.posterCid }) ?? undefined}
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
            hasManifestCid: !!anime.manifestCid,
            manifestCid: anime.manifestCid ?? undefined,
            isPublishingToTracker,
            onPublishToTracker: handlePublishToTracker,
            episodeCount: anime.episodes?.length || 0,
            isDetectingIntros,
            onDetectIntros: handleDetectIntros,
          }}
        />

        {/* Табы с контентом */}
        <Box px={6} py={4}>
          <AnimeDetailTabs
            episodeCount={anime.episodes?.length || 0}
            hasVideos={!!manifest?.videos && manifest.videos.length > 0}
            hasFranchise={!!anime.shikimoriId}
            hasTracks={anime.episodes?.some((ep) => ep.audioTracks.length > 0 || ep.subtitleTracks.length > 0)}
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
              tracks: (
                <TracksTab
                  audioTracks={
                    anime.episodes?.flatMap((ep) =>
                      ep.audioTracks.map((track) => ({ ...track, episodeNumber: ep.number })),
                    ) || []
                  }
                  subtitleTracks={
                    anime.episodes?.flatMap((ep) =>
                      ep.subtitleTracks.map((track) => ({ ...track, episodeNumber: ep.number })),
                    ) || []
                  }
                />
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
              videos: <VideoSection videos={manifest?.videos || []} />,
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
          posterPath: anime.poster?.path ?? toPlayableUrl({ cid: anime.posterCid }) ?? undefined,
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
            transcodedCid: ep.transcodedCid,
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

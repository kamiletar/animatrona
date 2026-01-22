'use client'

/**
 * Страница просмотра эпизода
 * Загружает эпизод с аудио/субтитрами и подключает плеер
 * Сохраняет прогресс просмотра и выбранные дорожки
 * Поддерживает редактирование глав и автопропуск
 */

import { Box, Button, HStack, Icon, IconButton, Spinner, Text, VStack } from '@chakra-ui/react'
import Link from 'next/link'
import { use, useCallback, useRef, useState } from 'react'
import { LuArrowLeft, LuList, LuSkipForward } from 'react-icons/lu'

import {
  ChapterEditor,
  ChapterMarkers,
  CompletionOverlay,
  ResumeOverlay,
  TrackEditDialog,
  TrackSelector,
  UpNextOverlay,
  VideoPlayer,
  type VideoPlayerRef,
} from '@/components/player'
import { Tooltip } from '@/components/ui/tooltip'
import { useFindUniqueEpisode } from '@/lib/hooks'

import {
  useChapterAutoSkip,
  useChapterEditor,
  useEpisodeNavigation,
  usePlayerTracks,
  useUpNext,
  useWatchProgress,
  type EpisodeWithTracks,
} from '../_hooks'

// Отключаем статическую генерацию
export const dynamic = 'force-dynamic'

interface WatchPageProps {
  params: Promise<{ episodeId: string }>
}

/**
 * Страница просмотра эпизода
 */
export default function WatchPage({ params }: WatchPageProps) {
  const { episodeId } = use(params)
  const playerRef = useRef<VideoPlayerRef>(null)

  // Загружаем эпизод с дорожками и главами
  // Episode включает все базовые поля (включая manifestPath) автоматически
  const { data, isLoading, error } = useFindUniqueEpisode({
    where: { id: episodeId },
    include: {
      audioTracks: {
        orderBy: { streamIndex: 'asc' },
      },
      subtitleTracks: {
        orderBy: { streamIndex: 'asc' },
        include: { fonts: true },
      },
      chapters: {
        orderBy: { startMs: 'asc' },
      },
      anime: {
        select: {
          id: true,
          name: true,
          originalName: true,
          year: true,
          folderPath: true,
          shikimoriId: true,
          watchStatus: true,
          userRating: true,
          isBdRemux: true,
          lastSelectedAudioDubGroup: true,
          lastSelectedSubtitleDubGroup: true,
          lastSelectedAudioLanguage: true,
          lastSelectedSubtitleLanguage: true,
          poster: { select: { path: true } },
        },
      },
      season: {
        select: { id: true, number: true },
      },
    },
  })

  const episode = data as EpisodeWithTracks | null | undefined

  // Хук для управления дорожками
  const tracks = usePlayerTracks({
    playerRef,
    episode,
  })

  // Хук для управления прогрессом
  const progress = useWatchProgress({
    playerRef,
    episode,
    episodeId,
    selectedAudioTrackId: tracks.selectedAudioTrackId,
    selectedSubtitleTrackId: tracks.selectedSubtitleTrackId,
    onSetSelectedAudioTrackId: tracks.setSelectedAudioTrackId,
    onSetSelectedSubtitleTrackId: tracks.setSelectedSubtitleTrackId,
  })

  // Хук для редактора глав
  const chapterEditor = useChapterEditor({
    playerRef,
    episode,
  })

  // Хук для автопропуска глав
  const autoSkip = useChapterAutoSkip({
    playerRef,
    chapters: chapterEditor.playerChapters,
    currentPlaybackTime: chapterEditor.currentPlaybackTime,
    episodeId,
  })

  // Callback для показа экрана завершения
  const handleShowCompletion = useCallback(() => {
    setIsCompletionOpen(true)
  }, [])

  // Хук для навигации между эпизодами
  const navigation = useEpisodeNavigation({
    playerRef,
    episode,
    saveProgress: progress.saveProgress,
    onShowCompletion: handleShowCompletion,
  })

  // Состояние для UpNext (время и длительность)
  const [currentTimeForUpNext, setCurrentTimeForUpNext] = useState(0)
  const [durationForUpNext, setDurationForUpNext] = useState(0)

  // Состояние для CompletionOverlay
  const [isCompletionOpen, setIsCompletionOpen] = useState(false)

  // Хук для оверлея "Следующий эпизод"
  const upNext = useUpNext({
    playerRef,
    episode,
    navigation,
    currentTime: currentTimeForUpNext,
    duration: durationForUpNext,
  })

  // Объединённый обработчик времени для прогресса, редактора глав и UpNext
  const handleTimeUpdate = useCallback(
    (time: number, duration: number) => {
      chapterEditor.updatePlaybackTime(time, duration)
      progress.handleTimeUpdate(time, duration)
      // Обновляем состояние для UpNext оверлея
      setCurrentTimeForUpNext(time)
      setDurationForUpNext(duration)
    },
    [chapterEditor, progress]
  )

  // Обработчик ошибки видео
  const handleVideoError = useCallback((err: Error) => {
    console.error('[WatchPage] Video error:', err)
  }, [])

  // Определяем путь к видео
  const videoSrc = episode?.transcodedPath || episode?.sourcePath || null

  // Загрузка
  if (isLoading) {
    return (
      <Box minH="100vh" bg="black" color="fg" display="flex" alignItems="center" justifyContent="center">
        <VStack gap={4}>
          <Spinner size="xl" color="purple.400" />
          <Text color="fg.muted">Загрузка эпизода...</Text>
        </VStack>
      </Box>
    )
  }

  // Ошибка или не найден
  if (error || !episode) {
    return (
      <Box minH="100vh" bg="bg" color="fg" p={6}>
        <VStack gap={4} align="start">
          <Link href="/library">
            <Button variant="ghost" size="sm">
              <Icon as={LuArrowLeft} mr={2} />
              Назад в библиотеку
            </Button>
          </Link>
          <Text color="red.400">{error ? 'Ошибка загрузки' : 'Эпизод не найден'}</Text>
        </VStack>
      </Box>
    )
  }

  // Нет видео
  if (!videoSrc) {
    return (
      <Box minH="100vh" bg="bg" color="fg" p={6}>
        <VStack gap={4} align="start">
          <Link href={`/library/${episode.animeId}`}>
            <Button variant="ghost" size="sm">
              <Icon as={LuArrowLeft} mr={2} />
              Назад к аниме
            </Button>
          </Link>
          <Text color="yellow.400">Видео ещё не готово к воспроизведению</Text>
          <Text color="fg.subtle" fontSize="sm">
            Статус: {episode.transcodeStatus}
          </Text>
        </VStack>
      </Box>
    )
  }

  return (
    <Box h="100vh" bg="black" color="fg" display="flex" flexDirection="column" overflow="hidden">
      {/* Видеоплеер */}
      <Box flex={1} minH={0}>
        <VideoPlayer
          ref={playerRef}
          src={videoSrc}
          autoPlay={!progress.showResumeOverlay}
          startTime={progress.initialTime}
          showControls
          onTimeUpdate={handleTimeUpdate}
          onEnded={navigation.handleEnded}
          onError={handleVideoError}
          audioTracks={tracks.audioTracksForPlayer}
          currentAudioTrackId={tracks.currentAudioId || undefined}
          onAudioTrackChange={tracks.handleAudioTrackChange}
          subtitlePath={tracks.currentSubtitleTrack?.filePath}
          subtitleFonts={tracks.currentSubtitleFonts}
          chapters={chapterEditor.playerChapters.map((c) => ({ id: c.id, title: c.title, startTime: c.startTime }))}
          onChapterSeek={chapterEditor.handleSeek}
          hasPrevEpisode={navigation.hasPrevEpisode}
          hasNextEpisode={navigation.hasNextEpisode}
          onPrevEpisode={navigation.goToPrevEpisode}
          onNextEpisode={navigation.goToNextEpisode}
          prevEpisodeTooltip={navigation.prevEpisodeTooltip}
          nextEpisodeTooltip={navigation.nextEpisodeTooltip}
          headerLeft={
            <HStack gap={2}>
              <Link href={`/library/${episode.animeId}`}>
                <Button variant="ghost" size="sm" colorPalette="whiteAlpha">
                  <Icon as={LuArrowLeft} mr={2} />
                  {episode.anime.name}
                </Button>
              </Link>
            </HStack>
          }
          headerCenter={
            <VStack gap={0} align="center">
              <Text fontSize="sm" fontWeight="medium">
                {episode.season ? `Сезон ${episode.season.number}, ` : ''}
                Эпизод {episode.number}
              </Text>
              {episode.name && (
                <Text fontSize="xs" color="fg.muted">
                  {episode.name}
                </Text>
              )}
            </VStack>
          }
          headerRight={
            <HStack gap={2}>
              <Tooltip
                content={
                  autoSkip.autoSkipEnabled
                    ? 'Пропускать всё (OP/ED/Recap/Preview)'
                    : autoSkip.settings?.skipOpening || autoSkip.settings?.skipEnding
                      ? `Пропускать: ${[autoSkip.settings?.skipOpening && 'OP', autoSkip.settings?.skipEnding && 'ED'].filter(Boolean).join(', ')}`
                      : 'Автопропуск выключен'
                }
              >
                <IconButton
                  aria-label="Автопропуск"
                  variant={autoSkip.autoSkipEnabled ? 'solid' : 'ghost'}
                  colorPalette={autoSkip.autoSkipEnabled ? 'purple' : 'whiteAlpha'}
                  size="sm"
                  onClick={autoSkip.toggleAutoSkip}
                >
                  <Icon as={LuSkipForward} />
                </IconButton>
              </Tooltip>
              <Tooltip content="Редактор глав">
                <IconButton
                  aria-label="Редактор глав"
                  variant="ghost"
                  colorPalette="whiteAlpha"
                  size="sm"
                  onClick={chapterEditor.toggleChapterEditor}
                >
                  <Icon as={LuList} />
                </IconButton>
              </Tooltip>
              <TrackSelector
                audioTracks={tracks.audioTracksForSelector}
                subtitleTracks={tracks.subtitleTracksForSelector}
                selectedAudioTrack={tracks.currentAudioId || undefined}
                selectedSubtitleTrack={tracks.selectedSubtitleTrackId}
                onAudioTrackChange={tracks.handleAudioTrackChange}
                onSubtitleTrackChange={tracks.handleSubtitleTrackChange}
                onEditAudioTrack={tracks.handleEditAudioTrack}
                onDeleteAudioTrack={tracks.handleEditAudioTrack}
                onEditSubtitleTrack={tracks.handleEditSubtitleTrack}
                onDeleteSubtitleTrack={tracks.handleEditSubtitleTrack}
              />
            </HStack>
          }
        />

        {/* Overlay выбора — продолжить или сначала */}
        <ResumeOverlay
          savedTime={progress.savedResumeTime}
          onResume={progress.handleResumeFromSaved}
          onStartOver={progress.handleStartFromBeginning}
          isOpen={progress.showResumeOverlay}
        />

        {/* Маркеры глав (кнопка пропуска) */}
        <ChapterMarkers
          chapters={chapterEditor.playerChapters}
          duration={chapterEditor.videoDuration}
          currentTime={chapterEditor.currentPlaybackTime}
          onSeek={chapterEditor.handleSeek}
          showSkipButton
        />

        {/* Редактор глав */}
        <ChapterEditor
          chapters={chapterEditor.playerChapters}
          duration={chapterEditor.videoDuration}
          currentTime={chapterEditor.currentPlaybackTime}
          onChaptersChange={chapterEditor.handleChaptersChange}
          onSeek={chapterEditor.handleSeek}
          isOpen={chapterEditor.isChapterEditorOpen}
          onClose={chapterEditor.closeChapterEditor}
          currentEpisodeId={episodeId}
          allEpisodes={navigation.allEpisodes as { id: string; number: number; name?: string | null }[] | undefined}
          onCopyToEpisodes={chapterEditor.handleCopyToEpisodes}
          isCopying={chapterEditor.isCopying}
        />

        {/* Оверлей "Следующий эпизод" (за 30 сек до конца) */}
        <UpNextOverlay
          next={upNext.nextContent}
          isVisible={upNext.isVisible}
          autoPlayEnabled={upNext.autoPlayEnabled}
          onPlayNow={upNext.handlePlayNow}
          onCancel={upNext.handleCancel}
        />

        {/* Экран завершения аниме (после последнего эпизода) */}
        <CompletionOverlay
          isOpen={isCompletionOpen}
          anime={{
            id: episode.animeId,
            name: episode.anime.name,
            posterPath: episode.anime.poster?.path ?? null,
            episodeCount: navigation.allEpisodes?.length ?? 1,
          }}
          onClose={() => setIsCompletionOpen(false)}
        />
      </Box>

      {/* Диалог редактирования дорожки */}
      <TrackEditDialog
        isOpen={!!tracks.editingTrack}
        trackType={tracks.editingTrack?.type || 'audio'}
        trackId={tracks.editingTrack?.id || null}
        currentTitle={tracks.editingTrack?.title}
        currentLanguage={tracks.editingTrack?.language}
        onSave={tracks.handleSaveTrack}
        onDelete={tracks.handleDeleteTrack}
        onClose={tracks.closeTrackEditor}
      />
    </Box>
  )
}

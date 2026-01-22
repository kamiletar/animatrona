'use client'

/**
 * VideoPlayer - Компонент видеоплеера на базе Shaka Player
 *
 * Поддерживает:
 * - Воспроизведение локальных файлов через media:// протокол
 * - Множественные аудио/видео дорожки
 * - Субтитры (VTT, SRT, ASS через SubtitlesOctopus)
 * - Горячие клавиши
 * - Полноэкранный режим
 *
 * Рефакторинг v2: логика вынесена в хуки, UI — в подкомпоненты
 */

import { Box } from '@chakra-ui/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'

import {
  PLAYBACK_SPEEDS,
  PlayerControls,
  PlayerHeader,
  PlayerLoadingOverlay,
  VideoInfoOverlay,
  type PlaybackSpeed,
  type VideoInfo,
} from './_components'
import {
  useAudioSync,
  useAutoHideControls,
  useKeyboardShortcuts,
  usePlayerControls,
  usePlayerState,
  useShakaPlayer,
  useSubtitleManagement,
} from './_hooks'
import { NativeSubtitleOverlay } from './NativeSubtitleOverlay'
import { SubtitleOverlay } from './SubtitleOverlay'
import type { VideoPlayerProps, VideoPlayerRef } from './types'

/**
 * Конвертирует локальный путь в media:// URL для audio элемента
 */
function toMediaUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('media://')) {
    return path
  }
  return `media://${path.replace(/\\/g, '/')}`
}

/**
 * VideoPlayer компонент
 */
export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(function VideoPlayer(
  {
    src,
    videoMetadata,
    autoPlay = false,
    startTime = 0,
    showControls = true,
    onTimeUpdate,
    onEnded,
    onError,
    onPlayStateChange,
    audioTracks,
    currentAudioTrackId,
    onAudioTrackChange: _onAudioTrackChange,
    subtitlePath,
    subtitleFonts = [],
    chapters,
    onChapterSeek,
    hasPrevEpisode,
    hasNextEpisode,
    onPrevEpisode,
    onNextEpisode,
    prevEpisodeTooltip,
    nextEpisodeTooltip,
    headerLeft,
    headerCenter,
    headerRight,
  },
  ref
) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Состояние для оверлея информации о видео
  const [showVideoInfo, setShowVideoInfo] = useState(false)

  // Состояние Picture-in-Picture
  const [isPiP, setIsPiP] = useState(false)

  // Хук состояния плеера
  const {
    state,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setVolume,
    setIsMuted,
    setIsFullscreen,
    playbackSpeed,
    setPlaybackSpeed,
    subtitleFormat,
    usesSeparateAudio,
    usesSeparateAudioRef,
    currentAudioTrack,
  } = usePlayerState({
    audioTracks,
    currentAudioTrackId,
    subtitlePath,
  })

  // Хук Shaka Player — инициализация и управление плеером
  const { videoRef, isVideoReady, isLoading } = useShakaPlayer({
    src,
    startTime,
    autoPlay,
    videoContainerRef,
    audioRef,
    usesSeparateAudioRef,
    onError,
    onDurationChange: setDuration,
  })

  // Хук синхронизации audio + video в режиме раздельных дорожек
  useAudioSync({
    videoRef,
    audioRef,
    usesSeparateAudio,
    currentAudioTrack,
    isVideoReady,
  })

  // Хук автоскрытия контролов
  const { showControls: showControlsOverlay, resetHideTimeout } = useAutoHideControls({
    isPlaying: state.isPlaying,
  })

  // Хук управления воспроизведением
  const controls = usePlayerControls({
    videoRef,
    audioRef,
    containerRef,
    usesSeparateAudio,
    usesSeparateAudioRef,
    duration: state.duration,
    setIsMuted,
  })

  // Функции управления скоростью воспроизведения
  const handlePlaybackSpeedChange = useCallback(
    (speed: PlaybackSpeed) => {
      setPlaybackSpeed(speed)
      if (videoRef.current) {
        videoRef.current.playbackRate = speed
      }
      // Синхронизируем audio если используется раздельная дорожка
      if (audioRef.current) {
        audioRef.current.playbackRate = speed
      }
    },
    [setPlaybackSpeed]
  )

  const adjustPlaybackSpeed = useCallback(
    (delta: number) => {
      const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed)
      if (currentIndex === -1) {return}

      const newIndex = Math.max(0, Math.min(PLAYBACK_SPEEDS.length - 1, currentIndex + Math.sign(delta)))
      const newSpeed = PLAYBACK_SPEEDS[newIndex]
      handlePlaybackSpeedChange(newSpeed)
    },
    [playbackSpeed, handlePlaybackSpeedChange]
  )

  // Переключение оверлея информации о видео
  const toggleVideoInfo = useCallback(() => {
    setShowVideoInfo((prev) => !prev)
  }, [])

  // Переключение Picture-in-Picture
  const togglePiP = useCallback(async () => {
    const video = videoRef.current
    if (!video) {return}

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture()
      }
    } catch (error) {
      console.warn('[VideoPlayer] PiP error:', error)
    }
  }, [])

  // Хук горячих клавиш
  useKeyboardShortcuts({
    videoRef,
    togglePlay: controls.togglePlay,
    skipTime: controls.skipTime,
    toggleMute: controls.toggleMute,
    toggleFullscreen: controls.toggleFullscreen,
    adjustPlaybackSpeed,
    toggleVideoInfo,
  })

  // Хук субтитров
  const { vttUrl } = useSubtitleManagement({
    videoRef,
    subtitlePath,
    subtitleFormat,
  })

  // Блокировка сна монитора при воспроизведении
  useEffect(() => {
    const video = videoRef.current
    if (!video) {return}

    const api = window.electronAPI
    if (!api?.app?.setPowerSavePlayback) {return}

    const handlePlayPowerSave = () => {
      api.app.setPowerSavePlayback(true)
    }

    const handlePausePowerSave = () => {
      api.app.setPowerSavePlayback(false)
    }

    video.addEventListener('play', handlePlayPowerSave)
    video.addEventListener('pause', handlePausePowerSave)
    video.addEventListener('ended', handlePausePowerSave)

    // Отключаем блокировку при размонтировании
    return () => {
      video.removeEventListener('play', handlePlayPowerSave)
      video.removeEventListener('pause', handlePausePowerSave)
      video.removeEventListener('ended', handlePausePowerSave)
      api.app.setPowerSavePlayback(false)
    }
  }, [isVideoReady])

  // События видео
  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      onTimeUpdate?.(video.currentTime, video.duration)
    }

    const handlePlay = () => {
      setIsPlaying(true)
      onPlayStateChange?.(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
      onPlayStateChange?.(false)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      onPlayStateChange?.(false)
      onEnded?.()
    }

    const handleDurationChange = () => {
      setDuration(video.duration)
    }

    const handleVolumeChange = () => {
      setVolume(video.volume)
      // В режиме раздельных дорожек video.muted всегда true,
      // поэтому isMuted контролируется отдельно через audio element
      if (!usesSeparateAudioRef.current) {
        setIsMuted(video.muted)
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('durationchange', handleDurationChange)
    video.addEventListener('volumechange', handleVolumeChange)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('durationchange', handleDurationChange)
      video.removeEventListener('volumechange', handleVolumeChange)
    }
  }, [
    isVideoReady, // Перезапускаем когда video готов
    onTimeUpdate,
    onEnded,
    onPlayStateChange,
    setCurrentTime,
    setIsPlaying,
    setDuration,
    setVolume,
    setIsMuted,
    usesSeparateAudioRef,
    videoRef,
  ])

  // Fullscreen events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [setIsFullscreen])

  // Picture-in-Picture events
  useEffect(() => {
    const video = videoRef.current
    if (!video) {return}

    const handleEnterPiP = () => setIsPiP(true)
    const handleLeavePiP = () => setIsPiP(false)

    video.addEventListener('enterpictureinpicture', handleEnterPiP)
    video.addEventListener('leavepictureinpicture', handleLeavePiP)

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnterPiP)
      video.removeEventListener('leavepictureinpicture', handleLeavePiP)
    }
  }, [isVideoReady]) // Перезапускаем когда video готов

  // Публичный API через ref
  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    seek: (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time
      }
    },
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    getDuration: () => videoRef.current?.duration ?? 0,
    setVolume: (vol: number) => {
      if (videoRef.current) {
        videoRef.current.volume = vol
      }
    },
    getVolume: () => videoRef.current?.volume ?? 1,
    toggleFullscreen: controls.toggleFullscreen,
    getVideoElement: () => videoRef.current,
  }))

  // Подготовка данных для оверлея информации о видео
  const videoInfo = useMemo<VideoInfo>(() => {
    return {
      filePath: src,
      videoCodec: videoMetadata?.videoCodec,
      videoWidth: videoMetadata?.videoWidth,
      videoHeight: videoMetadata?.videoHeight,
      videoBitrate: videoMetadata?.videoBitrate,
      videoBitDepth: videoMetadata?.videoBitDepth,
      audioCodec: videoMetadata?.audioCodec,
      audioBitrate: videoMetadata?.audioBitrate,
      audioChannels: videoMetadata?.audioChannels,
      subtitleFormat: videoMetadata?.subtitleFormat,
      subtitleLanguage: videoMetadata?.subtitleLanguage,
      fileSize: videoMetadata?.fileSize,
      duration: state.duration,
    }
  }, [src, videoMetadata, state.duration])

  return (
    <Box
      ref={containerRef}
      position="relative"
      bg="black"
      width="100%"
      height="100%"
      cursor={showControlsOverlay ? 'default' : 'none'}
      onMouseMove={resetHideTimeout}
      onClick={controls.togglePlay}
    >
      {/* Контейнер для video элемента (создаётся программно в useEffect) */}
      <div ref={videoContainerRef} style={{ width: '100%', height: '100%' }} onClick={(e) => e.stopPropagation()} />

      {/* Скрытый audio элемент для раздельных дорожек */}
      {usesSeparateAudio && currentAudioTrack?.transcodedPath && (
        <audio
          ref={audioRef}
          src={toMediaUrl(currentAudioTrack.transcodedPath)}
          style={{ display: 'none' }}
          onLoadedData={() => {
            // onLoadedData срабатывает ОДИН раз при загрузке нового источника
            // (в отличие от onCanPlay, который срабатывает при каждой буферизации)
            const video = videoRef.current
            const audio = audioRef.current
            if (video && audio) {
              audio.currentTime = video.currentTime
              audio.volume = video.volume
              audio.playbackRate = video.playbackRate
              // Если видео уже играет — запускаем audio
              if (!video.paused) {
                audio.play().catch((err) => {
                  console.warn('[VideoPlayer] Audio play on loadeddata failed:', err)
                })
              }
            }
          }}
        />
      )}

      {/* ASS/SSA субтитры через SubtitlesOctopus — только после загрузки видео */}
      {subtitlePath && subtitleFormat === 'ass' && isVideoReady && (
        <SubtitleOverlay videoRef={videoRef} subtitleUrl={subtitlePath} fonts={subtitleFonts} />
      )}

      {/* Нативные субтитры (SRT/VTT) — кастомный оверлей поверх видео */}
      {vttUrl && subtitleFormat === 'native' && <NativeSubtitleOverlay videoRef={videoRef} vttUrl={vttUrl} />}

      {/* Верхняя панель (header) */}
      {showControls && (
        <PlayerHeader
          headerLeft={headerLeft}
          headerCenter={headerCenter}
          headerRight={headerRight}
          isVisible={showControlsOverlay}
        />
      )}

      {/* Оверлей загрузки */}
      <PlayerLoadingOverlay isLoading={isLoading} />

      {/* Оверлей информации о видео (клавиша I) */}
      <VideoInfoOverlay isVisible={showVideoInfo} info={videoInfo} />

      {/* Контролы */}
      {showControls && (
        <PlayerControls
          isPlaying={state.isPlaying}
          currentTime={state.currentTime}
          duration={state.duration}
          volume={state.volume}
          isMuted={state.isMuted}
          isFullscreen={state.isFullscreen}
          isVisible={showControlsOverlay}
          onTogglePlay={controls.togglePlay}
          onSeek={controls.handleSeek}
          onVolumeChange={controls.handleVolumeChange}
          onToggleMute={controls.toggleMute}
          onToggleFullscreen={controls.toggleFullscreen}
          onSkipTime={controls.skipTime}
          chapters={chapters}
          onChapterSeek={onChapterSeek}
          hasPrevEpisode={hasPrevEpisode}
          hasNextEpisode={hasNextEpisode}
          onPrevEpisode={onPrevEpisode}
          onNextEpisode={onNextEpisode}
          prevEpisodeTooltip={prevEpisodeTooltip}
          nextEpisodeTooltip={nextEpisodeTooltip}
          playbackSpeed={playbackSpeed}
          onPlaybackSpeedChange={handlePlaybackSpeedChange}
          isPiP={isPiP}
          onTogglePiP={togglePiP}
        />
      )}
    </Box>
  )
})

// Re-export типов для обратной совместимости
export type { AudioTrackInfo, VideoPlayerProps, VideoPlayerRef } from './types'

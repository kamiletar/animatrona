/**
 * usePlayerState — хук для управления состоянием плеера
 *
 * Инкапсулирует:
 * - Основное состояние (isPlaying, currentTime, duration, volume, isMuted, isFullscreen, isLoading)
 * - Вычисляемые значения (usesSeparateAudio, currentAudioTrack, subtitleFormat)
 */

import { useMemo, useRef, useState } from 'react'

import type { PlaybackSpeed } from '../_components/PlayerControls'
import type { AudioTrackInfo, PlayerState, SubtitleFormat } from '../types'

export interface UsePlayerStateOptions {
  audioTracks?: AudioTrackInfo[]
  currentAudioTrackId?: string
  subtitlePath?: string | null
}

export interface UsePlayerStateReturn {
  /** Основное состояние плеера */
  state: PlayerState
  /** Сеттеры состояния */
  setIsPlaying: (v: boolean) => void
  setCurrentTime: (v: number) => void
  setDuration: (v: number) => void
  setVolume: (v: number) => void
  setIsMuted: (v: boolean) => void
  setIsFullscreen: (v: boolean) => void
  setIsLoading: (v: boolean) => void
  setShowControlsOverlay: (v: boolean) => void
  /** Скорость воспроизведения */
  playbackSpeed: PlaybackSpeed
  /** Изменить скорость воспроизведения */
  setPlaybackSpeed: (v: PlaybackSpeed) => void
  /** Формат субтитров (ass, native, null) */
  subtitleFormat: SubtitleFormat
  /** Используется ли режим раздельных аудиодорожек */
  usesSeparateAudio: boolean
  /** Ref для usesSeparateAudio (для event handlers) */
  usesSeparateAudioRef: React.MutableRefObject<boolean>
  /** Текущая аудиодорожка */
  currentAudioTrack: AudioTrackInfo | null
}

/**
 * Хук для управления состоянием плеера
 */
export function usePlayerState(options: UsePlayerStateOptions): UsePlayerStateReturn {
  const { audioTracks, currentAudioTrackId, subtitlePath } = options

  // Основное состояние
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showControlsOverlay, setShowControlsOverlay] = useState(true)
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1)

  // Ref для использования в event handlers
  const usesSeparateAudioRef = useRef(false)

  // Определяем формат субтитров для выбора метода отображения
  const subtitleFormat = useMemo<SubtitleFormat>(() => {
    if (!subtitlePath) {
      return null
    }
    const ext = subtitlePath.split('.').pop()?.toLowerCase()
    if (ext === 'ass' || ext === 'ssa') {
      return 'ass'
    }
    if (ext === 'srt' || ext === 'vtt') {
      return 'native'
    }
    return null
  }, [subtitlePath])

  // Режим раздельных дорожек — когда есть транскодированные/skipped дорожки
  const usesSeparateAudio = useMemo(() => {
    if (!audioTracks || audioTracks.length === 0) {
      return false
    }
    return audioTracks.some(
      (t) => (t.transcodeStatus === 'COMPLETED' || t.transcodeStatus === 'SKIPPED') && t.transcodedPath
    )
  }, [audioTracks])

  // Храним в ref для использования в event handlers
  usesSeparateAudioRef.current = usesSeparateAudio

  // Текущая аудиодорожка
  const currentAudioTrack = useMemo(() => {
    if (!audioTracks || audioTracks.length === 0) {
      return null
    }

    // Ищем по ID если указан
    if (currentAudioTrackId) {
      const found = audioTracks.find((t) => t.id === currentAudioTrackId)
      if (found && found.transcodedPath) {
        return found
      }
    }

    // Иначе — первая доступная (готовая к воспроизведению)
    return (
      audioTracks.find(
        (t) => (t.transcodeStatus === 'COMPLETED' || t.transcodeStatus === 'SKIPPED') && t.transcodedPath
      ) ?? null
    )
  }, [audioTracks, currentAudioTrackId])

  // Собираем state объект
  const state: PlayerState = {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isFullscreen,
    isLoading,
    showControlsOverlay,
  }

  return {
    state,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setVolume,
    setIsMuted,
    setIsFullscreen,
    setIsLoading,
    setShowControlsOverlay,
    playbackSpeed,
    setPlaybackSpeed,
    subtitleFormat,
    usesSeparateAudio,
    usesSeparateAudioRef,
    currentAudioTrack,
  }
}

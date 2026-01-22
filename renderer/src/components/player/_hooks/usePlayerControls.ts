/**
 * usePlayerControls — хук для управления воспроизведением
 *
 * Инкапсулирует:
 * - togglePlay, handleSeek, handleVolumeChange
 * - toggleMute, toggleFullscreen, skipTime
 */

import { useCallback } from 'react'

import type { RefObject } from 'react'

import { SKIP_TIME } from '../constants'

export interface UsePlayerControlsOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  audioRef: RefObject<HTMLAudioElement | null>
  containerRef: RefObject<HTMLDivElement | null>
  usesSeparateAudio: boolean
  usesSeparateAudioRef: React.MutableRefObject<boolean>
  duration: number
  setIsMuted: (v: boolean) => void
}

export interface UsePlayerControlsReturn {
  togglePlay: () => void
  handleSeek: (value: number[]) => void
  handleVolumeChange: (value: number[]) => void
  toggleMute: () => void
  toggleFullscreen: () => void
  skipTime: (seconds: number) => void
}

/**
 * Хук для управления воспроизведением
 */
export function usePlayerControls(options: UsePlayerControlsOptions): UsePlayerControlsReturn {
  const { videoRef, audioRef, containerRef, usesSeparateAudio, usesSeparateAudioRef, duration, setIsMuted } = options

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }, [videoRef])

  const handleSeek = useCallback(
    (value: number[]) => {
      const video = videoRef.current
      if (!video || !isFinite(duration)) {
        return
      }

      const newTime = (value[0] / 100) * duration
      video.currentTime = newTime
    },
    [videoRef, duration]
  )

  const handleVolumeChange = useCallback(
    (value: number[]) => {
      const video = videoRef.current
      const audio = audioRef.current
      const newVolume = value[0] / 100

      if (video) {
        video.volume = newVolume
      }

      if (usesSeparateAudioRef.current && audio) {
        // В режиме раздельных дорожек — управляем audio
        audio.volume = newVolume
        audio.muted = newVolume === 0
        setIsMuted(newVolume === 0)
      } else if (video) {
        // Иначе — управляем видео
        video.muted = newVolume === 0
      }
    },
    [videoRef, audioRef, usesSeparateAudioRef, setIsMuted]
  )

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    const audio = audioRef.current

    if (usesSeparateAudio && audio) {
      // В режиме раздельных дорожек — управляем audio элементом
      audio.muted = !audio.muted
      setIsMuted(audio.muted)
    } else if (video) {
      // Иначе — управляем видео
      video.muted = !video.muted
    }
  }, [videoRef, audioRef, usesSeparateAudio, setIsMuted])

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      container.requestFullscreen()
    }
  }, [containerRef])

  const skipTime = useCallback(
    (seconds: number = SKIP_TIME) => {
      const video = videoRef.current
      if (!video) {
        return
      }

      video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, duration))
    },
    [videoRef, duration]
  )

  return {
    togglePlay,
    handleSeek,
    handleVolumeChange,
    toggleMute,
    toggleFullscreen,
    skipTime,
  }
}

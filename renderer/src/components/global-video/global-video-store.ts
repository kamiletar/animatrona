/**
 * Zustand store для глобального видеоплеера (mini-player)
 *
 * Управляет состоянием видео при навигации между страницами.
 * Video element создаётся один раз и перемещается между контейнерами.
 */

import { create } from 'zustand'

import type { GlobalVideoState, PlaybackMetadata, VideoDisplayMode } from './types'

/** Интерфейс Zustand store */
interface GlobalVideoStore extends GlobalVideoState {
  /** Ссылка на video element */
  videoElement: HTMLVideoElement | null

  // === Actions ===

  /** Инициализировать видео (при переходе на страницу просмотра) */
  initVideo: (src: string, metadata: PlaybackMetadata, startTime?: number) => void

  /** Свернуть в mini-player (embedded → mini) */
  minimize: () => void

  /** Развернуть (mini → embedded, с навигацией на returnPath) */
  expand: () => string | null

  /** Закрыть видео (остановить и сбросить) */
  close: () => void

  /** Обновить текущее время */
  updateTime: (time: number) => void

  /** Обновить длительность */
  updateDuration: (duration: number) => void

  /** Обновить состояние воспроизведения */
  updatePlayingState: (isPlaying: boolean) => void

  /** Обновить громкость */
  updateVolume: (volume: number, isMuted: boolean) => void

  /** Установить video element */
  setVideoElement: (element: HTMLVideoElement | null) => void

  /** Установить режим */
  setMode: (mode: VideoDisplayMode) => void

  /** Сбросить состояние */
  reset: () => void
}

/** Начальное состояние */
const initialState: GlobalVideoState & { videoElement: HTMLVideoElement | null } = {
  mode: 'hidden',
  src: null,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  volume: 1,
  isMuted: false,
  metadata: null,
  videoElement: null,
}

/**
 * Zustand store для глобального видео
 */
export const useGlobalVideoStore = create<GlobalVideoStore>()((set, get) => ({
  ...initialState,

  initVideo: (src, metadata, startTime = 0) => {
    set({
      mode: 'embedded',
      src,
      metadata,
      currentTime: startTime,
      isPlaying: false,
    })
  },

  minimize: () => {
    const { mode, isPlaying } = get()
    // Сворачиваем только если видео воспроизводится и в режиме embedded
    if (mode === 'embedded' && isPlaying) {
      set({ mode: 'mini' })
    } else if (mode === 'embedded' && !isPlaying) {
      // Если видео на паузе — просто скрываем
      set({ mode: 'hidden' })
    }
  },

  expand: () => {
    const { mode, metadata } = get()
    if (mode === 'mini' && metadata) {
      set({ mode: 'embedded' })
      return metadata.returnPath
    }
    return null
  },

  close: () => {
    const { videoElement } = get()
    if (videoElement) {
      videoElement.pause()
      videoElement.currentTime = 0
    }
    set({
      mode: 'hidden',
      isPlaying: false,
      currentTime: 0,
    })
  },

  updateTime: (time) => set({ currentTime: time }),

  updateDuration: (duration) => set({ duration }),

  updatePlayingState: (isPlaying) => set({ isPlaying }),

  updateVolume: (volume, isMuted) => set({ volume, isMuted }),

  setVideoElement: (element) => set({ videoElement: element }),

  setMode: (mode) => set({ mode }),

  reset: () => set(initialState),
}))

// Экспортируем store в глобальный объект для E2E тестов
if (typeof window !== 'undefined') {
  ;(window as any).useGlobalVideoStore = useGlobalVideoStore
}

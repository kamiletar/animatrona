'use client'

/**
 * SubtitleOverlay - Компонент для рендеринга ASS/SSA субтитров поверх видео
 *
 * Использует libass-wasm (SubtitlesOctopus) для рендеринга сложных субтитров
 * с поддержкой стилей, анимаций и позиционирования.
 *
 * ВАЖНО: Компонент не рендерит собственный UI — SubtitlesOctopus сам создаёт
 * canvas элемент рядом с video. Это необходимо для корректной работы resize().
 */

import { useEffect, useRef, type RefObject } from 'react'

/** Пропсы компонента SubtitleOverlay */
export interface SubtitleOverlayProps {
  /** Ссылка на video элемент */
  videoRef: RefObject<HTMLVideoElement | null>
  /** URL или путь к файлу субтитров (.ass, .ssa) */
  subtitleUrl?: string
  /** Содержимое субтитров (альтернатива URL) */
  subtitleContent?: string
  /** Массив URL к шрифтам */
  fonts?: string[]
  /** Обработчик ошибки */
  onError?: (error: Error) => void
  /** Обработчик успешной загрузки */
  onReady?: () => void
}

/** Тип для SubtitlesOctopus инстанса */
interface SubtitlesOctopusInstance {
  setTrackByUrl: (url: string) => void
  setTrack: (content: string) => void
  freeTrack: () => void
  setCurrentTime: (time: number) => void
  dispose: () => void
  resize: (width: number, height: number, top?: number, left?: number) => void
}

/** Тип для SubtitlesOctopus конструктора */
interface SubtitlesOctopusOptions {
  video?: HTMLVideoElement
  subUrl?: string
  subContent?: string
  fonts?: string[]
  workerUrl?: string
  legacyWorkerUrl?: string
  onReady?: () => void
  onError?: (error: Error) => void
  debug?: boolean
}

declare global {
  interface Window {
    SubtitlesOctopus?: new (options: SubtitlesOctopusOptions) => SubtitlesOctopusInstance
  }
}

/**
 * Конвертирует локальный путь в media:// URL для субтитров
 */
function toSubtitleUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('media://')) {
    return path
  }
  // Нормализуем путь для Windows
  const normalizedPath = path.replace(/\\/g, '/')
  return `media://${normalizedPath}`
}

/**
 * SubtitleOverlay компонент
 *
 * Рендерит ASS/SSA субтитры поверх видео используя libass-wasm.
 * Компонент не создаёт собственный canvas — SubtitlesOctopus сам создаёт
 * canvasParent div рядом с video элементом для корректного позиционирования.
 */
export function SubtitleOverlay({
  videoRef,
  subtitleUrl,
  subtitleContent,
  fonts = [],
  onError,
  onReady,
}: SubtitleOverlayProps) {
  const instanceRef = useRef<SubtitlesOctopusInstance | null>(null)

  // Инициализация SubtitlesOctopus
  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }
    if (!subtitleUrl && !subtitleContent) {
      return
    }

    // Проверяем доступность SubtitlesOctopus
    if (!window.SubtitlesOctopus) {
      return
    }

    let initialized = false

    // Функция инициализации — возвращает true если успешно
    const initOctopus = (): boolean => {
      // Проверяем что video имеет размеры (videoWidth/Height для медиа, offsetWidth/Height для DOM)
      // SubtitlesOctopus использует getBoundingClientRect(), поэтому нужны оба
      const rect = video.getBoundingClientRect()

      if (!video.videoWidth || !video.videoHeight || !rect.width || !rect.height) {
        return false
      }

      if (initialized || instanceRef.current) {
        return true
      }

      try {
        const options: SubtitlesOctopusOptions = {
          video,
          // НЕ передаём canvas — SubtitlesOctopus сам создаст canvasParent
          // Это необходимо для корректной работы resize() и getBoundingClientRect()
          fonts: fonts.map(toSubtitleUrl),
          workerUrl: '/libassjs-worker.js',
          onReady: () => {
            onReady?.()
          },
          onError: (error) => {
            onError?.(error instanceof Error ? error : new Error(String(error)))
          },
          debug: process.env.NODE_ENV === 'development',
        }

        // Добавляем источник субтитров
        if (subtitleUrl) {
          options.subUrl = toSubtitleUrl(subtitleUrl)
        } else if (subtitleContent) {
          options.subContent = subtitleContent
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- проверено выше
        instanceRef.current = new window.SubtitlesOctopus!(options)
        initialized = true

        return true
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)))
        return false
      }
    }

    // Пробуем инициализировать сразу (если video уже готов)
    if (!initOctopus()) {
      // Video ещё не готов — ждём события готовности
      // loadedmetadata может сработать до появления размеров, поэтому используем несколько событий
      let cancelled = false
      let retryCount = 0
      const MAX_RETRIES = 60 // ~1 секунда при 60fps

      const tryInit = () => {
        if (cancelled || initialized) {
          return
        }
        if (!initOctopus() && retryCount < MAX_RETRIES) {
          retryCount++
          requestAnimationFrame(tryInit)
        }
      }

      const handleVideoReady = () => {
        tryInit()
      }

      // Слушаем несколько событий для надёжности
      video.addEventListener('loadedmetadata', handleVideoReady)
      video.addEventListener('loadeddata', handleVideoReady)
      video.addEventListener('canplay', handleVideoReady)

      // Cleanup для event listeners
      return () => {
        cancelled = true
        video.removeEventListener('loadedmetadata', handleVideoReady)
        video.removeEventListener('loadeddata', handleVideoReady)
        video.removeEventListener('canplay', handleVideoReady)
        if (instanceRef.current) {
          try {
            instanceRef.current.dispose()
          } catch {
            // Игнорируем ошибки dispose() — DOM элементы могут быть уже удалены
          }
          instanceRef.current = null
        }
      }
    }

    // Video был готов сразу — cleanup без event listener
    return () => {
      if (instanceRef.current) {
        try {
          instanceRef.current.dispose()
        } catch {
          // Игнорируем ошибки dispose() — DOM элементы могут быть уже удалены
        }
        instanceRef.current = null
      }
    }
  }, [videoRef, subtitleUrl, subtitleContent, fonts, onError, onReady])

  // Обновление субтитров при изменении источника
  useEffect(() => {
    if (!instanceRef.current) {
      return
    }

    if (subtitleUrl) {
      instanceRef.current.setTrackByUrl(toSubtitleUrl(subtitleUrl))
    } else if (subtitleContent) {
      instanceRef.current.setTrack(subtitleContent)
    } else {
      instanceRef.current.freeTrack()
    }
  }, [subtitleUrl, subtitleContent])

  // Компонент не рендерит UI — SubtitlesOctopus сам создаёт canvas рядом с video
  return null
}

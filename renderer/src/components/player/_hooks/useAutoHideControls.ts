/**
 * useAutoHideControls — хук для автоскрытия контролов плеера
 *
 * Автоматически скрывает контролы через HIDE_CONTROLS_TIMEOUT
 * после последнего движения мыши, когда видео воспроизводится
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { HIDE_CONTROLS_TIMEOUT } from '../constants'

export interface UseAutoHideControlsOptions {
  /** Видео воспроизводится? */
  isPlaying: boolean
}

export interface UseAutoHideControlsReturn {
  /** Показывать ли контролы */
  showControls: boolean
  /** Сбросить таймаут скрытия (вызывать при движении мыши) */
  resetHideTimeout: () => void
}

/**
 * Хук для автоскрытия контролов при воспроизведении
 */
export function useAutoHideControls(options: UseAutoHideControlsOptions): UseAutoHideControlsReturn {
  const { isPlaying } = options

  const [showControls, setShowControls] = useState(true)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetHideTimeout = useCallback(() => {
    // Очищаем предыдущий таймер
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }

    // Показываем контролы
    setShowControls(true)

    // Если видео воспроизводится — запускаем таймер скрытия
    if (isPlaying) {
      hideTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, HIDE_CONTROLS_TIMEOUT)
    }
  }, [isPlaying])

  // Сброс таймаута при изменении isPlaying
  useEffect(() => {
    resetHideTimeout()
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [isPlaying, resetHideTimeout])

  return {
    showControls,
    resetHideTimeout,
  }
}

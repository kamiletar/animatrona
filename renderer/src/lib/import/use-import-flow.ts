'use client'

/**
 * Хук для управления процессом импорта
 * Координирует FFmpeg (через Electron IPC) и БД (через ZenStack)
 *
 * Это координатор — вся логика вынесена в:
 * - ImportProcessor (основная логика)
 * - useImportState (состояние)
 * - useImportEvents (подписки на события)
 * - useImportMutations (13 мутаций)
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

import { ImportProcessor } from './import-processor'
import type { ImportOptions, ImportResult } from './types'
import { useImportProgressEvents, useParallelTranscodeEvents } from './use-import-events'
import { useImportMutations } from './use-import-mutations'
import { useImportState } from './use-import-state'

// Re-export types for backward compatibility
export type { ImportOptions, ImportResult, ImportState } from './types'
export type { ExtendedTranscodeProgress, AudioTrackProgress } from './types'

/**
 * Хук для импорта аниме
 *
 * @returns state - текущее состояние импорта
 * @returns isRunning - идёт ли импорт
 * @returns startImport - запуск импорта
 * @returns cancelImport - отмена импорта
 * @returns reset - сброс состояния
 */
export function useImportFlow() {
  const queryClient = useQueryClient()
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  // Инициализация модулей
  const mutations = useImportMutations()
  const { state, dispatch, refs } = useImportState()

  // Подписки на события Electron
  useImportProgressEvents(dispatch, refs)
  useParallelTranscodeEvents(dispatch, mutations.updateAudioTrack, refs)

  // Процессор импорта (мемоизирован для стабильности)
  const processor = useMemo(
    () => new ImportProcessor(mutations, dispatch, refs, queryClient),
    [mutations, dispatch, refs, queryClient]
  )

  /**
   * Запуск импорта
   */
  const startImport = useCallback(
    async (options: ImportOptions): Promise<ImportResult> => {
      setIsRunning(true)
      try {
        return await processor.process(options)
      } finally {
        setIsRunning(false)
      }
    },
    [processor]
  )

  /**
   * Отмена импорта
   */
  const cancelImport = useCallback(async () => {
    await processor.cancel()
    setIsRunning(false)
    setIsPaused(false)
  }, [processor])

  /**
   * Пауза импорта (приостанавливает FFmpeg процессы)
   */
  const pauseImport = useCallback(async () => {
    const api = window.electronAPI
    if (!api) {return}

    const result = await api.parallelTranscode.pause()
    if (result.success) {
      setIsPaused(true)
    }
  }, [])

  /**
   * Возобновление импорта
   */
  const resumeImport = useCallback(async () => {
    const api = window.electronAPI
    if (!api) {return}

    const result = await api.parallelTranscode.resume()
    if (result.success) {
      setIsPaused(false)
    }
  }, [])

  /**
   * Сброс состояния
   */
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
    refs.transcodeStartTime.current = null
    refs.isCancelled.current = false
    refs.videoEncodingMeta.current.clear()
  }, [dispatch, refs])

  return {
    // Состояние (spread для совместимости с существующим кодом)
    ...state,
    isRunning,
    isPaused,

    // Методы
    startImport,
    cancelImport,
    pauseImport,
    resumeImport,
    reset,
  }
}

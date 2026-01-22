'use client'

/**
 * Хуки для подписки на события Electron (прогресс транскодирования)
 */

import type { UseMutationResult } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { TranscodeProgress } from '../../../../shared/types'
import type { ImportAction, ImportRefs } from './types'

type Dispatch = React.Dispatch<ImportAction>
// Используем более гибкий тип для совместимости с генерируемыми хуками ZenStack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UpdateAudioTrackMutation = UseMutationResult<any, Error, { where: { id: string }; data: any }>

/**
 * Подписка на события прогресса транскодирования (video/audio)
 *
 * @param dispatch - dispatch функция reducer'а
 * @param refs - refs для отслеживания времени начала
 */
export function useImportProgressEvents(dispatch: Dispatch, refs: ImportRefs) {
  useEffect(() => {
    const api = window.electronAPI
    if (!api) {
      return
    }

    const unsubscribe = api.on.transcodeProgress((progress) => {
      const progressWithTrack = progress as TranscodeProgress & {
        type: string
        trackId?: string
        fps?: number
        speed?: number
        bitrate?: number
        size?: number
      }

      // Обновляем прогресс для видео
      if (progressWithTrack.type === 'video') {
        const elapsedMs = refs.transcodeStartTime.current ? Date.now() - refs.transcodeStartTime.current : undefined

        dispatch({
          type: 'SET_TRANSCODE_PROGRESS',
          progress: {
            percent: progress.percent,
            fps: progressWithTrack.fps,
            speed: progressWithTrack.speed,
            bitrate: progressWithTrack.bitrate,
            size: progressWithTrack.size,
            elapsedMs,
          },
        })
      }

      // Обновляем прогресс для аудио (по trackId)
      if ((progressWithTrack.type === 'audio' || progressWithTrack.type === 'audio-vbr') && progressWithTrack.trackId) {
        dispatch({
          type: 'UPDATE_AUDIO_TRACK',
          trackId: progressWithTrack.trackId,
          percent: progress.percent,
          status: 'transcoding',
        })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [dispatch, refs])
}

/**
 * Подписка на события параллельного транскодирования (Dual Encoders)
 *
 * @param dispatch - dispatch функция reducer'а
 * @param updateAudioTrack - мутация для обновления аудиодорожки в БД
 * @param refs - refs для хранения ffmpegCommands
 */
export function useParallelTranscodeEvents(dispatch: Dispatch, updateAudioTrack: UpdateAudioTrackMutation, refs?: ImportRefs) {
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.parallelTranscode) {
      return
    }

    // Агрегированный прогресс (video + audio)
    const unsubscribeProgress = api.parallelTranscode.onAggregatedProgress((progress) => {
      dispatch({ type: 'SET_PARALLEL_PROGRESS', progress })
    })

    // Видео завершено — сохраняем метаданные кодирования для использования в пост-обработке
    const unsubscribeVideoCompleted = api.parallelTranscode.onVideoCompleted((_itemId, episodeId, _outputPath, meta) => {
      console.warn('[ParallelImport] Video completed:', episodeId, meta)
      if (meta && refs?.videoEncodingMeta) {
        refs.videoEncodingMeta.current.set(episodeId, meta)
      }
    })

    // Аудиодорожка завершена — обновляем БД
    const unsubscribeAudioCompleted = api.parallelTranscode.onAudioTrackCompleted(
      async (trackId, outputPath, _episodeId) => {
        console.warn('[ParallelImport] Audio track completed:', trackId, outputPath)

        // Обновить путь в БД (с проверкой существования — может быть удалена при отмене импорта)
        try {
          await updateAudioTrack.mutateAsync({
            where: { id: trackId },
            data: {
              transcodedPath: outputPath,
              transcodeStatus: 'COMPLETED',
              codec: 'aac',
            },
          })
          console.warn('[ParallelImport] Audio track updated in DB:', trackId)
        } catch (err) {
          // P2025 = запись не найдена — это нормально если импорт был отменён
          const prismaError = err as { code?: string }
          if (prismaError.code === 'P2025') {
            console.warn('[ParallelImport] Audio track not found (import cancelled?):', trackId)
          } else {
            console.error('[ParallelImport] Failed to update audio track:', err)
          }
        }
      }
    )

    // Item полностью завершён
    const unsubscribeItemCompleted = api.parallelTranscode.onItemCompleted((itemId, _episodeId) => {
      console.warn('[ParallelImport] Item fully completed:', itemId)
    })

    // Ошибка в item
    const unsubscribeItemError = api.parallelTranscode.onItemError((itemId, _episodeId) => {
      console.error('[ParallelImport] Item error:', itemId)
    })

    // Ошибка в отдельной задаче
    const unsubscribeTaskError = api.parallelTranscode.onTaskError((taskId, type, error) => {
      console.error('[ParallelImport] Task error:', taskId, type, error)
    })

    return () => {
      unsubscribeProgress()
      unsubscribeVideoCompleted()
      unsubscribeAudioCompleted()
      unsubscribeItemCompleted()
      unsubscribeItemError()
      unsubscribeTaskError()
    }
  }, [dispatch, updateAudioTrack])
}

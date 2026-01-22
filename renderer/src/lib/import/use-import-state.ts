'use client'

/**
 * Хук для управления состоянием импорта
 * Использует useReducer для предсказуемого обновления состояния
 */

import { useReducer, useRef } from 'react'
import type { AudioTrackProgress, ImportAction, ImportRefs, ImportState, VideoEncodingMeta } from './types'
import { initialImportState } from './types'

/**
 * Reducer для состояния импорта
 */
export function importReducer(state: ImportState, action: ImportAction): ImportState {
  switch (action.type) {
    case 'RESET':
      return initialImportState

    case 'SET_STAGE':
      return {
        ...state,
        stage: action.stage,
        error: action.stage === 'error' ? state.error : null,
      }

    case 'SET_ERROR':
      return {
        ...state,
        stage: 'error',
        error: action.error,
      }

    case 'SET_FILE_PROGRESS':
      return {
        ...state,
        currentFile: action.currentFile,
        totalFiles: action.totalFiles,
        currentFileName: action.currentFileName,
      }

    case 'SET_TRANSCODE_PROGRESS':
      return {
        ...state,
        transcodeProgress: action.progress,
      }

    case 'SET_AUDIO_TRACKS':
      return {
        ...state,
        audioTracksTotal: action.total,
        audioTracksProgress: action.tracks,
        audioTracksCompleted: 0,
      }

    case 'UPDATE_AUDIO_TRACK': {
      // Находим трек и проверяем, изменились ли значения
      const trackIndex = state.audioTracksProgress.findIndex((t) => t.trackId === action.trackId)
      if (trackIndex === -1) {return state}

      const track = state.audioTracksProgress[trackIndex]
      const newStatus = action.status ?? track.status

      // Если значения не изменились — не создаём новый state (экономия памяти)
      if (track.percent === action.percent && track.status === newStatus) {
        return state
      }

      // Shallow copy только при реальных изменениях
      const updatedTracks = [...state.audioTracksProgress]
      updatedTracks[trackIndex] = { ...track, percent: action.percent, status: newStatus }

      // Вычисляем общий прогресс
      const totalPercent = updatedTracks.reduce((sum, t) => sum + t.percent, 0) / (updatedTracks.length || 1)

      return {
        ...state,
        audioTracksProgress: updatedTracks,
        transcodeProgress: {
          percent: totalPercent,
        },
      }
    }

    case 'COMPLETE_AUDIO_TRACK': {
      const updatedTracks = state.audioTracksProgress.map((track) =>
        track.trackId === action.trackId ? { ...track, percent: 100, status: 'completed' as const } : track
      )

      const completedCount = updatedTracks.filter((t) => t.status === 'completed').length

      return {
        ...state,
        audioTracksProgress: updatedTracks,
        audioTracksCompleted: completedCount,
      }
    }

    case 'SET_PARALLEL_PROGRESS':
      return {
        ...state,
        parallelProgress: action.progress,
        transcodeProgress: action.progress
          ? {
              percent: action.progress.totalPercent,
            }
          : null,
      }

    default:
      return state
  }
}

/**
 * Хук для управления состоянием импорта
 *
 * @returns state - текущее состояние
 * @returns dispatch - функция для отправки действий
 * @returns refs - refs для отслеживания состояния между рендерами
 */
export function useImportState() {
  const [state, dispatch] = useReducer(importReducer, initialImportState)

  const refs: ImportRefs = {
    transcodeStartTime: useRef<number | null>(null),
    createdAnimeId: useRef<string | null>(null),
    createdAnimeFolder: useRef<string | null>(null),
    isCancelled: useRef<boolean>(false),
    videoEncodingMeta: useRef<Map<string, VideoEncodingMeta>>(new Map()),
  }

  return { state, dispatch, refs }
}

/**
 * Хелперы для создания действий (action creators)
 */
export const importActions = {
  reset: (): ImportAction => ({ type: 'RESET' }),

  setStage: (stage: ImportState['stage']): ImportAction => ({ type: 'SET_STAGE', stage }),

  setError: (error: string): ImportAction => ({ type: 'SET_ERROR', error }),

  setFileProgress: (
    currentFile: number,
    totalFiles: number,
    currentFileName: string | null
  ): ImportAction => ({
    type: 'SET_FILE_PROGRESS',
    currentFile,
    totalFiles,
    currentFileName,
  }),

  setTranscodeProgress: (progress: ImportState['transcodeProgress']): ImportAction => ({
    type: 'SET_TRANSCODE_PROGRESS',
    progress,
  }),

  setAudioTracks: (total: number, tracks: AudioTrackProgress[]): ImportAction => ({
    type: 'SET_AUDIO_TRACKS',
    total,
    tracks,
  }),

  updateAudioTrack: (
    trackId: string,
    percent: number,
    status?: AudioTrackProgress['status']
  ): ImportAction => ({
    type: 'UPDATE_AUDIO_TRACK',
    trackId,
    percent,
    status,
  }),

  completeAudioTrack: (trackId: string): ImportAction => ({
    type: 'COMPLETE_AUDIO_TRACK',
    trackId,
  }),

  setParallelProgress: (progress: ImportState['parallelProgress']): ImportAction => ({
    type: 'SET_PARALLEL_PROGRESS',
    progress,
  }),
}

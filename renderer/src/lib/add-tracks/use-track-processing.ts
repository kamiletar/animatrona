'use client'

/**
 * Хук для обработки/транскодирования дорожек
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import {
  useCreateAudioTrack,
  useCreateSubtitleFont,
  useCreateSubtitleTrack,
  useDeleteAudioTrack,
  useDeleteSubtitleTrack,
} from '@/lib/hooks'

import type { AudioTask, FileProgress, SubtitleTask } from './types'
import type { UseAddTracksStateReturn } from './use-add-tracks-state'
import { formatChannels, needsAudioTranscode, runWithConcurrency } from './utils'

interface UseTrackProcessingOptions {
  /** Управление состоянием */
  stateManager: UseAddTracksStateReturn
}

/**
 * Хук для обработки/транскодирования дорожек
 */
export function useTrackProcessing(options: UseTrackProcessingOptions) {
  const { stateManager } = options
  const {
    state,
    setState,
    isCancelledRef,
    setStage,
    setError,
    updateFileProgress,
    incrementAddedTracks,
    addRecord,
    getAndClearRecords,
    setCancelled,
  } = stateManager

  const queryClient = useQueryClient()

  // Mutations
  const createAudioTrack = useCreateAudioTrack()
  const createSubtitleTrack = useCreateSubtitleTrack()
  const createSubtitleFont = useCreateSubtitleFont()
  const deleteAudioTrack = useDeleteAudioTrack()
  const deleteSubtitleTrack = useDeleteSubtitleTrack()

  /**
   * Запустить обработку (добавление дорожек)
   */
  const startProcessing = useCallback(async () => {
    const api = window.electronAPI
    if (!api) {
      setError('Electron API недоступен')
      return
    }

    if (state.selectedTracks.length === 0) {
      setError('Не выбрано ни одной дорожки')
      return
    }

    setCancelled(false)

    setState((s) => ({
      ...s,
      stage: 'processing',
      progress: {
        currentFile: 0,
        totalFiles: state.selectedTracks.length,
        currentFileName: null,
        phase: 'transcode',
        parallelProgress: null,
        addedAudioTracks: 0,
        addedSubtitleTracks: 0,
        fileProgress: [],
        concurrency: s.concurrency,
      },
      error: null,
    }))

    try {
      // === ФАЗА 1: Собрать ВСЕ задачи из ВСЕХ доноров ===
      const allAudioTasks: AudioTask[] = []
      const allSubtitleTasks: SubtitleTask[] = []

      // Используем данные напрямую из SelectedTrack (episodeId и episodeDir уже есть)
      for (const t of state.selectedTracks) {
        if (!t.episodeDir) {
          console.warn(`[AddTracks] No episode dir for track ${t.track.id}`)
          continue
        }

        if (t.type === 'audio') {
          allAudioTasks.push({
            id: t.track.id,
            type: t.track.isExternal ? 'external' : 'embedded',
            donorPath: t.matchId,
            episodeId: t.episodeId,
            episodeDir: t.episodeDir,
            trackInfo: t.track,
          })
        } else if (t.type === 'subtitle') {
          allSubtitleTasks.push({
            id: t.track.id,
            type: t.track.isExternal ? 'external' : 'embedded',
            donorPath: t.matchId,
            episodeId: t.episodeId,
            episodeDir: t.episodeDir,
            trackInfo: t.track,
          })
        }
      }

      // DEBUG: Проверяем что собрали
      console.warn('[AddTracks] Tasks collected:', {
        audio: allAudioTasks.length,
        subtitles: allSubtitleTasks.length,
        selectedTracks: state.selectedTracks.map((t) => ({ id: t.track.id, type: t.type, episodeDir: t.episodeDir })),
      })

      // === Инициализируем fileProgress для ВСЕХ задач сразу ===
      const allProgress: FileProgress[] = [
        ...allAudioTasks.map((t) => ({
          id: t.id,
          fileName:
            t.type === 'embedded'
              ? `[MKV] ${t.trackInfo.title || t.trackInfo.language || 'audio'}`
              : t.trackInfo.title || t.trackInfo.filePath?.split(/[/\\]/).pop() || 'audio',
          phase: 'waiting' as const,
          percent: 0,
        })),
        ...allSubtitleTasks.map((t) => ({
          id: t.id,
          fileName:
            t.type === 'embedded'
              ? `[SUB] ${t.trackInfo.title || t.trackInfo.language || 'subtitle'}`
              : t.trackInfo.title || t.trackInfo.filePath?.split(/[/\\]/).pop() || 'subtitle',
          phase: 'waiting' as const,
          percent: 0,
        })),
      ]

      setState((s) => ({
        ...s,
        progress: { ...s.progress, fileProgress: allProgress },
      }))

      // === ФАЗА 2: Параллельная обработка ВСЕХ аудио ===
      const processAudioTask = async (task: AudioTask, index: number) => {
        // api проверен выше в начале функции
        await processAudio(
          task,
          index,
          api as NonNullable<typeof api>,
          state.syncOffset,
          isCancelledRef,
          updateFileProgress,
          incrementAddedTracks,
          addRecord,
          createAudioTrack
        )
      }

      await runWithConcurrency(allAudioTasks, processAudioTask, state.concurrency, isCancelledRef)

      // === ФАЗА 3: Параллельная обработка ВСЕХ субтитров ===
      const processSubtitleTask = async (task: SubtitleTask, index: number) => {
        // api проверен выше в начале функции
        await processSubtitle(
          task,
          index,
          api as NonNullable<typeof api>,
          state.syncOffset,
          isCancelledRef,
          updateFileProgress,
          incrementAddedTracks,
          addRecord,
          createSubtitleTrack,
          createSubtitleFont
        )
      }

      await runWithConcurrency(allSubtitleTasks, processSubtitleTask, state.concurrency, isCancelledRef)

      // Инвалидируем кэш — используем predicate для поиска по первому элементу query key
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'episode',
      })
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'audioTracks',
      })
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'subtitleTracks',
      })

      setState((s) => ({
        ...s,
        stage: 'done',
        progress: {
          ...s.progress,
          phase: 'done',
        },
      }))
    } catch (error) {
      if (isCancelledRef.current) {
        setStage('cancelled')
      } else {
        setError(`Ошибка обработки: ${error}`)
      }
    }
  }, [
    state.selectedTracks,
    state.syncOffset,
    state.concurrency,
    queryClient,
    createAudioTrack,
    createSubtitleTrack,
    createSubtitleFont,
    setState,
    setStage,
    setError,
    isCancelledRef,
    setCancelled,
    updateFileProgress,
    incrementAddedTracks,
    addRecord,
  ])

  /**
   * Отменить процесс и откатить добавленные записи
   */
  const cancel = useCallback(async () => {
    setCancelled(true)
    setStage('cancelled')

    const api = window.electronAPI
    const records = getAndClearRecords()

    if (records.length === 0 || !api) {
      return
    }

    console.warn(`[AddTracks] Rollback: deleting ${records.length} records`)

    // Удаляем записи из БД и файлы с диска
    for (const record of records) {
      try {
        // Удаляем запись из БД
        if (record.type === 'audio') {
          await deleteAudioTrack.mutateAsync({ where: { id: record.id } })
        } else {
          await deleteSubtitleTrack.mutateAsync({ where: { id: record.id } })
        }

        // Удаляем файл с диска
        if (record.filePath) {
          await api.fs.delete(record.filePath, false)
        }

        console.warn(`[AddTracks] Deleted ${record.type} ${record.id}`)
      } catch (err) {
        console.warn(`[AddTracks] Failed to rollback ${record.type} ${record.id}:`, err)
      }
    }

    // Инвалидируем кэш
    queryClient.invalidateQueries({ queryKey: ['findManyAudioTrack'] })
    queryClient.invalidateQueries({ queryKey: ['findManySubtitleTrack'] })
  }, [deleteAudioTrack, deleteSubtitleTrack, queryClient, setCancelled, setStage, getAndClearRecords])

  return {
    startProcessing,
    cancel,
  }
}

// === Вспомогательные функции обработки ===

/**
 * Обработка одной аудио-задачи
 */
async function processAudio(
  task: AudioTask,
  index: number,
  api: NonNullable<typeof window.electronAPI>,
  syncOffset: number,
  isCancelledRef: React.RefObject<boolean>,
  updateFileProgress: (id: string, update: Partial<FileProgress>) => void,
  incrementAddedTracks: (type: 'audio' | 'subtitle') => void,
  addRecord: (record: { type: 'audio' | 'subtitle'; id: string; filePath: string }) => void,
  createAudioTrack: ReturnType<typeof useCreateAudioTrack>
): Promise<void> {
  const { id, type, donorPath, episodeId, episodeDir, trackInfo } = task

  console.warn('[AddTracks] Processing audio:', { id, type, episodeId, episodeDir })

  if (isCancelledRef.current) {
    updateFileProgress(id, { phase: 'error', error: 'Отменено' })
    return
  }

  const sourcePath = type === 'embedded' ? donorPath : trackInfo.filePath
  if (!sourcePath) {
    updateFileProgress(id, { phase: 'error', error: 'No source path' })
    return
  }

  const nextIndex = (Date.now() + index) % 100000
  const lang = trackInfo.language || 'und'
  const destPath = `${episodeDir}/audio_${type === 'embedded' ? 'donor' : 'ext'}_${nextIndex}_${lang}.m4a`

  const sourceExt = sourcePath.split('.').pop()?.toLowerCase() || ''
  const shouldTranscode = type === 'embedded' || needsAudioTranscode(sourceExt, null) || syncOffset !== 0

  updateFileProgress(id, { phase: shouldTranscode ? 'transcode' : 'copy', percent: 10 })

  try {
    if (shouldTranscode) {
      const transcodeResult = await api.ffmpeg.transcodeAudio(sourcePath, destPath, {
        bitrate: 256,
        sampleRate: 48000,
        channels: 2,
        syncOffset: syncOffset,
        streamIndex: type === 'embedded' ? trackInfo.streamIndex : undefined,
      })

      if (!transcodeResult.success) {
        updateFileProgress(id, { phase: 'error', error: transcodeResult.error || 'Transcode failed' })
        return
      }
    } else {
      const copyResult = await api.fs.copyFile(sourcePath, destPath)
      if (!copyResult.success) {
        updateFileProgress(id, { phase: 'error', error: copyResult.error || 'Copy failed' })
        return
      }
    }

    updateFileProgress(id, { percent: 80 })

    const audioRecord = await createAudioTrack.mutateAsync({
      data: {
        episodeId,
        streamIndex: nextIndex,
        language: lang,
        title: trackInfo.title || trackInfo.dubGroup || undefined,
        codec: 'aac',
        channels: type === 'embedded' ? formatChannels(trackInfo.channels) : '2.0',
        bitrate: 256000,
        isDefault: false,
        transcodedPath: destPath,
        transcodeStatus: 'COMPLETED',
        dubGroup: trackInfo.dubGroup || undefined,
      },
    })

    console.warn('[AddTracks] Audio record created:', { audioRecordId: audioRecord.id, episodeId })
    addRecord({ type: 'audio', id: audioRecord.id, filePath: destPath })
    updateFileProgress(id, { phase: 'done', percent: 100 })

    incrementAddedTracks('audio')
  } catch (err) {
    console.error('[AddTracks] Error processing audio:', id, err)
    updateFileProgress(id, { phase: 'error', error: String(err) })
  }
}

/**
 * Обработка одной субтитр-задачи
 */
async function processSubtitle(
  task: SubtitleTask,
  index: number,
  api: NonNullable<typeof window.electronAPI>,
  syncOffset: number,
  isCancelledRef: React.RefObject<boolean>,
  updateFileProgress: (id: string, update: Partial<FileProgress>) => void,
  incrementAddedTracks: (type: 'audio' | 'subtitle') => void,
  addRecord: (record: { type: 'audio' | 'subtitle'; id: string; filePath: string }) => void,
  createSubtitleTrack: ReturnType<typeof useCreateSubtitleTrack>,
  createSubtitleFont: ReturnType<typeof useCreateSubtitleFont>
): Promise<void> {
  const { id, type, donorPath, episodeId, episodeDir, trackInfo } = task

  console.warn('[AddTracks] Processing subtitle:', { id, type, episodeId, episodeDir })

  if (isCancelledRef.current) {
    updateFileProgress(id, { phase: 'error', error: 'Отменено' })
    return
  }

  const nextIndex = (Date.now() + index) % 100000
  const lang = trackInfo.language || 'und'
  const format = trackInfo.format || 'ass'
  const destPath = `${episodeDir}/subs_${type === 'embedded' ? 'donor' : 'ext'}_${nextIndex}_${lang}.${format}`

  updateFileProgress(id, { phase: 'copy', percent: 10 })

  try {
    if (type === 'external' && trackInfo.filePath) {
      // Внешний субтитр
      if (syncOffset !== 0) {
        // Инвертируем знак: для субтитров "донор опережает" = сдвиг назад
        const shiftResult = await api.subtitle.shift({
          inputPath: trackInfo.filePath,
          outputPath: destPath,
          offsetMs: -syncOffset,
        })
        if (!shiftResult.success) {
          updateFileProgress(id, { phase: 'error', error: shiftResult.error || 'Shift failed' })
          return
        }
      } else {
        const copyResult = await api.fs.copyFile(trackInfo.filePath, destPath)
        if (!copyResult.success) {
          updateFileProgress(id, { phase: 'error', error: copyResult.error || 'Copy failed' })
          return
        }
      }

      updateFileProgress(id, { percent: 80 })

      const subtitleRecord = await createSubtitleTrack.mutateAsync({
        data: {
          episodeId,
          streamIndex: -1,
          language: lang,
          title: trackInfo.title || undefined,
          format,
          filePath: destPath,
          isDefault: false,
          dubGroup: trackInfo.dubGroup || undefined,
        },
      })

      console.warn('[AddTracks] Subtitle record created (external):', {
        subtitleRecordId: subtitleRecord.id,
        episodeId,
      })
      addRecord({ type: 'subtitle', id: subtitleRecord.id, filePath: destPath })

      // Копируем шрифты для ASS
      if (trackInfo.matchedFonts && trackInfo.matchedFonts.length > 0) {
        const fontsDir = `${episodeDir}/fonts`
        for (const font of trackInfo.matchedFonts) {
          try {
            const fontFileName = font.path.split(/[/\\]/).pop() || `${font.name}.ttf`
            const destFontPath = `${fontsDir}/${fontFileName}`
            await api.fs.copyFile(font.path, destFontPath)
            await createSubtitleFont.mutateAsync({
              data: { subtitleTrackId: subtitleRecord.id, fontName: font.name, filePath: destFontPath },
            })
          } catch (fontError) {
            console.warn(`[AddTracks] Failed to copy font ${font.name}:`, fontError)
          }
        }
      }
    } else {
      // Встроенный субтитр — извлекаем через demux
      // Не используем id напрямую — он содержит ":" которые недопустимы в Windows путях
      const tempDir = `${episodeDir}/_temp_subs_${trackInfo.streamIndex}_${Date.now()}`

      console.warn('[AddTracks] Demuxing embedded subtitle:', {
        donorPath,
        tempDir,
        streamIndex: trackInfo.streamIndex,
      })

      const demuxResult = await api.ffmpeg.demux(donorPath, tempDir, {
        skipVideo: true,
        extractSubs: true,
      })

      console.warn('[AddTracks] Demux result:', {
        success: demuxResult.success,
        error: demuxResult.error,
        subtitlesCount: demuxResult.subtitles?.length,
        subtitles: demuxResult.subtitles?.map((s) => ({ index: s.index, format: s.format, path: s.path })),
      })

      if (demuxResult.success && demuxResult.subtitles) {
        const demuxedSub = demuxResult.subtitles.find((s) => s.index === trackInfo.streamIndex)

        console.warn('[AddTracks] Looking for streamIndex:', trackInfo.streamIndex, 'Found:', demuxedSub)

        if (demuxedSub && demuxedSub.path) {
          if (syncOffset !== 0) {
            // Инвертируем знак: для субтитров "донор опережает" = сдвиг назад
            const shiftResult = await api.subtitle.shift({
              inputPath: demuxedSub.path,
              outputPath: destPath,
              offsetMs: -syncOffset,
            })
            if (!shiftResult.success) {
              updateFileProgress(id, { phase: 'error', error: shiftResult.error || 'Shift failed' })
              try {
                await api.fs.delete(tempDir, false)
              } catch {
                /* ignore cleanup errors */
              }
              return
            }
          } else {
            await api.fs.copyFile(demuxedSub.path, destPath)
          }

          updateFileProgress(id, { percent: 80 })

          const embeddedSubRecord = await createSubtitleTrack.mutateAsync({
            data: {
              episodeId,
              streamIndex: nextIndex,
              language: lang,
              title: trackInfo.title || undefined,
              format: demuxedSub.format || format,
              filePath: destPath,
              isDefault: false,
              dubGroup: trackInfo.dubGroup || undefined,
            },
          })

          console.warn('[AddTracks] Subtitle record created (embedded):', {
            subtitleRecordId: embeddedSubRecord.id,
            episodeId,
          })
          addRecord({ type: 'subtitle', id: embeddedSubRecord.id, filePath: destPath })
        } else {
          updateFileProgress(id, { phase: 'error', error: 'Subtitle not found in demux result' })
          try {
            await api.fs.delete(tempDir, false)
          } catch {
            /* ignore cleanup errors */
          }
          return
        }
      } else {
        updateFileProgress(id, { phase: 'error', error: 'Demux failed' })
        return
      }

      // Удаляем временную папку
      try {
        await api.fs.delete(tempDir, false)
      } catch {
        /* ignore cleanup errors */
      }
    }

    updateFileProgress(id, { phase: 'done', percent: 100 })

    incrementAddedTracks('subtitle')
  } catch (err) {
    console.error(`[AddTracks] Error processing subtitle ${id}:`, err)
    updateFileProgress(id, { phase: 'error', error: String(err) })
  }
}

export type UseTrackProcessingReturn = ReturnType<typeof useTrackProcessing>

'use client'

/**
 * Создание аудио треков для эпизодов
 */

import type { ParsedFile } from '@/components/import/FileScanStep'
import type { FileAnalysis } from '@/components/import/PreviewStep'
import type { DemuxedAudio, DemuxResult } from '../../../../shared/types'
import { formatChannels, needsAudioTranscode } from './helpers'
import type { ImportMutations } from './use-import-mutations'

/**
 * Данные аудио трека для транскодирования
 */
export interface AudioTrackToTranscode {
  id: string
  inputPath: string
  streamIndex: number
  title: string
  language: string
  useStreamMapping: boolean
  isDonor: boolean
  isExternal?: boolean
  /** Режим passthrough — копировать без транскодирования (для AAC/MP3 с хорошим качеством) */
  passthrough?: boolean
  /** Оригинальный кодек (для passthrough режима, чтобы не менять codec в БД) */
  originalCodec?: string
}

/**
 * Создаёт аудио треки из demux результата и внешних файлов
 *
 * @param episodeId - ID эпизода
 * @param demuxResult - Результат demux
 * @param fileAnalyses - Анализ файлов с рекомендациями
 * @param file - Обрабатываемый файл
 * @param mutations - Мутации для создания треков
 * @returns Список аудио треков для транскодирования
 */
export async function createAudioTracks(
  episodeId: string,
  demuxResult: DemuxResult,
  fileAnalyses: FileAnalysis[] | undefined,
  file: ParsedFile & { episodeNumber: number },
  mutations: ImportMutations,
): Promise<AudioTrackToTranscode[]> {
  const audioTracksToTranscode: AudioTrackToTranscode[] = []

  // Находим анализ для текущего файла
  const fileAnalysis = fileAnalyses?.find((a) => a.file.episodeNumber === file.episodeNumber)

  // Обработка встроенных аудиодорожек
  if (demuxResult.audioTracks && demuxResult.audioTracks.length > 0) {
    const audioTrackPromises = demuxResult.audioTracks.map(async (track: DemuxedAudio, arrayIndex: number) => {
      const shouldTranscode = needsAudioTranscode(track.codec, track.bitrate)

      // Находим рекомендацию для этой дорожки чтобы получить dubGroup/language из UI
      const rec = fileAnalysis?.audioRecommendations.find((r) => r.trackIndex === arrayIndex && !r.isExternal)

      const audioTrackResult = await mutations.createAudioTrack.mutateAsync({
        data: {
          episodeId,
          streamIndex: track.index,
          language: rec?.language || track.language || 'und',
          title: track.title || undefined,
          codec: track.codec,
          channels: formatChannels(track.channels),
          bitrate: track.bitrate,
          isDefault: track.index === 0,
          dubGroup: rec?.dubGroup || rec?.groupName || undefined,
        },
      })

      // Всегда добавляем дорожку в очередь обработки
      // Если не нужно транскодировать — используем passthrough режим (копирование)
      const inputPath = track.path || track.sourceFile

      if (inputPath) {
        return {
          id: audioTrackResult.id,
          inputPath,
          streamIndex: track.index,
          title: track.title || 'Аудио',
          language: track.language || 'und',
          useStreamMapping: track.path === null,
          isDonor: false,
          passthrough: !shouldTranscode,
          originalCodec: !shouldTranscode ? track.codec : undefined,
        }
      }

      return null
    })

    const results = await Promise.all(audioTrackPromises)
    audioTracksToTranscode.push(...results.filter((r): r is NonNullable<typeof r> => r !== null))
  }

  // Внешние аудиодорожки из fileAnalyses
  const selectedExternalAudio =
    fileAnalysis?.audioRecommendations.filter((r) => r.enabled && r.isExternal && r.externalPath) || []

  if (selectedExternalAudio.length > 0) {
    for (const rec of selectedExternalAudio) {
      const extPath = rec.externalPath
      if (!extPath) continue

      try {
        const audioTrackResult = await mutations.createAudioTrack.mutateAsync({
          data: {
            episodeId,
            streamIndex: -1,
            language: rec.language || 'ru',
            title: rec.groupName || 'External',
            codec: 'external',
            channels: '2.0',
            bitrate: 0,
            isDefault: false,
            dubGroup: rec.dubGroup || rec.groupName || undefined,
          },
        })

        audioTracksToTranscode.push({
          id: audioTrackResult.id,
          inputPath: extPath,
          streamIndex: -1,
          title: rec.groupName || 'External',
          language: rec.language || 'ru',
          useStreamMapping: false,
          isDonor: false,
          isExternal: true,
        })
      } catch (extAudioError) {
        console.warn(`[AudioTrackCreator] Failed to process external audio:`, extAudioError)
      }
    }
  }

  return audioTracksToTranscode
}

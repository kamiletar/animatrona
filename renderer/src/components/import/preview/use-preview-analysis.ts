'use client'

/**
 * Хук для анализа файлов в PreviewStep
 */

import { useCallback, useEffect, useState } from 'react'

import type { ParsedFile } from '../FileScanStep'

import type { AudioRecommendation, FileAnalysis, SubtitleRecommendation } from './types'
import { formatChannels, getAudioRecommendation } from './utils'

interface UsePreviewAnalysisOptions {
  /** Выбранные файлы */
  files: ParsedFile[]
  /** Путь к папке с файлами */
  folderPath: string
  /** Callback при завершении анализа */
  onAnalysisComplete: (analyses: FileAnalysis[]) => void
}

/**
 * Хук для анализа файлов
 */
export function usePreviewAnalysis(options: UsePreviewAnalysisOptions) {
  const { files, folderPath, onAnalysisComplete } = options

  const [analyses, setAnalyses] = useState<FileAnalysis[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)

  const selectedFiles = files.filter(
    (f): f is ParsedFile & { episodeNumber: number } => f.selected && f.episodeNumber !== null
  )

  /** Анализ одного файла через probe (без извлечения) */
  const analyzeFile = useCallback(async (file: ParsedFile): Promise<FileAnalysis> => {
    const api = window.electronAPI
    if (!api) {
      return {
        file,
        mediaInfo: null,
        isAnalyzing: false,
        error: 'Electron API недоступен',
        audioRecommendations: [],
        subtitleRecommendations: [],
      }
    }

    try {
      const probeResult = await api.ffmpeg.probe(file.path)

      if (!probeResult.success || !probeResult.data) {
        return {
          file,
          mediaInfo: null,
          isAnalyzing: false,
          error: probeResult.error || 'Ошибка анализа',
          audioRecommendations: [],
          subtitleRecommendations: [],
        }
      }

      const mediaInfo = probeResult.data

      // Формируем рекомендации для аудиодорожек
      // Используем индекс массива, а не stream index из контейнера
      const audioRecommendations: AudioRecommendation[] = mediaInfo.audioTracks.map((track, arrayIndex) => {
        const rec = getAudioRecommendation(track)
        return {
          trackIndex: arrayIndex,
          action: rec.action,
          reason: rec.reason,
          enabled: true, // По умолчанию все включены
        }
      })

      // Формируем рекомендации для встроенных субтитров
      const subtitleRecommendations: SubtitleRecommendation[] = (mediaInfo.subtitleTracks || []).map((sub, idx) => ({
        streamIndex: idx,
        language: sub.language,
        title: sub.title || 'Субтитры',
        format: 'embedded',
        isExternal: false,
        enabled: true, // По умолчанию все включены
      }))

      return {
        file,
        mediaInfo,
        isAnalyzing: false,
        error: null,
        audioRecommendations,
        subtitleRecommendations,
      }
    } catch (error) {
      return {
        file,
        mediaInfo: null,
        isAnalyzing: false,
        error: error instanceof Error ? error.message : String(error),
        audioRecommendations: [],
        subtitleRecommendations: [],
      }
    }
  }, [])

  /** Запуск анализа всех файлов */
  const startAnalysis = useCallback(async () => {
    setIsAnalyzing(true)
    setOverallProgress(0)

    // Инициализируем состояние анализа
    const initialAnalyses: FileAnalysis[] = selectedFiles.map((file) => ({
      file,
      mediaInfo: null,
      isAnalyzing: true,
      error: null,
      audioRecommendations: [],
      subtitleRecommendations: [],
    }))
    setAnalyses(initialAnalyses)

    const results: FileAnalysis[] = []

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      const result = await analyzeFile(file)
      results.push(result)

      // Обновляем состояние
      setAnalyses((prev) => prev.map((a, idx) => (idx === i ? result : a)))
      setOverallProgress(((i + 1) / selectedFiles.length) * 100)
    }

    // Сканируем внешние субтитры и аудио
    const api = window.electronAPI
    if (api && folderPath) {
      try {
        const videoFiles = selectedFiles
          .filter((f): f is typeof f & { episodeNumber: number } => f.episodeNumber !== null)
          .map((f) => ({
            path: f.path,
            episodeNumber: f.episodeNumber,
          }))

        // Сканируем внешние субтитры
        const externalSubs = await api.fs.scanExternalSubtitles(folderPath, videoFiles)

        if (externalSubs.subtitles.length > 0) {
          // Группируем внешние субтитры по эпизодам
          const externalSubsMap = new Map<number, typeof externalSubs.subtitles>()
          for (const sub of externalSubs.subtitles) {
            if (sub.episodeNumber !== null) {
              const arr = externalSubsMap.get(sub.episodeNumber) || []
              arr.push(sub)
              externalSubsMap.set(sub.episodeNumber, arr)
            }
          }

          // Добавляем внешние субтитры к результатам анализа
          for (let i = 0; i < results.length; i++) {
            const episodeNumber = results[i].file.episodeNumber
            if (episodeNumber !== null) {
              const externalForEpisode = externalSubsMap.get(episodeNumber) || []
              const externalRecs: SubtitleRecommendation[] = externalForEpisode.map((sub) => ({
                streamIndex: -1, // Внешний файл — индекс не нужен
                language: sub.language,
                title: sub.title,
                format: sub.format,
                isExternal: true,
                externalPath: sub.filePath,
                matchedFonts: sub.matchedFonts,
                enabled: true,
              }))

              results[i] = {
                ...results[i],
                subtitleRecommendations: [...results[i].subtitleRecommendations, ...externalRecs],
              }
            }
          }

          // Обновляем состояние с внешними субтитрами
          setAnalyses([...results])

          // Выводим предупреждение о несматченных файлах
          if (externalSubs.unmatchedFiles.length > 0) {
            console.warn('[PreviewStep] Несматченные файлы субтитров:', externalSubs.unmatchedFiles)
          }
        }

        // Сканируем внешние аудио (Rus Sound/, Audio/ и т.д.)
        const externalAudio = await api.fs.scanExternalAudio(folderPath, videoFiles)

        if (externalAudio.audioTracks.length > 0) {
          // Группируем внешние аудио по эпизодам
          const externalAudioMap = new Map<number, typeof externalAudio.audioTracks>()
          for (const audio of externalAudio.audioTracks) {
            if (audio.episodeNumber !== null) {
              const arr = externalAudioMap.get(audio.episodeNumber) || []
              arr.push(audio)
              externalAudioMap.set(audio.episodeNumber, arr)
            }
          }

          // Добавляем внешние аудио к результатам анализа
          for (let i = 0; i < results.length; i++) {
            const episodeNumber = results[i].file.episodeNumber
            if (episodeNumber !== null) {
              const externalForEpisode = externalAudioMap.get(episodeNumber) || []
              const externalRecs: AudioRecommendation[] = externalForEpisode.map((audio, idx) => ({
                trackIndex: -1000 - idx, // Отрицательный индекс для внешних файлов
                action: 'transcode' as const,
                reason: `${audio.codec.toUpperCase()} ${formatChannels(audio.channels)} → AAC 256 kbps`,
                enabled: true,
                isExternal: true,
                externalPath: audio.filePath,
                groupName: audio.groupName,
                language: audio.language,
              }))

              results[i] = {
                ...results[i],
                audioRecommendations: [...results[i].audioRecommendations, ...externalRecs],
              }
            }
          }

          // Обновляем состояние с внешними аудио
          setAnalyses([...results])

          // Выводим предупреждение о несматченных файлах
          if (externalAudio.unmatchedFiles.length > 0) {
            console.warn('[PreviewStep] Несматченные файлы аудио:', externalAudio.unmatchedFiles)
          }

          console.warn(
            '[PreviewStep] Найдено внешних аудио:',
            externalAudio.audioTracks.length,
            'из папок:',
            externalAudio.audioDirs
          )
        }
      } catch (error) {
        console.error('[PreviewStep] Ошибка сканирования внешних субтитров/аудио:', error)
      }
    }

    setIsAnalyzing(false)
    onAnalysisComplete(results)
  }, [selectedFiles, analyzeFile, onAnalysisComplete, folderPath])

  /** Переключение аудиодорожки */
  const handleToggleTrack = useCallback((episodeNumber: number, trackIndex: number, enabled: boolean) => {
    setAnalyses((prev) =>
      prev.map((analysis) => {
        if (analysis.file.episodeNumber !== episodeNumber) {
          return analysis
        }

        return {
          ...analysis,
          audioRecommendations: analysis.audioRecommendations.map((rec) =>
            rec.trackIndex === trackIndex ? { ...rec, enabled } : rec
          ),
        }
      })
    )
  }, [])

  /** Переключение субтитров */
  const handleToggleSubtitle = useCallback((episodeNumber: number, subtitleIndex: number, enabled: boolean) => {
    setAnalyses((prev) =>
      prev.map((analysis) => {
        if (analysis.file.episodeNumber !== episodeNumber) {
          return analysis
        }

        return {
          ...analysis,
          subtitleRecommendations: analysis.subtitleRecommendations.map((rec, idx) =>
            idx === subtitleIndex ? { ...rec, enabled } : rec
          ),
        }
      })
    )
  }, [])

  // Запускаем анализ при монтировании
  useEffect(() => {
    if (selectedFiles.length > 0 && analyses.length === 0) {
      startAnalysis()
    }
  }, [selectedFiles.length, analyses.length, startAnalysis])

  // Уведомляем родителя об изменениях
  useEffect(() => {
    if (analyses.length > 0 && !isAnalyzing) {
      onAnalysisComplete(analyses)
    }
  }, [analyses, isAnalyzing, onAnalysisComplete])

  const analyzedCount = analyses.filter((a) => !a.isAnalyzing && !a.error).length
  const errorCount = analyses.filter((a) => a.error).length

  return {
    // Состояние
    analyses,
    isAnalyzing,
    overallProgress,
    selectedFiles,
    analyzedCount,
    errorCount,

    // Обработчики
    startAnalysis,
    handleToggleTrack,
    handleToggleSubtitle,
  }
}

export type UsePreviewAnalysisReturn = ReturnType<typeof usePreviewAnalysis>

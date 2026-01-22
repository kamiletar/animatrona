'use client'

/**
 * Процессор импорта аниме
 * Содержит основную логику startImport без React зависимостей
 */

import { syncAnimeRelations } from '@/app/_actions/anime-relation.action'
import { findUniqueEncodingProfile, getDefaultEncodingProfile } from '@/app/_actions/encoding-profile.action'
import { findManyEpisodes } from '@/app/_actions/episode.action'
import { saveExtendedMetadata } from '@/app/_actions/extended-metadata.action'
import type { ParsedFile } from '@/components/import/FileScanStep'
import type { FileAnalysis } from '@/components/import/PreviewStep'
import type { EncodingProfile, RelationKind } from '@/generated/prisma'
import type { ExternalSubtitleMatch } from '@/types/electron'
import type { QueryClient } from '@tanstack/react-query'

import type { Chapter, DemuxedAudio, DemuxedSubtitle, DemuxResult } from '../../../../shared/types'
import type { BatchImportItem } from '../../../../shared/types/parallel-transcode'

import { stripHtmlTags } from '../html-utils'
import {
  createConcurrencyLimiter,
  detectChapterType,
  formatChannels,
  getPosterUrl,
  isChapterSkippable,
  mapSeasonType,
  mapShikimoriAgeRating,
  mapShikimoriStatus,
  needsAudioTranscode,
} from './helpers'
import type { ImportAction, ImportOptions, ImportRefs, ImportResult, PostProcessData, ProcessingStage } from './types'
import type { ImportMutations } from './use-import-mutations'

type Dispatch = React.Dispatch<ImportAction>

/**
 * Процессор импорта — выполняет основную логику
 */
export class ImportProcessor {
  constructor(
    private mutations: ImportMutations,
    private dispatch: Dispatch,
    private refs: ImportRefs,
    private queryClient: QueryClient
  ) {}

  /**
   * Обновляет стадию импорта
   */
  private setStage(stage: ProcessingStage) {
    this.dispatch({ type: 'SET_STAGE', stage })
  }

  /**
   * Обновляет прогресс файлов
   */
  private setFileProgress(currentFile: number, totalFiles: number, currentFileName: string | null) {
    this.dispatch({ type: 'SET_FILE_PROGRESS', currentFile, totalFiles, currentFileName })
  }

  /**
   * Устанавливает ошибку
   */
  private setError(error: string) {
    this.dispatch({ type: 'SET_ERROR', error })
  }

  /**
   * Сбрасывает состояние
   */
  private reset() {
    this.dispatch({ type: 'RESET' })
  }

  /**
   * Проверяет, был ли импорт отменён
   */
  private get isCancelled() {
    return this.refs.isCancelled.current
  }

  /**
   * Запуск импорта
   */
  async process(options: ImportOptions): Promise<ImportResult> {
    const {
      parsedInfo,
      selectedAnime,
      files,
      queueItemId,
      importSettings,
      fileAnalyses,
      donorPath: _donorPath,
      donorFiles: _donorFiles,
      syncOffset,
      useCpuFallback,
      vmafScore,
    } = options

    const selectedFiles = files.filter(
      (f): f is ParsedFile & { episodeNumber: number } => f.selected && f.episodeNumber !== null
    )

    if (selectedFiles.length === 0) {
      return { success: false, error: 'Нет выбранных файлов' }
    }

    // Сбрасываем флаг отмены при старте
    this.refs.isCancelled.current = false
    this.reset()
    this.setFileProgress(0, selectedFiles.length, null)

    // Загружаем профиль кодирования
    let encodingProfile = null
    try {
      if (importSettings?.profileId) {
        encodingProfile = await findUniqueEncodingProfile(importSettings.profileId)
      }
      if (!encodingProfile) {
        encodingProfile = await getDefaultEncodingProfile()
      }
      console.warn('[Import] Используем профиль:', encodingProfile?.name ?? 'default hardcoded')
    } catch (error) {
      console.warn('[Import] Не удалось загрузить профиль, используем дефолтные настройки:', error)
    }

    // Настройки потоков
    const audioMaxConcurrent = importSettings?.audioMaxConcurrent ?? 4
    const videoMaxConcurrent = importSettings?.videoMaxConcurrent ?? 2
    console.warn('[Import] Макс. видео-потоков:', videoMaxConcurrent, 'Макс. аудио-потоков:', audioMaxConcurrent)

    // Коллекции для batch транскодирования
    const batchItems: BatchImportItem[] = []
    const episodeOutputDirs = new Map<string, string>()
    const postProcessDataMap = new Map<string, PostProcessData>()

    try {
      // 0. Получаем путь к библиотеке
      const libraryPath = await window.electronAPI?.library.getDefaultPath()
      if (!libraryPath) {
        throw new Error('Не удалось получить путь к библиотеке')
      }

      // 0.1 Получаем версию FFmpeg и модель оборудования
      let ffmpegVersion: string | undefined
      let hardwareModel: string | undefined
      if (window.electronAPI?.ffmpeg) {
        const [versionResult, hardwareResult] = await Promise.all([
          window.electronAPI.ffmpeg.getVersion(),
          window.electronAPI.ffmpeg.getHardwareInfo(),
        ])
        if (versionResult.success && versionResult.data) {
          ffmpegVersion = versionResult.data
        }
        if (hardwareResult.success && hardwareResult.data) {
          // Выбираем модель в зависимости от типа энкодера
          hardwareModel = useCpuFallback
            ? hardwareResult.data.cpuModel
            : (hardwareResult.data.gpuModel ?? hardwareResult.data.cpuModel)
        }
        console.warn(`[Import] FFmpeg: ${ffmpegVersion}, Hardware: ${hardwareModel}`)
      }

      const animeName = selectedAnime.russian ?? selectedAnime.name

      // Создаём папку аниме
      const animeFolderPath = await window.electronAPI?.library.ensureAnimeDirectory(libraryPath, animeName)
      if (!animeFolderPath) {
        throw new Error('Не удалось создать папку аниме')
      }

      // 1. Скачиваем постер и создаём аниме
      this.setStage('creating_anime')

      let posterId: string | undefined
      // Приоритет: originalUrl (полный размер) > mainUrl (превью)
      // Используем || вместо ?? чтобы пустые строки тоже обрабатывались
      console.log('[ImportProcessor] Poster URLs:', {
        originalUrl: selectedAnime.poster?.originalUrl,
        mainUrl: selectedAnime.poster?.mainUrl,
      })
      const posterUrl = getPosterUrl(selectedAnime.poster?.originalUrl || selectedAnime.poster?.mainUrl)
      console.log('[ImportProcessor] Using poster URL:', posterUrl)

      if (posterUrl && window.electronAPI) {
        const posterResult = await window.electronAPI.shikimori.downloadPoster(posterUrl, selectedAnime.id, {
          savePath: animeFolderPath,
        })
        if (posterResult.success && posterResult.localPath) {
          const fileResult = await this.mutations.upsertFile.mutateAsync({
            data: {
              filename: posterResult.filename ?? `${selectedAnime.id}.jpg`,
              path: posterResult.localPath,
              mimeType: posterResult.mimeType ?? 'image/jpeg',
              size: posterResult.size ?? 0,
              width: posterResult.width,
              height: posterResult.height,
              blurDataURL: posterResult.blurDataURL,
              category: 'POSTER',
              source: 'shikimori',
            },
          })
          posterId = fileResult.id
        }
      }

      // 2. Создаём запись аниме
      // Поля, которые есть только в ShikimoriAnimeDetails (не в Preview)
      const isDetailed = 'licensors' in selectedAnime
      const licenseNameRu = isDetailed ? selectedAnime.licenseNameRu : null
      const licensors = isDetailed ? selectedAnime.licensors : null
      const japanese = isDetailed ? selectedAnime.japanese : null
      const english = isDetailed ? selectedAnime.english : null
      const ageRating = isDetailed ? selectedAnime.rating : null
      const duration = isDetailed ? selectedAnime.duration : null
      const synonyms = isDetailed && selectedAnime.synonyms?.length ? JSON.stringify(selectedAnime.synonyms) : null

      // Извлекаем лицензиата
      const licensor = licenseNameRu ?? (licensors?.length ? licensors[0] : null)

      const animeResult = await this.mutations.upsertAnime.mutateAsync({
        data: {
          name: selectedAnime.russian ?? selectedAnime.name,
          originalName: japanese ?? selectedAnime.name,
          nameEn: english ?? null,
          description: selectedAnime.description ?? stripHtmlTags(selectedAnime.descriptionHtml),
          year: selectedAnime.airedOn?.year ?? null,
          status: mapShikimoriStatus(selectedAnime.status),
          shikimoriId: parseInt(selectedAnime.id, 10),
          posterId,
          folderPath: animeFolderPath,
          episodeCount: selectedAnime.episodes || 0,
          rating: selectedAnime.score ?? null,
          isBdRemux: parsedInfo.isBdRemux,
          // Альтернативные названия с Shikimori для полнотекстового поиска
          synonyms,
          // Новые поля из Shikimori (только если загружены детали)
          ageRating: mapShikimoriAgeRating(ageRating),
          duration: duration ?? null,
          licensor,
        },
      })

      const animeId = animeResult.id

      // Сохраняем для отката при отмене
      this.refs.createdAnimeId.current = animeId
      this.refs.createdAnimeFolder.current = animeFolderPath

      // 2.5. Записываем anime.meta.json для возможности восстановления библиотеки
      // Примечание: пользовательские данные (watchStatus, userRating и т.д.) хранятся отдельно в _user/
      try {
        await window.electronAPI?.backup.writeAnimeMeta({
          animeFolder: animeFolderPath,
          shikimoriId: parseInt(selectedAnime.id, 10),
          isBdRemux: parsedInfo.isBdRemux,
          fallbackInfo: {
            name: selectedAnime.russian ?? selectedAnime.name,
            originalName: selectedAnime.name,
            year: selectedAnime.airedOn?.year ?? undefined,
          },
        })
      } catch (err) {
        // Не критично — просто логируем
        console.warn('[ImportFlow] Failed to write anime.meta.json:', err)
      }

      // 2.6. Сохраняем расширенные метаданные (fandubbers, fansubbers, жанры, темы)
      // Если selectedAnime содержит extended данные, сохраняем их
      // TypeScript не сужает тип после 'in' check, поэтому используем any
      const extendedAnime = selectedAnime as {
        studios?: unknown[]
        personRoles?: unknown[]
        characterRoles?: unknown[]
        fandubbers?: string[]
        fansubbers?: string[]
        externalLinks?: unknown[]
        nextEpisodeAt?: string | null
        genres?: Array<{ id: string; name: string; russian: string; kind?: 'genre' | 'theme' }>
      }

      // Проверяем наличие любых extended данных
      const hasExtendedData =
        'fandubbers' in selectedAnime ||
        'fansubbers' in selectedAnime ||
        'studios' in selectedAnime ||
        'genres' in selectedAnime ||
        'personRoles' in selectedAnime ||
        'characterRoles' in selectedAnime ||
        'externalLinks' in selectedAnime

      if (hasExtendedData) {
        try {
          await saveExtendedMetadata(animeId, {
            studios: (extendedAnime.studios ?? []) as Parameters<typeof saveExtendedMetadata>[1]['studios'],
            personRoles: (extendedAnime.personRoles ?? []) as Parameters<typeof saveExtendedMetadata>[1]['personRoles'],
            characterRoles: (extendedAnime.characterRoles ?? []) as Parameters<
              typeof saveExtendedMetadata
            >[1]['characterRoles'],
            fandubbers: extendedAnime.fandubbers ?? [],
            fansubbers: extendedAnime.fansubbers ?? [],
            externalLinks: (extendedAnime.externalLinks ?? []) as Parameters<
              typeof saveExtendedMetadata
            >[1]['externalLinks'],
            videos: [], // Не сохраняем видео при импорте (пользователь сказал "не хочу videos")
            nextEpisodeAt: extendedAnime.nextEpisodeAt ?? null,
            // Жанры из Shikimori - kind может отсутствовать в старых данных, fallback на 'genre'
            genres: (extendedAnime.genres ?? []).map((g) => ({
              id: g.id,
              name: g.name,
              russian: g.russian,
              kind: g.kind ?? 'genre',
            })),
          })
          console.warn('[ImportFlow] Extended metadata saved')
        } catch (err) {
          console.warn('[ImportFlow] Failed to save extended metadata:', err)
        }
      }

      // 3. Создаём или получаем сезон (upsert)
      const seasonNum = parsedInfo.seasonNumber ?? 1
      const seasonResult = await this.mutations.upsertSeason.mutateAsync({
        data: {
          animeId,
          number: seasonNum,
          name: `Сезон ${seasonNum}`,
          type: mapSeasonType(selectedAnime.kind),
        },
      })
      const seasonId = seasonResult.id

      // 4. Сканируем внешние субтитры
      const externalSubsMap = await this.scanExternalSubtitles(options.folderPath, selectedFiles)

      // 5. Обрабатываем файлы
      this.setStage('demuxing')

      if (!window.electronAPI) {
        throw new Error('Electron API недоступен')
      }
      const electronApi = window.electronAPI

      const demuxLimiter = createConcurrencyLimiter(2)
      let completedFiles = 0

      // Обработка одного файла
      const processFile = async (file: ParsedFile & { episodeNumber: number }) => {
        if (this.isCancelled) {
          throw new Error('Импорт отменён')
        }

        const api = window.electronAPI
        if (!api) {
          throw new Error('electronAPI недоступен')
        }

        // Создаём структуру папок
        const episodeOutputDir = await api.library.ensureEpisodeDirectory({
          libraryPath,
          animeName,
          seasonNumber: seasonNum,
          episodeNumber: file.episodeNumber,
        })

        // Demux файла
        const demuxResult = await demuxLimiter(() => {
          this.setFileProgress(completedFiles, selectedFiles.length, file.name)
          return api.ffmpeg.demux(file.path, episodeOutputDir, {
            skipVideo: true,
            audioExtractMode: 'smart',
          })
        })

        if (!demuxResult.success) {
          console.warn(`Demux failed for ${file.name}:`, demuxResult.error)
        }

        completedFiles++
        this.setFileProgress(completedFiles, selectedFiles.length, null)

        if (this.isCancelled) {
          throw new Error('Импорт отменён')
        }

        // Подготавливаем данные
        const videoOutputPath = `${episodeOutputDir}/video.webm`
        const videoInputPath = demuxResult.video?.path

        // Создаём или обновляем Episode (upsert по animeId + number)
        const episodeResult = await this.mutations.upsertEpisode.mutateAsync({
          data: {
            animeId,
            seasonId,
            number: file.episodeNumber,
            name: undefined,
            sourcePath: file.path,
            durationMs: demuxResult.video ? Math.round(demuxResult.video.duration * 1000) : undefined,
            videoWidth: demuxResult.video?.width,
            videoHeight: demuxResult.video?.height,
            videoCodec: demuxResult.video?.codec,
            videoBitDepth: demuxResult.video?.bitDepth,
            transcodedPath: undefined,
            transcodeStatus: 'QUEUED',
          },
        })

        const episodeId = episodeResult.id

        // Сохраняем данные для пост-обработки
        episodeOutputDirs.set(episodeId, episodeOutputDir)
        postProcessDataMap.set(episodeId, {
          episodeId,
          outputDir: episodeOutputDir,
          videoOutputPath,
          duration: demuxResult.video?.duration ?? 0,
          demuxResult,
          animeName,
          seasonNumber: seasonNum,
          episodeNumber: file.episodeNumber,
          sourcePath: file.path,
        })

        // Создаём AudioTrack записи
        const audioTracksToTranscode = await this.createAudioTracks(
          episodeId,
          demuxResult,
          fileAnalyses,
          file,
          episodeOutputDir
        )

        // Создаём SubtitleTrack записи
        await this.createSubtitleTracks(
          episodeId,
          demuxResult,
          fileAnalyses,
          file,
          episodeOutputDir,
          externalSubsMap,
          api
        )

        // Создаём Chapter записи
        await this.createChapters(episodeId, demuxResult)

        // Возвращаем BatchImportItem для транскодирования
        if (videoInputPath) {
          const effectiveCq = importSettings?.cqOverride ?? encodingProfile?.cq ?? 28
          const cqSource = importSettings?.cqOverride ? 'VMAF' : encodingProfile?.cq ? 'profile' : 'default'
          console.warn(`[Import] CQ=${effectiveCq} (source: ${cqSource})`)
          const videoOptions = this.buildVideoOptions(encodingProfile, effectiveCq)

          // Обновляем postProcessData с настройками кодирования
          const existingData = postProcessDataMap.get(episodeId)
          if (existingData) {
            postProcessDataMap.set(episodeId, {
              ...existingData,
              encodingProfileId: encodingProfile?.id,
              encodingProfileName: encodingProfile?.name,
              videoOptions: {
                codec: videoOptions.codec,
                cq: videoOptions.cq,
                preset: videoOptions.preset,
                rateControl: videoOptions.rateControl,
                tune: videoOptions.tune,
                multipass: videoOptions.multipass,
                spatialAq: videoOptions.spatialAq,
                temporalAq: videoOptions.temporalAq,
                aqStrength: videoOptions.aqStrength,
                gopSize: videoOptions.gopSize,
                lookahead: videoOptions.lookahead ?? undefined,
                bRefMode: videoOptions.bRefMode,
                force10Bit: videoOptions.force10Bit,
              },
              // Новые поля v0.10.0
              vmafScore,
              encoderType: useCpuFallback ? 'cpu' : 'gpu',
              ffmpegVersion,
              hardwareModel,
              // Лимиты потоков
              videoMaxConcurrent,
              audioMaxConcurrent,
              // ffmpegCommand, transcodeDurationMs, activeGpuWorkers — заполняются из videoEncodingMeta при пост-обработке
            })
          }

          return {
            id: `import-${episodeId}`,
            episodeId,
            animeQueueItemId: queueItemId,
            video: {
              inputPath: videoInputPath,
              outputPath: videoOutputPath,
              options: videoOptions,
              useCpuFallback,
            },
            audioTracks: audioTracksToTranscode.map((track) => ({
              trackId: track.id,
              trackIndex: track.streamIndex,
              inputPath: track.inputPath,
              outputPath: track.isExternal
                ? `${episodeOutputDir}/audio_external_${track.id}.m4a`
                : track.useStreamMapping
                  ? `${episodeOutputDir}/audio_${track.streamIndex}_${track.language}.m4a`
                  : track.inputPath.replace(/\.\w+$/, '.m4a'),
              options: { targetBitrate: 256 },
              useStreamMapping: track.useStreamMapping,
              syncOffset: track.isDonor && syncOffset ? syncOffset : undefined,
              isExternal: track.isExternal,
              title: track.isExternal ? track.title : undefined,
              language: track.isExternal ? track.language : undefined,
            })),
          } as BatchImportItem
        }

        return null
      }

      // Запускаем обработку файлов
      this.setStage('creating_episodes')
      const batchResults = await Promise.all(selectedFiles.map((file) => processFile(file)))
      batchItems.push(...batchResults.filter((item): item is BatchImportItem => item !== null))

      // 6. Параллельное транскодирование
      if (batchItems.length > 0) {
        this.setStage('transcoding_video')

        // Ждём завершения
        await this.runParallelTranscode(
          batchItems,
          episodeOutputDirs,
          electronApi,
          videoMaxConcurrent,
          audioMaxConcurrent
        )

        // 7. Пост-обработка
        this.setStage('generating_manifests')
        await this.runPostProcess(postProcessDataMap, electronApi)
      }

      // 8. Синхронизация связей
      await this.syncRelations(animeId, selectedAnime)

      // 9. Обновление навигации между эпизодами
      await this.updateEpisodeNavigation(animeId)

      // 10. Инвалидируем кэш
      await this.invalidateCache()

      this.setStage('done')

      return {
        success: true,
        animeId,
        episodeCount: selectedFiles.length,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Отмена импорта
   */
  async cancel(): Promise<void> {
    const api = window.electronAPI
    if (!api) {
      return
    }

    try {
      console.warn('[ImportFlow] Cancelling import...')

      // 1. Устанавливаем флаг отмены
      this.refs.isCancelled.current = true
      await new Promise((resolve) => setTimeout(resolve, 100))

      // 2. Останавливаем FFmpeg
      await api.parallelTranscode.cancelAll()
      await new Promise((resolve) => setTimeout(resolve, 500))

      // 3. Удаляем файлы
      if (this.refs.createdAnimeFolder.current) {
        console.warn('[ImportFlow] Deleting folder:', this.refs.createdAnimeFolder.current)
        let deleted = false
        for (let attempt = 1; attempt <= 3 && !deleted; attempt++) {
          try {
            const result = await api.fs.delete(this.refs.createdAnimeFolder.current, true)
            if (result.success) {
              console.warn('[ImportFlow] Folder deleted successfully')
              deleted = true
            } else {
              console.warn(`[ImportFlow] Delete attempt ${attempt} failed:`, result.error)
              if (attempt < 3) {
                await new Promise((r) => setTimeout(r, 500))
              }
            }
          } catch (fsError) {
            console.error(`[ImportFlow] Delete attempt ${attempt} exception:`, fsError)
            if (attempt < 3) {
              await new Promise((r) => setTimeout(r, 500))
            }
          }
        }
        if (!deleted) {
          console.warn(
            '[ImportFlow] ⚠️ Не удалось удалить папку, удалите вручную:',
            this.refs.createdAnimeFolder.current
          )
        }
      }

      // 4. Удаляем из БД
      if (this.refs.createdAnimeId.current) {
        console.warn('[ImportFlow] Deleting anime from DB:', this.refs.createdAnimeId.current)
        try {
          await this.mutations.deleteAnime.mutateAsync({ where: { id: this.refs.createdAnimeId.current } })
          console.warn('[ImportFlow] Anime deleted from DB successfully')
        } catch (dbError) {
          console.error('[ImportFlow] Failed to delete anime from DB:', dbError)
        }
      }

      // 5. Сбрасываем refs
      this.refs.createdAnimeId.current = null
      this.refs.createdAnimeFolder.current = null

      // Инвалидируем кэш
      await this.invalidateCache()

      this.dispatch({ type: 'SET_STAGE', stage: 'cancelled' })
      this.setError('Импорт отменён пользователем')
    } catch (error) {
      console.error('[ImportFlow] Cancel error:', error)
    }
  }

  // ========================
  // Вспомогательные методы
  // ========================

  /**
   * Сканирование внешних субтитров
   */
  private async scanExternalSubtitles(
    folderPath: string,
    selectedFiles: Array<ParsedFile & { episodeNumber: number }>
  ): Promise<Map<number, ExternalSubtitleMatch[]>> {
    const externalSubsMap = new Map<number, ExternalSubtitleMatch[]>()

    try {
      const externalSubs = await window.electronAPI?.fs.scanExternalSubtitles(
        folderPath,
        selectedFiles.map((f) => ({ path: f.path, episodeNumber: f.episodeNumber }))
      )

      if (externalSubs) {
        for (const sub of externalSubs.subtitles) {
          if (sub.episodeNumber !== null) {
            const existing = externalSubsMap.get(sub.episodeNumber) || []
            existing.push(sub)
            externalSubsMap.set(sub.episodeNumber, existing)
          }
        }
      }
    } catch (scanError) {
      console.warn('[ImportFlow] Failed to scan external subtitles:', scanError)
    }

    return externalSubsMap
  }

  /**
   * Создание аудиодорожек
   */
  private async createAudioTracks(
    episodeId: string,
    demuxResult: DemuxResult,
    fileAnalyses: FileAnalysis[] | undefined,
    file: ParsedFile & { episodeNumber: number },
    _episodeOutputDir: string // Зарезервировано для будущего использования
  ) {
    const audioTracksToTranscode: {
      id: string
      inputPath: string
      streamIndex: number
      title: string
      language: string
      useStreamMapping: boolean
      isDonor: boolean
      isExternal?: boolean
    }[] = []

    if (demuxResult.audioTracks && demuxResult.audioTracks.length > 0) {
      const audioTrackPromises = demuxResult.audioTracks.map(async (track: DemuxedAudio) => {
        const shouldTranscode = needsAudioTranscode(track.codec, track.bitrate)

        const audioTrackResult = await this.mutations.createAudioTrack.mutateAsync({
          data: {
            episodeId,
            streamIndex: track.index,
            language: track.language || 'und',
            title: track.title || undefined,
            codec: track.codec,
            channels: formatChannels(track.channels),
            bitrate: track.bitrate,
            isDefault: track.index === 0,
            extractedPath: track.path || undefined,
            transcodeStatus: shouldTranscode ? 'QUEUED' : 'SKIPPED',
            transcodedPath: shouldTranscode ? undefined : track.path || undefined,
          },
        })

        if (shouldTranscode) {
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
            }
          }
        }
        return null
      })

      const results = await Promise.all(audioTrackPromises)
      audioTracksToTranscode.push(...results.filter((r): r is NonNullable<typeof r> => r !== null))
    }

    // Внешние аудиодорожки из fileAnalyses
    const fileAnalysis = fileAnalyses?.find((a) => a.file.episodeNumber === file.episodeNumber)
    const selectedExternalAudio =
      fileAnalysis?.audioRecommendations.filter((r) => r.enabled && r.isExternal && r.externalPath) || []

    if (selectedExternalAudio.length > 0) {
      console.warn(`[ImportFlow] Processing ${selectedExternalAudio.length} external audio tracks`)

      for (const rec of selectedExternalAudio) {
        const extPath = rec.externalPath
        if (!extPath) {continue}

        try {
          const audioTrackResult = await this.mutations.createAudioTrack.mutateAsync({
            data: {
              episodeId,
              streamIndex: -1,
              language: rec.language || 'ru',
              title: rec.groupName || 'External',
              codec: 'external',
              channels: '2.0',
              bitrate: 0,
              isDefault: false,
              transcodeStatus: 'QUEUED',
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
          console.warn(`[ImportFlow] Failed to process external audio:`, extAudioError)
        }
      }
    }

    return audioTracksToTranscode
  }

  /**
   * Создание субтитров
   */
  private async createSubtitleTracks(
    episodeId: string,
    demuxResult: DemuxResult,
    fileAnalyses: FileAnalysis[] | undefined,
    file: ParsedFile & { episodeNumber: number },
    episodeOutputDir: string,
    externalSubsMap: Map<number, ExternalSubtitleMatch[]>,
    api: NonNullable<typeof window.electronAPI>
  ) {
    const fileAnalysis = fileAnalyses?.find((a) => a.file.episodeNumber === file.episodeNumber)
    const selectedSubs = fileAnalysis?.subtitleRecommendations.filter((r) => r.enabled) || []

    if (selectedSubs.length > 0) {
      console.warn(`[ImportFlow] Using ${selectedSubs.length} selected subtitles for ep ${file.episodeNumber}`)
      let isFirstSub = true

      for (const rec of selectedSubs) {
        try {
          if (rec.isExternal && rec.externalPath) {
            const subFileName = rec.externalPath.split(/[/\\]/).pop() || `external_${rec.language}.${rec.format}`
            const destSubPath = `${episodeOutputDir}/${subFileName}`
            await api.fs.copyFile(rec.externalPath, destSubPath)

            const subtitleTrack = await this.mutations.createSubtitleTrack.mutateAsync({
              data: {
                episodeId,
                streamIndex: -1,
                language: rec.language || 'und',
                title: rec.title || undefined,
                format: rec.format,
                filePath: destSubPath,
                isDefault: isFirstSub,
              },
            })

            // Копируем шрифты
            if (rec.matchedFonts && rec.matchedFonts.length > 0) {
              const fontsDir = `${episodeOutputDir}/fonts`
              for (const font of rec.matchedFonts) {
                try {
                  const fontFileName = font.path.split(/[/\\]/).pop() || `${font.name}.ttf`
                  const destFontPath = `${fontsDir}/${fontFileName}`
                  await api.fs.copyFile(font.path, destFontPath)
                  await this.mutations.createSubtitleFont.mutateAsync({
                    data: {
                      subtitleTrackId: subtitleTrack.id,
                      fontName: font.name,
                      filePath: destFontPath,
                    },
                  })
                } catch (fontError) {
                  console.warn(`[ImportFlow] Failed to copy font ${font.name}:`, fontError)
                }
              }
            }
          } else {
            const embeddedTrack = demuxResult.subtitles?.find((s: DemuxedSubtitle) => s.index === rec.streamIndex)
            if (embeddedTrack) {
              await this.mutations.createSubtitleTrack.mutateAsync({
                data: {
                  episodeId,
                  streamIndex: embeddedTrack.index,
                  language: embeddedTrack.language || 'und',
                  title: embeddedTrack.title || undefined,
                  format: embeddedTrack.format,
                  filePath: embeddedTrack.path || undefined,
                  isDefault: isFirstSub,
                },
              })
            }
          }
          isFirstSub = false
        } catch (subError) {
          console.warn(`[ImportFlow] Failed to process subtitle:`, subError)
        }
      }
    } else {
      // Fallback: все встроенные субтитры
      if (demuxResult.subtitles && demuxResult.subtitles.length > 0) {
        await Promise.all(
          demuxResult.subtitles.map((track: DemuxedSubtitle, idx: number) =>
            this.mutations.createSubtitleTrack.mutateAsync({
              data: {
                episodeId,
                streamIndex: track.index,
                language: track.language || 'und',
                title: track.title || undefined,
                format: track.format,
                filePath: track.path || undefined,
                isDefault: idx === 0,
              },
            })
          )
        )
      }

      // Внешние субтитры
      const extSubs = externalSubsMap.get(file.episodeNumber) || []
      for (const extSub of extSubs) {
        try {
          const subFileName = extSub.filePath.split(/[/\\]/).pop() || `external_${extSub.language}.${extSub.format}`
          const destSubPath = `${episodeOutputDir}/${subFileName}`
          await api.fs.copyFile(extSub.filePath, destSubPath)

          const subtitleTrack = await this.mutations.createSubtitleTrack.mutateAsync({
            data: {
              episodeId,
              streamIndex: -1,
              language: extSub.language || 'und',
              title: extSub.title || undefined,
              format: extSub.format,
              filePath: destSubPath,
              isDefault: false,
            },
          })

          if (extSub.matchedFonts && extSub.matchedFonts.length > 0) {
            const fontsDir = `${episodeOutputDir}/fonts`
            for (const font of extSub.matchedFonts) {
              try {
                const fontFileName = font.path.split(/[/\\]/).pop() || `${font.name}.ttf`
                const destFontPath = `${fontsDir}/${fontFileName}`
                await api.fs.copyFile(font.path, destFontPath)
                await this.mutations.createSubtitleFont.mutateAsync({
                  data: {
                    subtitleTrackId: subtitleTrack.id,
                    fontName: font.name,
                    filePath: destFontPath,
                  },
                })
              } catch (fontError) {
                console.warn(`[ImportFlow] Failed to copy font ${font.name}:`, fontError)
              }
            }
          }
        } catch (extSubError) {
          console.warn(`[ImportFlow] Failed to process external subtitle:`, extSubError)
        }
      }
    }
  }

  /**
   * Создание глав
   */
  private async createChapters(episodeId: string, demuxResult: DemuxResult) {
    if (demuxResult.metadata?.chapters && demuxResult.metadata.chapters.length > 0) {
      console.warn(`[ImportFlow] Creating ${demuxResult.metadata.chapters.length} chapters`)
      await Promise.all(
        demuxResult.metadata.chapters.map((chapter: Chapter) =>
          this.mutations.createChapter.mutateAsync({
            data: {
              episodeId,
              startMs: Math.round(chapter.start * 1000),
              endMs: Math.round(chapter.end * 1000),
              title: chapter.title || undefined,
              type: detectChapterType(chapter.title),
              skippable: isChapterSkippable(chapter.title),
            },
          })
        )
      )
      console.warn(`[ImportFlow] Chapters created successfully`)
    }
  }

  /**
   * Формирование настроек видео
   */
  private buildVideoOptions(encodingProfile: EncodingProfile | null, effectiveCq: number) {
    if (encodingProfile) {
      return {
        codec: encodingProfile.codec.toLowerCase() as 'av1' | 'hevc' | 'h264',
        useGpu: encodingProfile.useGpu,
        cq: effectiveCq,
        preset: encodingProfile.preset,
        rateControl: encodingProfile.rateControl,
        maxBitrate: encodingProfile.maxBitrate,
        tune: encodingProfile.tune,
        multipass: encodingProfile.multipass,
        spatialAq: encodingProfile.spatialAq,
        temporalAq: encodingProfile.temporalAq,
        aqStrength: encodingProfile.aqStrength,
        lookahead: encodingProfile.lookahead,
        lookaheadLevel: encodingProfile.lookaheadLevel,
        gopSize: encodingProfile.gopSize,
        bRefMode: encodingProfile.bRefMode,
        force10Bit: encodingProfile.force10Bit,
        temporalFilter: encodingProfile.temporalFilter,
      }
    }

    // Fallback
    return {
      codec: 'av1' as const,
      useGpu: true,
      cq: effectiveCq,
      preset: 'p5',
      rateControl: 'CONSTQP' as const,
      tune: 'HQ' as const,
      multipass: 'DISABLED' as const,
      spatialAq: true,
      temporalAq: true,
      aqStrength: 8,
      gopSize: 240,
      bRefMode: 'DISABLED' as const,
      force10Bit: false,
      temporalFilter: false,
    }
  }

  /**
   * Параллельное транскодирование
   */
  private async runParallelTranscode(
    batchItems: BatchImportItem[],
    episodeOutputDirs: Map<string, string>,
    electronApi: NonNullable<typeof window.electronAPI>,
    videoMaxConcurrent: number,
    audioMaxConcurrent: number
  ) {
    const completedIds = new Set<string>()
    const totalItems = batchItems.length
    const expectedItemIds = new Set(batchItems.map((item) => item.id))

    console.warn(`[ImportProcessor] runParallelTranscode: expecting ${totalItems} items to complete`)
    console.warn(`[ImportProcessor] Expected item IDs: ${[...expectedItemIds].join(', ')}`)

    const completionPromise = new Promise<void>((resolve, reject) => {
      const unsubscribe = electronApi.parallelTranscode.onItemCompleted(
        (itemId: string, episodeId: string, success: boolean, errorMessage?: string) => {
          console.warn(
            `[ImportProcessor] Received itemCompleted: ${itemId}, success=${success}, completed=${
              completedIds.size + 1
            }/${totalItems}`
          )

          if (!expectedItemIds.has(itemId)) {
            console.warn(`[ImportProcessor] WARNING: Received itemCompleted for unknown item ${itemId}`)
          }

          completedIds.add(itemId)

          if (!success && errorMessage) {
            console.error(`Ошибка транскодирования item ${itemId}: ${errorMessage}`)
          }

          if (completedIds.size >= totalItems) {
            console.warn(`[ImportProcessor] All ${totalItems} items completed, resolving promise`)
            unsubscribe?.()
            resolve()
          }
        }
      )

      const unsubscribeBatchError = electronApi.parallelTranscode.onBatchError((error: string) => {
        unsubscribe?.()
        unsubscribeBatchError?.()
        reject(new Error(`Batch error: ${error}`))
      })
    })

    // Устанавливаем лимиты
    await electronApi.parallelTranscode.setVideoMaxConcurrent(videoMaxConcurrent)
    await electronApi.parallelTranscode.setAudioMaxConcurrent(audioMaxConcurrent)

    // Отправляем batch
    const result = await electronApi.parallelTranscode.addBatch(batchItems)
    if (!result.success) {
      throw new Error(`Ошибка addBatch: ${result.error}`)
    }

    await completionPromise
  }

  /**
   * Пост-обработка (скриншоты + манифесты)
   */
  private async runPostProcess(
    postProcessDataMap: Map<string, PostProcessData>,
    electronApi: NonNullable<typeof window.electronAPI>
  ) {
    const postProcessPromises = Array.from(postProcessDataMap.values()).map(async (data) => {
      try {
        let thumbnailPathsJson: string | undefined
        let screenshotPathsJson: string | undefined

        // Генерация скриншотов
        if (data.duration > 0) {
          try {
            console.warn(`[PostProcess] Generating screenshots for episode ${data.episodeNumber}...`)
            const screenshotResult = await electronApi.ffmpeg.generateScreenshots(
              data.videoOutputPath,
              data.outputDir,
              data.duration,
              { count: 5, format: 'webp', thumbnailWidth: 320, fullWidth: 1280, quality: 80 }
            )

            if (screenshotResult.success) {
              thumbnailPathsJson = JSON.stringify(screenshotResult.thumbnails)
              screenshotPathsJson = JSON.stringify(screenshotResult.fullSize)
            }
          } catch (e) {
            console.warn(`[PostProcess] Failed to generate screenshots:`, e)
          }
        }

        // Генерация thumbnail sprite sheet для hover preview на таймлайне
        let spriteData: { vttPath: string; spritePath: string } | undefined
        if (data.duration > 0) {
          try {
            console.warn(`[PostProcess] Generating thumbnail sprite for episode ${data.episodeNumber}...`)
            const spriteResult = await electronApi.ffmpeg.generateThumbnailSprite(
              data.videoOutputPath,
              data.outputDir,
              data.duration,
              { frameCount: 100, frameWidth: 160, frameHeight: 90, columns: 10, quality: 75 }
            )

            if (spriteResult.success) {
              spriteData = { vttPath: spriteResult.vttPath, spritePath: spriteResult.spritePath }
              console.warn(
                `[PostProcess] Sprite generated: ${spriteResult.spritePath} (${Math.round(
                  spriteResult.spriteSize / 1024
                )}KB)`
              )
            }
          } catch (e) {
            console.warn(`[PostProcess] Failed to generate thumbnail sprite:`, e)
          }
        }

        // Генерация манифеста
        const manifestPath = `${data.outputDir}/manifest.json`
        await electronApi.manifest.generate(data.demuxResult, {
          episodeId: data.episodeId,
          videoPath: data.sourcePath,
          outputDir: data.outputDir,
          animeInfo: {
            animeName: data.animeName,
            seasonNumber: data.seasonNumber,
            episodeNumber: data.episodeNumber,
          },
        })

        // Обновляем манифест с thumbnails (если сгенерированы)
        if (spriteData) {
          try {
            await electronApi.manifest.updateThumbnails(manifestPath, spriteData)
          } catch (e) {
            console.warn(`[PostProcess] Failed to update manifest thumbnails:`, e)
          }
        }

        // Получаем размеры файлов
        let sourceSize: bigint | undefined
        let transcodedSize: bigint | undefined
        try {
          const sourceStats = await electronApi.fs.stat(data.sourcePath)
          sourceSize = sourceStats?.success && sourceStats.size ? BigInt(sourceStats.size) : undefined
          const transcodedStats = await electronApi.fs.stat(data.videoOutputPath)
          transcodedSize = transcodedStats?.success && transcodedStats.size ? BigInt(transcodedStats.size) : undefined
        } catch (e) {
          console.warn(`[PostProcess] Could not get file sizes:`, e)
        }

        // Получаем метаданные кодирования из refs (заполняются при завершении видео)
        const encodingMeta = this.refs.videoEncodingMeta.current.get(data.episodeId)

        // JSON с настройками кодирования
        const encodingSettingsJson = data.videoOptions
          ? JSON.stringify({
              profileName: data.encodingProfileName ?? 'default',
              codec: data.videoOptions.codec,
              cq: data.videoOptions.cq,
              preset: data.videoOptions.preset,
              rateControl: data.videoOptions.rateControl,
              tune: data.videoOptions.tune,
              multipass: data.videoOptions.multipass,
              spatialAq: data.videoOptions.spatialAq,
              temporalAq: data.videoOptions.temporalAq,
              aqStrength: data.videoOptions.aqStrength,
              gopSize: data.videoOptions.gopSize,
              lookahead: data.videoOptions.lookahead,
              bRefMode: data.videoOptions.bRefMode,
              force10Bit: data.videoOptions.force10Bit,
              // Новые поля v0.10.0
              vmafScore: data.vmafScore,
              encoderType: data.encoderType,
              hardwareModel: data.hardwareModel,
              ffmpegVersion: data.ffmpegVersion,
              // Метаданные от завершённого кодирования
              ffmpegCommand: encodingMeta?.ffmpegCommand,
              transcodeDurationMs: encodingMeta?.transcodeDurationMs,
              activeGpuWorkers: encodingMeta?.activeGpuWorkers,
              // Лимиты потоков
              videoMaxConcurrent: data.videoMaxConcurrent,
              audioMaxConcurrent: data.audioMaxConcurrent,
            })
          : null

        // Обновляем Episode
        await this.mutations.updateEpisode.mutateAsync({
          where: { id: data.episodeId },
          data: {
            transcodeStatus: 'COMPLETED',
            transcodedPath: data.videoOutputPath,
            manifestPath,
            thumbnailPaths: thumbnailPathsJson,
            screenshotPaths: screenshotPathsJson,
            encodingSettingsJson,
            encodingProfile: data.encodingProfileId ? { connect: { id: data.encodingProfileId } } : undefined,
            sourceSize,
            transcodedSize,
          },
        })

        console.warn(`[PostProcess] Episode ${data.episodeNumber} completed`)
      } catch (e) {
        console.error(`[PostProcess] Error processing episode ${data.episodeNumber}:`, e)
      }
    })

    await Promise.all(postProcessPromises)
    console.warn(`[PostProcess] All ${postProcessPromises.length} episodes post-processed`)
  }

  /**
   * Синхронизация связей (франшизы, сиквелы)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Shikimori API response
  private async syncRelations(animeId: string, selectedAnime: any) {
    const shikimoriId = parseInt(selectedAnime.id, 10)
    if (!shikimoriId || !window.electronAPI?.franchise) {
      return
    }

    this.setStage('syncing_relations')

    try {
      console.warn(`[Relations] Fetching relations for shikimoriId=${shikimoriId}...`)
      const fetchResult = await window.electronAPI.franchise.fetchRelated(shikimoriId)

      if (fetchResult.success && fetchResult.data) {
        const { relatedAnimes, sourceAnime } = fetchResult.data

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Franchise API response
        const relations = relatedAnimes.map((related: any) => ({
          targetShikimoriId: related.shikimoriId,
          relationKind: related.relationKind as RelationKind,
          targetName: related.name,
          targetPosterUrl: related.posterUrl,
          targetYear: related.year,
          targetKind: related.kind,
        }))

        await syncAnimeRelations(animeId, relations)
        console.warn(`[Relations] Synced ${relations.length} relations`)

        // Создаём или получаем франшизу (upsert) — используем franchise ID из Shikimori
        // Это гарантирует, что все аниме одной франшизы будут группироваться вместе
        if (sourceAnime.franchise) {
          try {
            const franchise = await this.mutations.upsertFranchise.mutateAsync({
              shikimoriFranchiseId: sourceAnime.franchise,
              name: sourceAnime.name,
            })

            await this.mutations.updateAnime.mutateAsync({
              where: { id: animeId },
              data: { franchiseId: franchise.id },
            })
            console.warn(`[Relations] Linked to franchise: ${franchise.name} (${sourceAnime.franchise})`)
          } catch (franchiseError) {
            console.warn(`[Relations] Failed to create franchise:`, franchiseError)
          }
        }
      }
    } catch (relationsError) {
      console.warn(`[Relations] Error syncing relations:`, relationsError)
    }
  }

  /**
   * Обновление навигации между эпизодами в манифестах
   * Связывает prev/next эпизоды для удобной навигации в плеере
   */
  private async updateEpisodeNavigation(animeId: string) {
    const electronApi = window.electronAPI
    if (!electronApi?.manifest?.updateNavigation) {
      console.warn('[Navigation] Electron API недоступен')
      return
    }

    try {
      // Получаем все эпизоды аниме, отсортированные по номеру
      const episodes = await findManyEpisodes({
        where: { animeId },
        orderBy: { number: 'asc' },
        select: {
          id: true,
          number: true,
          manifestPath: true,
        },
      })

      // Фильтруем только эпизоды с манифестами
      const episodesWithManifest = episodes.filter((ep) => ep.manifestPath)

      if (episodesWithManifest.length < 2) {
        // Нечего связывать — один эпизод или меньше
        return
      }

      console.warn(`[Navigation] Updating navigation for ${episodesWithManifest.length} episodes`)

      // Обновляем navigation для каждого эпизода
      for (let i = 0; i < episodesWithManifest.length; i++) {
        const current = episodesWithManifest[i]
        const prev = i > 0 ? episodesWithManifest[i - 1] : null
        const next = i < episodesWithManifest.length - 1 ? episodesWithManifest[i + 1] : null

        if (!current.manifestPath) {continue}

        const navigation: {
          prevEpisode?: { id: string; manifestPath: string }
          nextEpisode?: { id: string; manifestPath: string }
        } = {}

        if (prev?.manifestPath) {
          navigation.prevEpisode = { id: prev.id, manifestPath: prev.manifestPath }
        }

        if (next?.manifestPath) {
          navigation.nextEpisode = { id: next.id, manifestPath: next.manifestPath }
        }

        // Обновляем манифест
        await electronApi.manifest.updateNavigation(current.manifestPath, navigation)
      }

      console.warn(`[Navigation] Navigation updated successfully`)
    } catch (error) {
      console.warn('[Navigation] Error updating navigation:', error)
    }
  }

  /**
   * Инвалидация кэша
   */
  private async invalidateCache() {
    await this.queryClient.invalidateQueries({ queryKey: ['Anime'] })
    await this.queryClient.invalidateQueries({ queryKey: ['Episode'] })
    await this.queryClient.invalidateQueries({ queryKey: ['Season'] })
    await this.queryClient.invalidateQueries({ queryKey: ['File'] })
    await this.queryClient.invalidateQueries({ queryKey: ['AnimeRelation'] })
    await this.queryClient.invalidateQueries({ queryKey: ['Franchise'] })
  }
}

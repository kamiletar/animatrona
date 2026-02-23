'use client'

/**
 * Процессор импорта аниме
 * Содержит основную логику startImport без React зависимостей
 */

import { syncAnimeRelations } from '@/app/_actions/anime-relation.action'
import { findUniqueEncodingProfile, getDefaultEncodingProfile } from '@/app/_actions/encoding-profile.action'
import { findManyEpisodes } from '@/app/_actions/episode.action'
import { saveGenresAndThemes } from '@/app/_actions/genre.action'
import type { ParsedFile } from '@/components/import/FileScanStep'
import type { RelationKind } from '@/generated/prisma'
import type { ExternalSubtitleMatch } from '@/types/electron'
import type { QueryClient } from '@tanstack/react-query'

import type { DemuxResult } from '../../../../shared/types'
import type { BatchImportItem } from '../../../../shared/types/parallel-transcode'

import { stripHtmlTags } from '../html-utils'
import { uploadToIpfs } from '../ipfs-upload'
import { withRetry } from '../with-retry'
import { createAudioTracks } from './audio-track-creator'
import { createChapters } from './chapter-creator'
import {
  createConcurrencyLimiter,
  getPosterUrl,
  mapSeasonType,
  mapShikimoriAgeRating,
  mapShikimoriStatus,
} from './helpers'
import { createSubtitleTracks } from './subtitle-track-creator'
import type { ImportAction, ImportOptions, ImportRefs, ImportResult, PostProcessData, ProcessingStage } from './types'
import type { ImportMutations } from './use-import-mutations'
import { buildVideoOptions } from './video-options-builder'

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
    const encodingProfile = await this.loadEncodingProfile(importSettings?.profileId)

    // Настройки потоков
    const audioMaxConcurrent = importSettings?.audioMaxConcurrent ?? 4
    const videoMaxConcurrent = importSettings?.videoMaxConcurrent ?? 2
    console.warn('[Import] Макс. видео-потоков:', videoMaxConcurrent, 'Макс. аудио-потоков:', audioMaxConcurrent)

    // Коллекции для batch транскодирования
    const batchItems: BatchImportItem[] = []
    const episodeOutputDirs = new Map<string, string>()
    const postProcessDataMap = new Map<string, PostProcessData>()
    // Эпизоды без глав из MKV — кандидаты для автоопределения OP/ED
    const episodesWithoutChapters: Array<{ id: string; sourcePath: string; durationMs: number }> = []

    try {
      // 0. Подготавливаем окружение
      const libraryPathResult = await window.electronAPI?.library.getDefaultPath()
      if (!libraryPathResult?.success || !libraryPathResult.data) {
        throw new Error(libraryPathResult?.error ?? 'Не удалось получить путь к библиотеке')
      }
      const libraryPath = libraryPathResult.data

      const {
        folderPath: animeFolderPath,
        ffmpegVersion,
        hardwareModel,
      } = await this.prepareAnimeFolder(libraryPath, selectedAnime.russian ?? selectedAnime.name, useCpuFallback)

      // 1. Создаём аниме в БД
      this.setStage('creating_anime')

      const posterId = await this.downloadAndSavePoster(selectedAnime, animeFolderPath)
      const animeId = await this.createAnimeRecord(selectedAnime, parsedInfo, animeFolderPath, posterId)

      // Сохраняем для отката при отмене
      this.refs.createdAnimeId.current = animeId
      this.refs.createdAnimeFolder.current = animeFolderPath

      // 2. Записываем anime.meta.json для возможности восстановления библиотеки
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
        console.warn('[ImportFlow] Failed to write anime.meta.json:', err)
      }

      // 3. Сохраняем жанры и темы (расширенные метаданные теперь в AnimeManifest)
      await this.saveGenresIfAvailable(animeId, selectedAnime)

      // 4. Создаём сезон
      const seasonNum = parsedInfo.seasonNumber ?? 1
      const seasonId = await this.createSeasonRecord(animeId, selectedAnime, parsedInfo)

      // 5. Сканируем внешние субтитры (пропускаем при импорте одиночного файла)
      const externalSubsMap = options.isFileMode
        ? new Map<number, ExternalSubtitleMatch[]>()
        : await this.scanExternalSubtitles(options.folderPath, selectedFiles)

      // 6. Обрабатываем файлы
      this.setStage('demuxing')

      if (!window.electronAPI) {
        throw new Error('Electron API недоступен')
      }
      const electronApi = window.electronAPI

      const demuxLimiter = createConcurrencyLimiter(2)
      let completedFiles = 0

      // Переменные для замыкания processFile
      const animeName = selectedAnime.russian ?? selectedAnime.name

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
        const episodeDirResult = await api.library.ensureEpisodeDirectory({
          libraryPath,
          animeName,
          seasonNumber: seasonNum,
          episodeNumber: file.episodeNumber,
        })
        if (!episodeDirResult.success || !episodeDirResult.data) {
          throw new Error(episodeDirResult.error ?? `Не удалось создать папку эпизода ${file.episodeNumber}`)
        }
        const episodeOutputDir = episodeDirResult.data

        // Demux файла
        // createHandler возвращает { success, data: DemuxResult } но типы говорят DemuxResult напрямую
        const demuxResultWrapped = (await demuxLimiter(() => {
          this.setFileProgress(completedFiles, selectedFiles.length, file.name)
          return api.ffmpeg.demux(file.path, episodeOutputDir, {
            skipVideo: true,
            audioExtractMode: 'smart',
          })
        })) as unknown as { success: boolean; data?: DemuxResult; error?: string }

        if (!demuxResultWrapped.success || !demuxResultWrapped.data) {
          throw new Error(`Demux failed for ${file.name}: ${demuxResultWrapped.error || 'No data returned'}`)
        }

        // Извлекаем данные из обёртки
        const demuxResult = demuxResultWrapped.data

        completedFiles++
        this.setFileProgress(completedFiles, selectedFiles.length, null)

        if (this.isCancelled) {
          throw new Error('Импорт отменён')
        }

        // Подготавливаем данные
        const videoOutputPath = `${episodeOutputDir}/video.webm`
        // Используем исходный файл как вход для транскодирования (skipVideo: true в demux)
        const videoInputPath = file.path

        // Создаём или обновляем Episode (upsert по animeId + number)
        const episodeResult = await this.mutations.upsertEpisode.mutateAsync({
          data: {
            animeId,
            seasonId,
            number: file.episodeNumber,
            name: undefined,
            folderPath: episodeOutputDir, // Папка эпизода (для временных файлов)
            durationMs: demuxResult.video ? Math.round(demuxResult.video.duration * 1000) : undefined,
            videoWidth: demuxResult.video?.width,
            videoHeight: demuxResult.video?.height,
            videoCodec: demuxResult.video?.codec,
            videoBitDepth: demuxResult.video?.bitDepth,
            // CID поля заполняются после IPFS upload
          },
        })

        const episodeId = episodeResult.id

        // Извлекаем переопределения дорожек из fileAnalyses (язык, dubGroup из UI)
        const fileAnalysis = fileAnalyses?.find((a) => a.file.episodeNumber === file.episodeNumber)
        const audioTrackOverrides = fileAnalysis?.audioRecommendations
          .filter((r) => r.enabled)
          .map((r) => ({
            streamIndex: r.trackIndex,
            language: r.language,
            dubGroup: r.dubGroup,
          }))
        const subtitleTrackOverrides = fileAnalysis?.subtitleRecommendations
          .filter((r) => r.enabled)
          .map((r) => ({
            streamIndex: r.streamIndex,
            language: r.language,
            dubGroup: r.dubGroup,
          }))

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
          // Переопределения дорожек (язык, dubGroup) для манифеста
          audioTrackOverrides,
          subtitleTrackOverrides,
        })

        // Создаём AudioTrack записи
        const audioTracksToTranscode = await createAudioTracks(
          episodeId,
          demuxResult,
          fileAnalyses,
          file,
          this.mutations
        )

        // Создаём SubtitleTrack записи
        await createSubtitleTracks(
          episodeId,
          demuxResult,
          fileAnalyses,
          file,
          episodeOutputDir,
          externalSubsMap,
          api,
          this.mutations
        )

        // Создаём Chapter записи (возвращает true если главы были в MKV)
        const hasChaptersFromFile = await createChapters(episodeId, demuxResult, this.mutations)

        // Если в файле нет глав — кандидат для автоопределения OP/ED
        if (!hasChaptersFromFile && demuxResult.video?.duration) {
          episodesWithoutChapters.push({
            id: episodeId,
            sourcePath: file.path,
            durationMs: Math.round(demuxResult.video.duration * 1000),
          })
        }

        // Возвращаем BatchImportItem для транскодирования
        if (videoInputPath) {
          const effectiveCq = importSettings?.cqOverride ?? encodingProfile?.cq ?? 28
          const cqSource = importSettings?.cqOverride ? 'VMAF' : encodingProfile?.cq ? 'profile' : 'default'
          console.warn(`[Import] CQ=${effectiveCq} (source: ${cqSource})`)
          const videoOptions = buildVideoOptions(encodingProfile, effectiveCq)

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
                rateControl: videoOptions.rateControl ?? 'VBR',
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
              // Для passthrough: файл уже извлечён demux'ом, inputPath = outputPath
              // Не нужно запускать FFmpeg, просто используем существующий файл
              outputPath: track.isExternal
                ? `${episodeOutputDir}/audio_external_${track.id}.m4a`
                : track.useStreamMapping
                  ? `${episodeOutputDir}/audio_${track.streamIndex}_${track.language}.m4a`
                  : track.passthrough
                    ? track.inputPath // Passthrough: файл уже готов после demux
                    : track.inputPath.replace(/\.\w+$/, '.m4a'),
              options: { targetBitrate: 256 },
              useStreamMapping: track.useStreamMapping,
              syncOffset: track.isDonor && syncOffset ? syncOffset : undefined,
              isExternal: track.isExternal,
              title: track.isExternal ? track.title : undefined,
              language: track.isExternal ? track.language : undefined,
              passthrough: track.passthrough,
              originalCodec: track.originalCodec,
            })),
          } as BatchImportItem
        }

        return null
      }

      // Запускаем обработку файлов
      this.setStage('creating_episodes')
      const batchResults = await Promise.all(selectedFiles.map((file) => processFile(file)))
      batchItems.push(...batchResults.filter((item): item is BatchImportItem => item !== null))

      // 7. Параллельное транскодирование
      if (batchItems.length > 0) {
        this.setStage('transcoding_video')
        await this.runParallelTranscode(
          batchItems,
          episodeOutputDirs,
          postProcessDataMap,
          electronApi,
          videoMaxConcurrent,
          audioMaxConcurrent
        )

        // 8. Пост-обработка
        this.setStage('generating_manifests')
        await this.runPostProcess(postProcessDataMap, electronApi)
      }

      // 8.5. Автоопределение OP/ED (если нет глав из MKV)
      console.log(
        `[ImportProcessor] Checking intro detection requirements: ${episodesWithoutChapters.length} candidates`
      )

      if (episodesWithoutChapters.length >= 2 && electronApi.introDetector) {
        console.log(`[ImportProcessor] Starting intro detection for ${episodesWithoutChapters.length} episodes...`)
        this.setStage('detecting_intros')
        this.setFileProgress(0, 1, 'Определение OP/ED...')

        try {
          const introResults = await electronApi.introDetector.detect(
            episodesWithoutChapters.map((ep) => ({
              id: ep.id,
              sourcePath: ep.sourcePath,
              duration: ep.durationMs,
            }))
          )

          // Создаём Chapter записи для найденных OP/ED
          for (const result of introResults) {
            if (result.introStartMs !== null && result.introEndMs !== null) {
              await this.mutations.createChapter.mutateAsync({
                data: {
                  episodeId: result.episodeId,
                  startMs: result.introStartMs,
                  endMs: result.introEndMs,
                  title: 'Opening',
                  type: 'OP',
                  skippable: true,
                },
              })
            }
            if (result.outroStartMs !== null && result.outroEndMs !== null) {
              await this.mutations.createChapter.mutateAsync({
                data: {
                  episodeId: result.episodeId,
                  startMs: result.outroStartMs,
                  endMs: result.outroEndMs,
                  title: 'Ending',
                  type: 'ED',
                  skippable: true,
                },
              })
            }
          }

          const foundOp = introResults.filter((r) => r.introStartMs !== null).length
          const foundEd = introResults.filter((r) => r.outroStartMs !== null).length
          console.warn(`[IntroDetect] Найдено: ${foundOp} OP, ${foundEd} ED`)
        } catch (err) {
          console.warn('[IntroDetect] Ошибка автоопределения OP/ED:', err)
        }
      }

      // 9. Финализация
      this.setStage('syncing_relations')
      await this.syncRelations(animeId, selectedAnime)
      await this.updateEpisodeNavigation(animeId)

      // 10. Генерация AnimeManifest и публикация в IPFS
      this.setStage('generating_manifests')
      this.setFileProgress(1, 1, 'Загрузка метаданных из Shikimori...')
      await this.generateAndPublishAnimeManifest(animeId)

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
  // Приватные методы для декомпозиции process()
  // ========================

  /**
   * Загрузка профиля кодирования
   */
  private async loadEncodingProfile(profileId?: string | null) {
    let encodingProfile = null
    try {
      if (profileId) {
        encodingProfile = await findUniqueEncodingProfile(profileId)
      }
      if (!encodingProfile) {
        encodingProfile = await getDefaultEncodingProfile()
      }
      console.warn('[Import] Используем профиль:', encodingProfile?.name ?? 'default hardcoded')
    } catch (error) {
      console.warn('[Import] Не удалось загрузить профиль, используем дефолтные настройки:', error)
    }
    return encodingProfile
  }

  /**
   * Подготовка папки аниме и получение системной информации
   */
  private async prepareAnimeFolder(
    libraryPath: string,
    animeName: string,
    useCpuFallback?: boolean
  ): Promise<{ folderPath: string; ffmpegVersion?: string; hardwareModel?: string }> {
    // Получаем версию FFmpeg и модель оборудования
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

    // Создаём папку аниме
    const folderResult = await window.electronAPI?.library.ensureAnimeDirectory(libraryPath, animeName)
    if (!folderResult?.success || !folderResult.data) {
      throw new Error(folderResult?.error ?? 'Не удалось создать папку аниме')
    }

    return { folderPath: folderResult.data, ffmpegVersion, hardwareModel }
  }

  /**
   * Скачивание и сохранение постера
   * Обёрнуто в try-catch + retry — постер опционален и не должен убивать импорт
   */
  private async downloadAndSavePoster(
    selectedAnime: ImportOptions['selectedAnime'],
    folderPath: string
  ): Promise<string | undefined> {
    try {
      let posterId: string | undefined

      // Приоритет: originalUrl (полный размер) > mainUrl (превью)
      console.warn('[ImportProcessor] Poster URLs:', {
        originalUrl: selectedAnime.poster?.originalUrl,
        mainUrl: selectedAnime.poster?.mainUrl,
      })
      const posterUrl = getPosterUrl(selectedAnime.poster?.originalUrl || selectedAnime.poster?.mainUrl)
      console.warn('[ImportProcessor] Using poster URL:', posterUrl)

      const electronApi = window.electronAPI
      if (posterUrl && electronApi) {
        const posterResult = await withRetry(() =>
          electronApi.shikimori.downloadPoster(posterUrl, selectedAnime.id, {
            savePath: folderPath,
          })
        )
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

      return posterId
    } catch (error) {
      console.warn('[ImportProcessor] Скачивание постера не удалось, продолжаем без постера:', error)
      return undefined
    }
  }

  /**
   * Создание записи аниме в БД
   */
  private async createAnimeRecord(
    selectedAnime: ImportOptions['selectedAnime'],
    parsedInfo: ImportOptions['parsedInfo'],
    folderPath: string,
    posterId?: string
  ): Promise<string> {
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
        folderPath,
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

    return animeResult.id
  }

  /**
   * Создание записи сезона
   */
  private async createSeasonRecord(
    animeId: string,
    selectedAnime: ImportOptions['selectedAnime'],
    parsedInfo: ImportOptions['parsedInfo']
  ): Promise<string> {
    const seasonNum = parsedInfo.seasonNumber ?? 1
    const seasonResult = await this.mutations.upsertSeason.mutateAsync({
      data: {
        animeId,
        number: seasonNum,
        name: `Сезон ${seasonNum}`,
        type: mapSeasonType(selectedAnime.kind),
      },
    })
    return seasonResult.id
  }

  /**
   * Сохранение жанров и тем (v0.28.0: остальные метаданные в AnimeManifest)
   */
  private async saveGenresIfAvailable(animeId: string, selectedAnime: ImportOptions['selectedAnime']): Promise<void> {
    const extendedAnime = selectedAnime as {
      genres?: Array<{ id: string; name: string; russian: string; kind?: 'genre' | 'theme' }>
    }

    if (!('genres' in selectedAnime) || !extendedAnime.genres?.length) {
      return
    }

    try {
      // Жанры из Shikimori - kind может отсутствовать в старых данных, fallback на 'genre'
      await saveGenresAndThemes(
        animeId,
        extendedAnime.genres.map((g) => ({
          id: g.id,
          name: g.name,
          russian: g.russian,
          kind: g.kind ?? 'genre',
        }))
      )
      console.warn('[ImportFlow] Genres saved')
    } catch (err) {
      console.warn('[ImportFlow] Failed to save genres:', err)
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
      // createHandler возвращает { success, data: { subtitles, ... } }
      const result = (await window.electronAPI?.fs.scanExternalSubtitles(
        folderPath,
        selectedFiles.map((f) => ({ path: f.path, episodeNumber: f.episodeNumber }))
      )) as unknown as { success: boolean; data?: { subtitles: ExternalSubtitleMatch[] } } | undefined

      const subtitles = result?.data?.subtitles || []
      for (const sub of subtitles) {
        if (sub.episodeNumber !== null) {
          const existing = externalSubsMap.get(sub.episodeNumber) || []
          existing.push(sub)
          externalSubsMap.set(sub.episodeNumber, existing)
        }
      }
    } catch (scanError) {
      console.warn('[ImportFlow] Failed to scan external subtitles:', scanError)
    }

    return externalSubsMap
  }

  /**
   * Параллельное транскодирование
   */
  private async runParallelTranscode(
    batchItems: BatchImportItem[],
    episodeOutputDirs: Map<string, string>,
    postProcessDataMap: Map<string, PostProcessData>,
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
      // Safety-net таймер: 30 минут без прогресса — значит зависло
      // CPU кодирование (libsvtav1) может занимать 10-30+ минут на эпизод
      let stalledTimer: ReturnType<typeof setTimeout> | null = null
      const STALLED_TIMEOUT = 30 * 60 * 1000

      const resetStalledTimer = () => {
        if (stalledTimer) clearTimeout(stalledTimer)
        stalledTimer = setTimeout(() => {
          const missing = [...expectedItemIds].filter((id) => !completedIds.has(id))
          console.error(
            `[ImportProcessor] STALLED: ${completedIds.size}/${totalItems} completed, missing: ${missing.join(', ')}`
          )
          unsubscribe?.()
          unsubscribeProgress?.()
          resolve() // Продолжаем с тем что есть, а не вешаем UI навечно
        }, STALLED_TIMEOUT)
      }

      resetStalledTimer()

      // Подписываемся на прогресс для сброса stalled timer
      // Пока FFmpeg работает и отправляет прогресс — таймер не сработает
      const unsubscribeProgress = electronApi.parallelTranscode.onAggregatedProgress(() => {
        resetStalledTimer()
      })

      const unsubscribe = electronApi.parallelTranscode.onItemCompleted(
        (itemId: string, episodeId: string, success: boolean, errorMessage?: string) => {
          console.warn(
            `[ImportProcessor] Received itemCompleted: ${itemId}, success=${success}, completed=${
              completedIds.size + 1
            }/${totalItems}`
          )

          // Игнорируем события от предыдущих/чужих импортов
          if (!expectedItemIds.has(itemId)) {
            console.warn(`[ImportProcessor] WARNING: Ignoring itemCompleted for unknown item ${itemId}`)
            return
          }

          completedIds.add(itemId)

          // Обновляем UI с номером завершённой серии
          const batchItem = batchItems.find((item) => item.id === itemId)
          if (batchItem) {
            const episodeData = postProcessDataMap.get(batchItem.episodeId)
            this.setFileProgress(
              completedIds.size,
              totalItems,
              episodeData ? `Серия ${episodeData.episodeNumber} закодирована` : null
            )
          }

          if (!success && errorMessage) {
            console.error(`Ошибка транскодирования item ${itemId}: ${errorMessage}`)
          }

          if (completedIds.size >= totalItems) {
            console.warn(`[ImportProcessor] All ${totalItems} items completed, resolving promise`)
            if (stalledTimer) clearTimeout(stalledTimer)
            unsubscribe?.()
            unsubscribeProgress?.()
            resolve()
          } else {
            resetStalledTimer()
          }
        }
      )

      const unsubscribeBatchError = electronApi.parallelTranscode.onBatchError((error: string) => {
        if (stalledTimer) clearTimeout(stalledTimer)
        unsubscribe?.()
        unsubscribeProgress?.()
        unsubscribeBatchError?.()
        reject(new Error(`Batch error: ${error}`))
      })
    })

    // Используем startNewBatch для сброса состояния предыдущего импорта
    // (очищает globalCpuFallback, очереди, завершённые задачи)
    const result = await electronApi.parallelTranscode.startNewBatch(batchItems)
    if (!result.success) {
      throw new Error(`Ошибка startNewBatch: ${result.error}`)
    }

    // Устанавливаем лимиты ПОСЛЕ startNewBatch (reset сбрасывает CPU fallback,
    // поэтому setMaxConcurrent не будет заблокирован на 1)
    await electronApi.parallelTranscode.setVideoMaxConcurrent(videoMaxConcurrent)
    await electronApi.parallelTranscode.setAudioMaxConcurrent(audioMaxConcurrent)

    await completionPromise
  }

  /**
   * Пост-обработка (скриншоты + манифесты)
   * Выполняется последовательно для каждого эпизода, чтобы не перегружать CPU
   */
  private async runPostProcess(
    postProcessDataMap: Map<string, PostProcessData>,
    electronApi: NonNullable<typeof window.electronAPI>
  ) {
    const episodes = Array.from(postProcessDataMap.values())
    const totalEpisodes = episodes.length

    // Последовательная обработка эпизодов (не параллельная!)
    // Это предотвращает перегрузку CPU множеством FFmpeg процессов
    for (let i = 0; i < episodes.length; i++) {
      const data = episodes[i]

      // Обновляем прогресс в UI
      this.setFileProgress(i + 1, totalEpisodes, `Серия ${data.episodeNumber} — генерация превью...`)

      try {
        let thumbnailCidsJson: string | undefined
        let screenshotCidsJson: string | undefined

        // Генерация скриншотов и загрузка в IPFS
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
              // Загружаем thumbnails в IPFS
              const thumbnailCids = await Promise.all(screenshotResult.thumbnails.map((p: string) => uploadToIpfs(p)))
              const validThumbnailCids = thumbnailCids.filter((cid): cid is string => cid !== null)
              if (validThumbnailCids.length > 0) {
                thumbnailCidsJson = JSON.stringify(validThumbnailCids)
                // Удаляем локальные thumbnails после загрузки в IPFS
                for (const thumbPath of screenshotResult.thumbnails) {
                  try {
                    await electronApi.fs.delete(thumbPath, false)
                  } catch {
                    /* ignore */
                  }
                }
              }

              // Загружаем полноразмерные скриншоты в IPFS
              const screenshotCids = await Promise.all(screenshotResult.fullSize.map((p: string) => uploadToIpfs(p)))
              const validScreenshotCids = screenshotCids.filter((cid): cid is string => cid !== null)
              if (validScreenshotCids.length > 0) {
                screenshotCidsJson = JSON.stringify(validScreenshotCids)
                // Удаляем локальные скриншоты после загрузки в IPFS
                for (const ssPath of screenshotResult.fullSize) {
                  try {
                    await electronApi.fs.delete(ssPath, false)
                  } catch {
                    /* ignore */
                  }
                }
              }

              console.warn(
                `[PostProcess] Screenshots uploaded & local deleted: ${validThumbnailCids.length} thumbnails, ${validScreenshotCids.length} full`
              )
            }
          } catch (e) {
            console.warn(`[PostProcess] Failed to generate screenshots:`, e)
          }
        }

        // Генерация thumbnail sprite sheet для hover preview на таймлайне
        let spriteData: { vttCid: string; spriteCid: string } | undefined
        if (data.duration > 0) {
          try {
            // Обновляем прогресс — спрайт
            this.setFileProgress(i + 1, totalEpisodes, `Серия ${data.episodeNumber} — генерация спрайта...`)
            console.warn(`[PostProcess] Generating thumbnail sprite for episode ${data.episodeNumber}...`)
            const spriteResult = await electronApi.ffmpeg.generateThumbnailSprite(
              data.videoOutputPath,
              data.outputDir,
              data.duration,
              { frameCount: 100, frameWidth: 160, frameHeight: 90, columns: 10, quality: 75 }
            )

            if (spriteResult.success) {
              console.warn(
                `[PostProcess] Sprite generated: ${spriteResult.spritePath} (${Math.round(
                  spriteResult.spriteSize / 1024
                )}KB)`
              )

              // Загружаем sprite файлы в IPFS
              const [vttCid, spriteCid] = await Promise.all([
                uploadToIpfs(spriteResult.vttPath),
                uploadToIpfs(spriteResult.spritePath),
              ])

              if (vttCid && spriteCid) {
                spriteData = { vttCid, spriteCid }
                console.warn(`[PostProcess] Sprite uploaded to IPFS: vtt=${vttCid}, sprite=${spriteCid}`)

                // Удаляем локальные файлы после загрузки в IPFS
                try {
                  await electronApi.fs.delete(spriteResult.vttPath, false)
                  await electronApi.fs.delete(spriteResult.spritePath, false)
                  console.warn(`[PostProcess] Local sprite files deleted`)
                } catch {
                  /* ignore */
                }
              }
            }
          } catch (e) {
            console.warn(`[PostProcess] Failed to generate thumbnail sprite:`, e)
          }
        }

        // Обновляем прогресс — манифест
        this.setFileProgress(i + 1, totalEpisodes, `Серия ${data.episodeNumber} — загрузка в IPFS...`)

        // Генерация манифеста с переопределениями дорожек из UI
        const manifestPath = `${data.outputDir}/manifest.json`
        const manifestResult = await electronApi.manifest.generate(data.demuxResult, {
          episodeId: data.episodeId,
          videoPath: data.sourcePath,
          outputDir: data.outputDir,
          animeInfo: {
            animeName: data.animeName,
            seasonNumber: data.seasonNumber,
            episodeNumber: data.episodeNumber,
          },
          // Переопределения языка и dubGroup из настроек дорожек в UI
          audioTrackOverrides: data.audioTrackOverrides,
          subtitleTrackOverrides: data.subtitleTrackOverrides,
        })

        // Проверяем результат генерации манифеста
        // createHandler возвращает { success, data: { success, manifestPath, error } }
        const manifestData = (manifestResult as { success: boolean; data?: { success: boolean; error?: string } })?.data
        if (!manifestData?.success) {
          console.error(`[PostProcess] Failed to generate manifest:`, manifestData?.error || 'Unknown error')
        } else {
          console.warn(`[PostProcess] Manifest generated: ${manifestPath}`)
        }

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
        let sourceSizeNum: number | undefined
        let transcodedSizeNum: number | undefined
        try {
          // Размер исходной ВИДЕОДОРОЖКИ (не всего MKV!)
          // Оценка: bitrate (bps) * duration (sec) / 8 (bits -> bytes)
          const videoBitrate = data.demuxResult.video?.bitrate
          const videoDuration = data.demuxResult.video?.duration
          if (videoBitrate && videoDuration) {
            sourceSizeNum = Math.round((videoBitrate * videoDuration) / 8)
            sourceSize = BigInt(sourceSizeNum)
          }

          // Размер транскодированного видео
          const transcodedStats = await electronApi.fs.stat(data.videoOutputPath)
          // fs:stat возвращает { size, mtime }, не { success, size }
          transcodedSize = transcodedStats?.size ? BigInt(transcodedStats.size) : undefined
          transcodedSizeNum = transcodedStats?.size ? transcodedStats.size : undefined
        } catch (e) {
          console.warn(`[PostProcess] Could not get file sizes:`, e)
        }

        // Получаем метаданные кодирования из refs (заполняются при завершении видео)
        const encodingMeta = this.refs.videoEncodingMeta.current.get(data.episodeId)

        // Обновляем манифест с информацией о кодировании
        if (data.videoOptions) {
          try {
            const compressionRatio = sourceSizeNum && transcodedSizeNum ? transcodedSizeNum / sourceSizeNum : undefined

            await electronApi.manifest.updateEncoding(manifestPath, {
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
              vmafScore: data.vmafScore,
              encoderType: data.encoderType ?? 'gpu',
              hardwareModel: data.hardwareModel,
              ffmpegVersion: data.ffmpegVersion,
              ffmpegCommand: encodingMeta?.ffmpegCommand,
              transcodeDurationMs: encodingMeta?.transcodeDurationMs,
              activeGpuWorkers: encodingMeta?.activeGpuWorkers,
              videoMaxConcurrent: data.videoMaxConcurrent,
              audioMaxConcurrent: data.audioMaxConcurrent,
              sourceSize: sourceSizeNum,
              transcodedSize: transcodedSizeNum,
              compressionRatio,
            })
          } catch (e) {
            console.warn(`[PostProcess] Failed to update manifest encoding:`, e)
          }
        }

        // Загружаем транскодированное видео в IPFS
        console.warn(`[PostProcess] Uploading transcoded video to IPFS...`)
        const transcodedCid = await uploadToIpfs(data.videoOutputPath)
        if (transcodedCid) {
          console.warn(`[PostProcess] Video uploaded: ${transcodedCid}`)
          // Удаляем локальный файл после успешной загрузки в IPFS (экономия диска)
          try {
            await electronApi.fs.delete(data.videoOutputPath, false)
            console.warn(`[PostProcess] Local video deleted: ${data.videoOutputPath}`)
          } catch (delErr) {
            console.warn(`[PostProcess] Failed to delete local video:`, delErr)
          }
        }

        // Загружаем манифест в IPFS (уже с encoding info)
        const manifestCid = await uploadToIpfs(manifestPath)
        if (manifestCid) {
          console.warn(`[PostProcess] Manifest uploaded: ${manifestCid}`)
          // Удаляем локальный манифест после успешной загрузки в IPFS
          try {
            await electronApi.fs.delete(manifestPath, false)
            console.warn(`[PostProcess] Local manifest deleted: ${manifestPath}`)
          } catch (delErr) {
            console.warn(`[PostProcess] Failed to delete local manifest:`, delErr)
          }
        }

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

        // Обновляем Episode с CID полями
        await this.mutations.updateEpisode.mutateAsync({
          where: { id: data.episodeId },
          data: {
            transcodedCid: transcodedCid ?? undefined,
            manifestCid: manifestCid ?? undefined,
            thumbnailCids: thumbnailCidsJson,
            screenshotCids: screenshotCidsJson,
            encodingSettingsJson,
            encodingProfile: data.encodingProfileId ? { connect: { id: data.encodingProfileId } } : undefined,
            sourceSize,
            transcodedSize,
          },
        })

        // Удаляем папку эпизода (видео, аудио, субтитры, шрифты уже загружены в IPFS)
        try {
          await electronApi.fs.delete(data.outputDir, false)
          console.warn(`[PostProcess] Episode dir deleted: ${data.outputDir}`)
        } catch {
          // Папка может не существовать или быть заблокирована — игнорируем
        }

        console.warn(`[PostProcess] Episode ${data.episodeNumber} completed`)
      } catch (e) {
        console.error(`[PostProcess] Error processing episode ${data.episodeNumber}:`, e)
      }
    }

    // Удаляем корневую папку аниме (anime.meta.json, poster.webp, пустые папки сезонов)
    const animeFolderPath = this.refs.createdAnimeFolder.current
    if (animeFolderPath) {
      try {
        await electronApi.fs.delete(animeFolderPath, false)
        console.warn(`[PostProcess] Anime root dir deleted: ${animeFolderPath}`)
      } catch {
        // Папка может содержать другие файлы — игнорируем ошибку
      }
    }

    // Сбрасываем индикатор файла после завершения
    this.setFileProgress(totalEpisodes, totalEpisodes, null)
    console.warn(`[PostProcess] All ${totalEpisodes} episodes post-processed`)
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
    if (!electronApi?.manifest?.updateNavigationBatch) {
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
          manifestCid: true,
        },
      })

      // Фильтруем только эпизоды с манифестами (по CID)
      const episodesWithManifest = episodes.filter(
        (ep): ep is typeof ep & { manifestCid: string } => ep.manifestCid !== null
      )

      if (episodesWithManifest.length < 2) {
        // Нечего связывать — один эпизод или меньше
        return
      }

      console.warn(`[Navigation] Updating navigation for ${episodesWithManifest.length} episodes`)

      // Вызываем batch-операцию в main процессе
      const result = await electronApi.manifest.updateNavigationBatch(
        episodesWithManifest.map((ep) => ({ id: ep.id, manifestCid: ep.manifestCid }))
      )

      if (!result.success) {
        console.warn('[Navigation] Failed:', result.error)
        return
      }

      // Обновляем manifestCid в БД
      const newCids = result.data ?? {}
      for (const [episodeId, newCid] of Object.entries(newCids)) {
        await this.mutations.updateEpisode.mutateAsync({
          where: { id: episodeId },
          data: { manifestCid: newCid },
        })
      }

      console.warn(`[Navigation] Updated ${Object.keys(newCids).length} manifests with navigation`)
    } catch (error) {
      console.warn('[Navigation] Error updating navigation:', error)
    }
  }

  /**
   * Генерация AnimeManifest и публикация в IPFS
   *
   * Собирает полные метаданные аниме и публикует в IPFS.
   * CID сохраняется в поле Anime.manifestCid для последующего доступа.
   */
  private async generateAndPublishAnimeManifest(animeId: string) {
    const electronApi = window.electronAPI
    if (!electronApi?.animeManifest) {
      console.warn('[AnimeManifest] Electron API недоступен')
      return
    }

    try {
      console.warn(`[AnimeManifest] Генерация манифеста для аниме ${animeId}...`)
      this.setFileProgress(1, 1, 'Генерация AnimeManifest...')

      const result = await electronApi.animeManifest.update(animeId)

      if (result.success && result.data?.manifestCid) {
        this.setFileProgress(1, 1, 'Публикация в IPFS...')
        console.warn(`[AnimeManifest] Манифест опубликован: ${result.data.manifestCid}`)
      } else {
        console.warn(`[AnimeManifest] Не удалось сгенерировать манифест:`, result.error || result.data?.error)
      }
    } catch (error) {
      console.warn('[AnimeManifest] Ошибка генерации манифеста:', error)
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

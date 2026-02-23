/**
 * ExportManager — Singleton для экспорта сериала в MKV
 *
 * Возможности:
 * - Последовательный экспорт всех эпизодов
 * - Прогресс и события для UI
 * - Отмена экспорта
 * - Главы, постер, шрифты
 * - IPFS интеграция: video/audio напрямую через gateway, fonts/poster через temp files
 */

import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import type {
  EpisodeExportProgress,
  ExportResult,
  NamingPattern,
  SeasonType,
  SeriesExportProgress,
} from '../../shared/types/export'
import { mergeMKV } from '../ffmpeg/merge'
import type { MergeChapter, MergeConfig, SubtitleTrack } from '../ffmpeg/types'
import { TempFileManager } from './temp-file-manager'

/** Порт IPFS Gateway */
const IPFS_GATEWAY_PORT = 8765

/**
 * Получить URL для IPFS контента — IPFS-only подход
 * Возвращает HTTP URL для gateway или null если CID не указан
 * @deprecated path параметр больше не используется
 */
function toSourceUrl(cid: string | null | undefined): string | null {
  if (!cid) return null
  return `http://localhost:${IPFS_GATEWAY_PORT}/ipfs/${cid}`
}

/** Данные эпизода для экспорта (передаются из renderer) */
export interface EpisodeExportData {
  /** ID эпизода */
  id: string
  /** Номер эпизода */
  number: number
  /** Номер сезона */
  seasonNumber: number
  /** Название эпизода */
  name?: string | null
  /** @deprecated Не используется — видео берётся из videoCid */
  videoPath?: string
  /** CID транскодированного видео в IPFS (обязательно для экспорта) */
  videoCid: string
  /** Аудиодорожки */
  audioTracks: Array<{
    language: string
    title: string | null
    /** @deprecated Не используется — аудио берётся из transcodedCid */
    transcodedPath?: string | null
    /** CID транскодированной аудиодорожки в IPFS */
    transcodedCid: string
    streamIndex: number
    /** @deprecated Не используется */
    inputPath?: string
  }>
  /** Субтитры */
  subtitleTracks: Array<{
    language: string
    title: string | null
    /** @deprecated Не используется — субтитры берутся из fileCid */
    filePath?: string | null
    /** CID файла субтитров в IPFS */
    fileCid: string
    /** @deprecated Не используется — шрифты берутся из fontCids */
    fonts?: string[]
    /** CID шрифтов в IPFS */
    fontCids: string[]
  }>
  /** Главы */
  chapters: Array<{
    startMs: number
    endMs: number
    title: string | null
    type: string
  }>
}

/** Конфигурация экспорта (передаётся из renderer) */
export interface ExportConfig {
  /** Название аниме */
  animeName: string
  /** Год */
  year?: number
  /** Путь к папке назначения */
  outputDir: string
  /** Паттерн именования */
  namingPattern: NamingPattern
  /** Путь к постеру (опционально) */
  posterPath?: string
  /** CID постера в IPFS */
  posterCid?: string | null
  /** Данные эпизодов */
  episodes: EpisodeExportData[]
  /** Выбранные ключи аудиодорожек (language + title) в порядке, указанном пользователем */
  selectedAudioKeys: string[]
  /** Выбранные ключи субтитров (language + title) в порядке, указанном пользователем */
  selectedSubtitleKeys: string[]
  /** Индекс аудиодорожки по умолчанию (0-based среди selectedAudioKeys) */
  defaultAudioIndex?: number
  /** Индекс субтитров по умолчанию (0-based среди selectedSubtitleKeys), undefined = нет default */
  defaultSubtitleIndex?: number
  /** Франшиза (для структуры папок) */
  franchise?: string
  /** Тип сезона (для умных паттернов) */
  seasonType?: SeasonType
  /** Создавать структуру папок */
  createFolderStructure?: boolean
  /** Открыть папку после экспорта */
  openFolderAfterExport?: boolean
}

/** События менеджера экспорта */
export interface ExportManagerEvents {
  /** Изменение прогресса */
  progress: (progress: SeriesExportProgress) => void
  /** Завершение экспорта */
  completed: (result: ExportResult) => void
  /** Ошибка экспорта */
  error: (error: string) => void
}

/**
 * Менеджер экспорта сериала
 */
export class ExportManager extends EventEmitter {
  private static instance: ExportManager | null = null

  /** Текущий прогресс */
  private progress: SeriesExportProgress = {
    totalEpisodes: 0,
    completedEpisodes: 0,
    currentEpisodeIndex: 0,
    episodes: [],
    status: 'idle',
  }

  /** Флаг отмены */
  private cancelled = false

  /** Активный экспорт */
  private isExporting = false

  private constructor() {
    super()
  }

  /**
   * Получить singleton экземпляр
   */
  static getInstance(): ExportManager {
    if (!ExportManager.instance) {
      ExportManager.instance = new ExportManager()
    }
    return ExportManager.instance
  }

  /**
   * Получить текущий прогресс
   */
  getProgress(): SeriesExportProgress {
    return { ...this.progress }
  }

  /**
   * Проверить, идёт ли экспорт
   */
  isActive(): boolean {
    return this.isExporting
  }

  /**
   * Отменить текущий экспорт
   */
  cancel(): void {
    if (this.isExporting) {
      this.cancelled = true
      this.progress.status = 'cancelled'
      this.emitProgress()
    }
  }

  /**
   * Запустить экспорт сериала
   */
  async startExport(config: ExportConfig): Promise<ExportResult> {
    if (this.isExporting) {
      throw new Error('Экспорт уже выполняется')
    }

    this.isExporting = true
    this.cancelled = false

    // Инициализация прогресса
    this.progress = {
      totalEpisodes: config.episodes.length,
      completedEpisodes: 0,
      currentEpisodeIndex: 0,
      episodes: config.episodes.map((ep) => ({
        episodeId: ep.id,
        episodeNumber: ep.number,
        seasonNumber: ep.seasonNumber,
        status: 'pending' as const,
        percent: 0,
      })),
      status: 'processing',
    }

    this.emitProgress()

    const result: ExportResult = {
      success: true,
      exportedFiles: [],
      skippedEpisodes: [],
      failedEpisodes: [],
    }

    try {
      // Определяем финальную папку назначения
      const finalOutputDir = this.resolveFinalOutputDir(config)

      // Убедимся, что папка назначения существует
      await fs.promises.mkdir(finalOutputDir, { recursive: true })

      for (let i = 0; i < config.episodes.length; i++) {
        if (this.cancelled) {
          break
        }

        const episode = config.episodes[i]
        this.progress.currentEpisodeIndex = i
        this.updateEpisodeStatus(i, 'processing', 0)

        try {
          const outputPath = await this.exportEpisode(config, episode, i, finalOutputDir)
          result.exportedFiles.push(outputPath)
          this.updateEpisodeStatus(i, 'completed', 100, undefined, outputPath)
          this.progress.completedEpisodes++
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)

          // Проверяем, можно ли пропустить эпизод
          if (this.isSkippableError(errorMsg)) {
            result.skippedEpisodes.push({
              episodeId: episode.id,
              reason: errorMsg,
            })
            this.updateEpisodeStatus(i, 'skipped', 100, errorMsg)
          } else {
            result.failedEpisodes.push({
              episodeId: episode.id,
              error: errorMsg,
            })
            this.updateEpisodeStatus(i, 'error', 0, errorMsg)
          }
        }

        this.emitProgress()
      }

      // Финальный статус
      if (this.cancelled) {
        this.progress.status = 'cancelled'
        result.success = false
      } else if (result.failedEpisodes.length > 0) {
        this.progress.status = 'completed' // Частично завершён
        result.success = result.exportedFiles.length > 0
      } else {
        this.progress.status = 'completed'
      }

      this.emitProgress()
      this.emit('completed', result)

      // Открыть папку после экспорта если нужно
      if (config.openFolderAfterExport && result.exportedFiles.length > 0) {
        const { shell } = await import('electron')
        await shell.openPath(finalOutputDir)
      }

      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      this.progress.status = 'error'
      this.progress.error = errorMsg
      this.emitProgress()
      this.emit('error', errorMsg)

      result.success = false
      return result
    } finally {
      this.isExporting = false
    }
  }

  /**
   * Экспортировать один эпизод
   *
   * Гибридный подход для IPFS:
   * - Video/Audio: напрямую через IPFS Gateway (HTTP URLs)
   * - Fonts/Poster: скачиваются во временные файлы (FFmpeg -attach требует локальные)
   */
  private async exportEpisode(
    config: ExportConfig,
    episode: EpisodeExportData,
    index: number,
    outputDir: string
  ): Promise<string> {
    // Генерируем имя файла
    const outputFileName = this.generateFileName(config, episode)
    const outputPath = path.join(outputDir, outputFileName)

    // Получаем URL к видео из IPFS (IPFS-only подход)
    const videoSource = toSourceUrl(episode.videoCid)

    // Проверяем наличие видео в IPFS
    if (!videoSource) {
      throw new Error('Видео не мигрировано в IPFS')
    }

    // Фильтруем и сортируем дорожки в порядке, указанном пользователем
    const selectedAudio = config.selectedAudioKeys
      .map((key) => episode.audioTracks.find((track) => this.makeTrackKey(track.language, track.title) === key))
      .filter((track): track is NonNullable<typeof track> => !!track)

    const selectedSubs = config.selectedSubtitleKeys
      .map((key) => episode.subtitleTracks.find((track) => this.makeTrackKey(track.language, track.title) === key))
      .filter((track): track is NonNullable<typeof track> => !!track)

    // Проверяем наличие дорожек
    if (selectedAudio.length === 0) {
      throw new Error('Нет выбранных аудиодорожек для этого эпизода')
    }

    // TempFileManager для скачивания fonts/poster из IPFS
    const tempManager = new TempFileManager()

    try {
      // Подготавливаем poster (FFmpeg -attach требует локальный файл)
      let posterPath = config.posterPath
      if (config.posterCid && !posterPath) {
        posterPath = await tempManager.downloadFromIpfs(config.posterCid, 'poster.jpg')
      }

      // Подготавливаем субтитры с шрифтами (IPFS-only)
      const preparedSubtitles: SubtitleTrack[] = []
      for (const sub of selectedSubs) {
        // Путь к субтитрам из IPFS
        const subtitlePath = toSourceUrl(sub.fileCid)
        if (!subtitlePath) continue

        // Шрифты — FFmpeg -attach требует локальные файлы
        // Скачиваем из IPFS (CID обязателен)
        const preparedFonts: string[] = []
        const fontCids = sub.fontCids || []
        for (let i = 0; i < fontCids.length; i++) {
          const fontCid = fontCids[i]
          if (!fontCid) continue

          // Скачиваем из IPFS
          const fontFilename = `font-${i}.ttf`
          const localFontPath = await tempManager.downloadFromIpfs(fontCid, fontFilename)
          preparedFonts.push(localFontPath)
        }

        preparedSubtitles.push({
          path: subtitlePath,
          language: sub.language,
          title: sub.title || '',
          fonts: preparedFonts,
        })
      }

      // Формируем конфигурацию мержа (IPFS-only)
      const mergeConfig: MergeConfig = {
        videoPath: videoSource,
        originalAudio: [],
        externalAudio: selectedAudio
          .filter((track) => track.transcodedCid) // Только с CID
          .map((track) => ({
            // Аудио из IPFS (FFmpeg поддерживает HTTP URLs для -i)
            path: toSourceUrl(track.transcodedCid)!,
            language: track.language,
            title: track.title || '',
          })),
        subtitles: preparedSubtitles,
        outputPath,
        chapters: episode.chapters.map(
          (ch): MergeChapter => ({
            startMs: ch.startMs,
            endMs: ch.endMs,
            title: ch.title || this.getChapterTitle(ch.type),
          })
        ),
        posterPath,
        // Default tracks — индексы соответствуют порядку в selectedAudio/selectedSubs
        defaultAudioIndex: config.defaultAudioIndex ?? 0,
        defaultSubtitleIndex: config.defaultSubtitleIndex,
      }

      // Запускаем мерж
      await mergeMKV(mergeConfig, (progress) => {
        this.updateEpisodeStatus(index, 'processing', progress.percent)
      })

      return outputPath
    } finally {
      // Очищаем временные файлы (fonts, poster)
      await tempManager.cleanup()
    }
  }

  /**
   * Определить финальную папку назначения с учётом структуры
   */
  private resolveFinalOutputDir(config: ExportConfig): string {
    if (!config.createFolderStructure) {
      return config.outputDir
    }

    const year = config.year || new Date().getFullYear()
    const animeFolderName = this.sanitizeFileName(`${year} - ${config.animeName}`)

    // Структура: [outputDir]/[Franchise]/[Year - AnimeName]/
    if (config.franchise) {
      const franchiseFolderName = this.sanitizeFileName(config.franchise)
      return path.join(config.outputDir, franchiseFolderName, animeFolderName)
    }

    // Без франшизы: [outputDir]/[Year - AnimeName]/
    return path.join(config.outputDir, animeFolderName)
  }

  /**
   * Генерировать имя файла по паттерну
   */
  private generateFileName(config: ExportConfig, episode: EpisodeExportData): string {
    const nn = String(episode.number).padStart(2, '0')
    const ss = String(episode.seasonNumber).padStart(2, '0')
    const episodeName = episode.name || `Episode ${episode.number}`
    const year = config.year?.toString() || new Date().getFullYear().toString()

    const fileName = config.namingPattern
      .replace('{Anime}', this.sanitizeFileName(config.animeName))
      .replace('{Year}', year)
      .replace('{nn}', nn)
      .replace('{ss}', ss)
      .replace('{Episode}', this.sanitizeFileName(episodeName))

    return `${fileName}.mkv`
  }

  /**
   * Очистить имя файла от недопустимых символов
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Создать ключ дорожки (language + title)
   */
  private makeTrackKey(language: string, title: string | null): string {
    return `${language}:${title || ''}`
  }

  /**
   * Получить название главы по типу
   */
  private getChapterTitle(type: string): string {
    switch (type) {
      case 'OP':
        return 'Opening'
      case 'ED':
        return 'Ending'
      case 'RECAP':
        return 'Recap'
      case 'PREVIEW':
        return 'Preview'
      default:
        return 'Chapter'
    }
  }

  /**
   * Проверить, можно ли пропустить ошибку (эпизод не готов к экспорту)
   */
  private isSkippableError(error: string): boolean {
    return (
      error.includes('Видеофайл не найден') ||
      error.includes('Видео не мигрировано в IPFS') ||
      error.includes('Нет выбранных аудиодорожек')
    )
  }

  /**
   * Обновить статус эпизода
   */
  private updateEpisodeStatus(
    index: number,
    status: EpisodeExportProgress['status'],
    percent: number,
    error?: string,
    outputPath?: string
  ): void {
    if (this.progress.episodes[index]) {
      this.progress.episodes[index] = {
        ...this.progress.episodes[index],
        status,
        percent,
        error,
        outputPath,
      }
      this.emitProgress()
    }
  }

  /**
   * Emit progress event
   */
  private emitProgress(): void {
    this.emit('progress', this.getProgress())
  }
}

/** Экспортируем singleton */
export const exportManager = ExportManager.getInstance()

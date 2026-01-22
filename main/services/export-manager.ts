/**
 * ExportManager — Singleton для экспорта сериала в MKV
 *
 * Возможности:
 * - Последовательный экспорт всех эпизодов
 * - Прогресс и события для UI
 * - Отмена экспорта
 * - Главы, постер, шрифты
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
  /** Путь к транскодированному видео (или source) */
  videoPath: string
  /** Аудиодорожки */
  audioTracks: Array<{
    language: string
    title: string | null
    transcodedPath: string | null
    streamIndex: number
    inputPath: string
  }>
  /** Субтитры */
  subtitleTracks: Array<{
    language: string
    title: string | null
    filePath: string | null
    fonts: string[]
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
   */
  private async exportEpisode(
    config: ExportConfig,
    episode: EpisodeExportData,
    index: number,
    outputDir: string,
  ): Promise<string> {
    // Генерируем имя файла
    const outputFileName = this.generateFileName(config, episode)
    const outputPath = path.join(outputDir, outputFileName)

    // Проверяем наличие видео
    if (!episode.videoPath || !fs.existsSync(episode.videoPath)) {
      throw new Error('Видеофайл не найден')
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

    // Формируем конфигурацию мержа
    const mergeConfig: MergeConfig = {
      videoPath: episode.videoPath,
      originalAudio: [],
      externalAudio: selectedAudio.map((track) => ({
        path: track.transcodedPath || track.inputPath,
        language: track.language,
        title: track.title || '',
      })),
      subtitles: selectedSubs
        .filter((s): s is typeof s & { filePath: string } => !!s.filePath)
        .map(
          (track): SubtitleTrack => ({
            path: track.filePath,
            language: track.language,
            title: track.title || '',
            fonts: track.fonts,
          }),
        ),
      outputPath,
      chapters: episode.chapters.map(
        (ch): MergeChapter => ({
          startMs: ch.startMs,
          endMs: ch.endMs,
          title: ch.title || this.getChapterTitle(ch.type),
        }),
      ),
      posterPath: config.posterPath,
      // Default tracks — индексы соответствуют порядку в selectedAudio/selectedSubs
      defaultAudioIndex: config.defaultAudioIndex ?? 0,
      defaultSubtitleIndex: config.defaultSubtitleIndex,
    }

    // Запускаем мерж
    await mergeMKV(mergeConfig, (progress) => {
      this.updateEpisodeStatus(index, 'processing', progress.percent)
    })

    return outputPath
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
   * Проверить, можно ли пропустить ошибку
   */
  private isSkippableError(error: string): boolean {
    return error.includes('Видеофайл не найден') || error.includes('Нет выбранных аудиодорожек')
  }

  /**
   * Обновить статус эпизода
   */
  private updateEpisodeStatus(
    index: number,
    status: EpisodeExportProgress['status'],
    percent: number,
    error?: string,
    outputPath?: string,
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

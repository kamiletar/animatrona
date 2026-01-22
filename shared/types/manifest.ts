/**
 * Типы для манифеста эпизода
 * Используется плеером для получения метаданных
 */

/** Версия формата манифеста */
export const MANIFEST_VERSION = 1

/** Информация о видео */
export interface ManifestVideo {
  /** Путь к видеофайлу */
  path: string
  /** Длительность в миллисекундах */
  durationMs: number
  /** Ширина кадра */
  width: number
  /** Высота кадра */
  height: number
  /** Кодек видео (hevc, av1, h264) */
  codec: string
  /** Битрейт видео (bps) */
  bitrate?: number
}

/** Статус транскодирования аудиодорожки (соответствует Prisma enum TranscodeStatus) */
export type AudioTranscodeStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'SKIPPED' | 'ERROR'

/** Аудиодорожка */
export interface ManifestAudioTrack {
  /** Уникальный ID дорожки */
  id: string
  /** Индекс потока в контейнере */
  streamIndex: number
  /** Язык (ISO 639-1: ru, en, ja) */
  language: string
  /** Название дорожки (Japanese 5.1, Russian Dub) */
  title: string
  /** Кодек (aac, opus, flac) */
  codec: string
  /** Конфигурация каналов (2.0, 5.1, 7.1) */
  channels: string
  /** Битрейт (bps) */
  bitrate?: number
  /** Дорожка по умолчанию */
  isDefault: boolean
  /** Путь к извлечённому файлу (после demux) */
  extractedPath?: string
  /** Путь к готовому аудиофайлу (транскодированный или оригинал) */
  transcodedPath?: string
  /** Статус транскодирования */
  transcodeStatus: AudioTranscodeStatus
}

/** Субтитры */
export interface ManifestSubtitleTrack {
  /** Уникальный ID дорожки */
  id: string
  /** Индекс потока (-1 для внешних файлов) */
  streamIndex: number
  /** Язык */
  language: string
  /** Название (Russian Signs, English Subs) */
  title: string
  /** Формат (ass, srt, vtt) */
  format: string
  /** Путь к извлечённому файлу субтитров */
  filePath: string
  /** Дорожка по умолчанию */
  isDefault: boolean
  /** Шрифты для ASS субтитров */
  fonts?: ManifestSubtitleFont[]
}

/** Шрифт для ASS субтитров */
export interface ManifestSubtitleFont {
  /** Имя шрифта как в ASS файле */
  name: string
  /** Путь к файлу шрифта */
  path: string
}

/** Тип главы */
export type ManifestChapterType = 'chapter' | 'op' | 'ed' | 'recap' | 'preview'

/** Глава */
export interface ManifestChapter {
  /** Время начала в миллисекундах */
  startMs: number
  /** Время окончания в миллисекундах */
  endMs: number
  /** Название главы */
  title: string | null
  /** Тип главы */
  type: ManifestChapterType
  /** Можно ли пропустить */
  skippable: boolean
}

/** Превью кадры (sprite sheet) */
export interface ManifestThumbnails {
  /** Путь к VTT файлу с метками времени */
  vttPath: string
  /** Путь к sprite sheet изображению */
  spritePath: string
}

/** Навигация между эпизодами */
export interface ManifestNavigation {
  /** Следующий эпизод */
  nextEpisode?: {
    id: string
    manifestPath: string
  }
  /** Предыдущий эпизод */
  prevEpisode?: {
    id: string
    manifestPath: string
  }
}

/** Информация об эпизоде */
export interface ManifestInfo {
  /** Название аниме */
  animeName: string
  /** Номер сезона */
  seasonNumber: number
  /** Номер эпизода */
  episodeNumber: number
  /** Название эпизода (если есть) */
  episodeName?: string
}

/** Полный манифест эпизода */
export interface EpisodeManifest {
  /** Версия формата */
  version: typeof MANIFEST_VERSION
  /** ID эпизода в БД */
  episodeId: string
  /** Информация об эпизоде */
  info: ManifestInfo
  /** Информация о видео */
  video: ManifestVideo
  /** Аудиодорожки */
  audioTracks: ManifestAudioTrack[]
  /** Субтитры */
  subtitleTracks: ManifestSubtitleTrack[]
  /** Главы */
  chapters: ManifestChapter[]
  /** Превью кадры */
  thumbnails?: ManifestThumbnails
  /** Навигация */
  navigation?: ManifestNavigation
  /** Дата генерации */
  generatedAt: string
}

/** Опции для генерации манифеста */
export interface GenerateManifestOptions {
  /** ID эпизода в БД */
  episodeId: string
  /** Путь к видеофайлу */
  videoPath: string
  /** Папка для вывода (манифест + извлечённые файлы) */
  outputDir: string
  /** Информация об аниме */
  animeInfo: ManifestInfo
  /** Генерировать превью (по умолчанию false) */
  generateThumbnails?: boolean
}

/** Результат генерации манифеста */
export interface GenerateManifestResult {
  success: boolean
  manifestPath?: string
  manifest?: EpisodeManifest
  error?: string
}

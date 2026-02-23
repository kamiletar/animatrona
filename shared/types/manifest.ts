/**
 * Типы для манифеста эпизода
 * Используется плеером для получения метаданных
 */

/** Версия формата манифеста */
export const MANIFEST_VERSION = 1

/** Информация о видео */
export interface ManifestVideo {
  /** CID видеофайла в IPFS */
  cid: string
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
  /** CID аудиофайла в IPFS */
  cid?: string
  /** Группа озвучки (AniDUB, AniLibria и т.д.) */
  dubGroup?: string
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
  /** CID файла субтитров в IPFS */
  cid?: string
  /** Дорожка по умолчанию */
  isDefault: boolean
  /** Шрифты для ASS субтитров */
  fonts?: ManifestSubtitleFont[]
  /** Группа субтитров (HorribleSubs, FanSub Team и т.д.) */
  dubGroup?: string
}

/** Шрифт для ASS субтитров */
export interface ManifestSubtitleFont {
  /** Имя шрифта как в ASS файле */
  name: string
  /** CID файла шрифта в IPFS */
  cid?: string
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
  /** CID VTT файла с метками времени в IPFS */
  vttCid: string
  /** CID sprite sheet изображения в IPFS */
  spriteCid: string
}

/** Навигация между эпизодами */
export interface ManifestNavigation {
  /** Следующий эпизод */
  nextEpisode?: {
    id: string
    manifestCid: string
  }
  /** Предыдущий эпизод */
  prevEpisode?: {
    id: string
    manifestCid: string
  }
}

/** Информация о кодировании */
export interface ManifestEncodingInfo {
  /** Название профиля кодирования */
  profileName: string
  /** Кодек (av1, hevc, h264) */
  codec: string
  /** Constant Quality (CQ/CRF) */
  cq: number
  /** Пресет энкодера */
  preset: string
  /** Режим контроля битрейта */
  rateControl: string
  /** Tune настройка */
  tune?: string
  /** Multipass режим */
  multipass?: string
  /** Spatial AQ */
  spatialAq?: boolean
  /** Temporal AQ */
  temporalAq?: boolean
  /** AQ Strength */
  aqStrength?: number
  /** GOP Size */
  gopSize?: number
  /** Lookahead */
  lookahead?: number
  /** B-Ref Mode */
  bRefMode?: string
  /** Принудительный 10-bit */
  force10Bit?: boolean

  /** VMAF score (если использовался подбор) */
  vmafScore?: number
  /** Тип энкодера (gpu/cpu) */
  encoderType: 'gpu' | 'cpu'
  /** Модель оборудования (GPU или CPU) */
  hardwareModel?: string
  /** Версия FFmpeg */
  ffmpegVersion?: string
  /** Полная команда FFmpeg */
  ffmpegCommand?: string
  /** Время транскодирования в мс */
  transcodeDurationMs?: number
  /** Количество активных GPU воркеров */
  activeGpuWorkers?: number
  /** Макс. параллельных видео-потоков */
  videoMaxConcurrent?: number
  /** Макс. параллельных аудио-потоков */
  audioMaxConcurrent?: number

  /** Размер исходного файла в байтах */
  sourceSize?: number
  /** Размер транскодированного файла в байтах */
  transcodedSize?: number
  /** Коэффициент сжатия (transcodedSize / sourceSize) */
  compressionRatio?: number
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
  /** Информация о кодировании */
  encoding?: ManifestEncodingInfo
  /** Дата генерации */
  generatedAt: string
}

/** Опционально: данные дорожки из рекомендаций (для передачи dubGroup/language из UI) */
export interface TrackOverride {
  /** Индекс потока (или -1 для внешних) */
  streamIndex: number
  /** Язык (ISO 639-1) */
  language?: string
  /** Группа озвучки/субтитров */
  dubGroup?: string
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
  /** Переопределения для аудиодорожек (язык, dubGroup из UI) */
  audioTrackOverrides?: TrackOverride[]
  /** Переопределения для субтитров (язык, dubGroup из UI) */
  subtitleTrackOverrides?: TrackOverride[]
}

/** Результат генерации манифеста */
export interface GenerateManifestResult {
  success: boolean
  manifestPath?: string
  manifest?: EpisodeManifest
  error?: string
}

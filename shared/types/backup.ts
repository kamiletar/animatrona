/**
 * Типы для системы резервного копирования и восстановления библиотеки
 *
 * Архитектура:
 * - anime.meta.json — ТОЛЬКО релизные данные (shikimoriId, isBdRemux, fallbackInfo)
 * - _user/ — пользовательские данные (watchStatus, rating, progress)
 *
 * См. также: user-data.ts для типов пользовательских данных
 */

// =============================================================================
// ОБЩИЕ ТИПЫ
// =============================================================================

/** Статус просмотра аниме */
export type WatchStatusMeta =
  | 'NOT_STARTED'
  | 'WATCHING'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'DROPPED'
  | 'PLANNED'

/** Предпочтения дорожек для автовыбора в следующих эпизодах */
export interface TrackPreferences {
  audioLanguage?: string // 'ru', 'ja', 'en'
  audioDubGroup?: string // 'Studio Band', 'AniLibria'
  subtitleLanguage?: string
  subtitleDubGroup?: string // 'Katsura', 'Crunchyroll'
}

/** Fallback информация если нет связи с Shikimori */
export interface AnimeFallbackInfo {
  name: string
  originalName?: string
  year?: number
}

/** Выбранная дорожка (по dubGroup/language, не по ID) */
export interface SelectedTrack {
  dubGroup?: string // 'Studio Band'
  language?: string // 'ru'
}

// =============================================================================
// ANIME META — РЕЛИЗНЫЕ ДАННЫЕ
// =============================================================================

/**
 * Релизные метаданные аниме
 * Сохраняется в: {animeFolder}/anime.meta.json
 *
 * Содержит ТОЛЬКО данные, которые можно распространять через P2P/IPFS:
 * - shikimoriId для идентификации
 * - isBdRemux флаг
 * - fallbackInfo для оффлайн режима
 *
 * НЕ СОДЕРЖИТ пользовательские данные — они в _user/
 */
export interface AnimeMeta {
  /** Версия формата */
  version: 1

  /** Shikimori ID для восстановления метаданных из API */
  shikimoriId: number | null

  /** BDRemux флаг */
  isBdRemux: boolean

  /** Fallback если нет Shikimori */
  fallbackInfo: AnimeFallbackInfo

  /** Когда создан релиз */
  createdAt: string // ISO date
}

// =============================================================================
// RESTORE TYPES (восстановление библиотеки)
// =============================================================================

/** Результат сканирования папки аниме */
export interface ScannedAnime {
  folderPath: string
  folderName: string
  animeMeta: AnimeMeta | null // null если файл отсутствует
  posterPath: string | null
  seasons: ScannedSeason[]
}

/** Результат сканирования сезона */
export interface ScannedSeason {
  folderPath: string
  seasonNumber: number
  episodes: ScannedEpisode[]
}

/** Результат сканирования эпизода */
export interface ScannedEpisode {
  folderPath: string
  episodeNumber: number
  manifestPath: string | null // episode-N-manifest.json
  hasVideo: boolean
  hasAudio: boolean
  hasSubtitles: boolean
}

/** Результат полного сканирования библиотеки */
export interface LibraryScanResult {
  libraryPath: string
  anime: ScannedAnime[]
  totalEpisodes: number
  warnings: string[]
}

/** Результат восстановления */
export interface RestoreResult {
  success: boolean
  restoredAnime: number
  restoredEpisodes: number
  errors: RestoreError[]
  warnings: string[]
}

/** Ошибка восстановления */
export interface RestoreError {
  type: 'anime' | 'episode'
  path: string
  message: string
}

/** Опции восстановления */
export interface RestoreOptions {
  /** Объединить с существующей библиотекой (true) или заменить (false) */
  merge: boolean
  /** Пропустить аниме без shikimoriId */
  skipWithoutShikimori: boolean
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Текущая версия формата anime.meta.json */
export const ANIME_META_VERSION = 1

/** Имя файла метаданных аниме */
export const ANIME_META_FILE = 'anime.meta.json'

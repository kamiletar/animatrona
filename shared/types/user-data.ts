/**
 * Типы для пользовательских данных в папке _user/
 *
 * Структура:
 * Library/_user/
 * ├── user-data.json           # Индексный файл
 * └── anime/
 *     └── {folderHash}.json    # Данные аниме + все эпизоды
 *
 * Ключевое:
 * - Релизные данные в anime.meta.json (shikimoriId, isBdRemux, fallbackInfo)
 * - Пользовательские данные в _user/ (watchStatus, rating, progress)
 */

import type { SelectedTrack, TrackPreferences, WatchStatusMeta } from './backup'

// =============================================================================
// ИДЕНТИФИКАЦИЯ
// =============================================================================

/**
 * Идентификатор аниме в системе _user/
 * Используется хэш относительного пути для надёжной идентификации
 */
export interface AnimeIdentifier {
  /** SHA-256 хэш относительного пути (первые 16 символов) */
  folderHash: string
  /** Относительный путь от корня библиотеки (для человекочитаемости) */
  relativePath: string
}

// =============================================================================
// ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ ЭПИЗОДА
// =============================================================================

/**
 * Прогресс просмотра эпизода
 * Ключ в episodes: относительный путь от папки аниме ("Season 1/Episode 1")
 */
export interface UserEpisodeData {
  /** Позиция воспроизведения в секундах */
  currentTime: number
  /** Просмотрено до конца */
  completed: boolean
  /** Громкость (0-1) */
  volume?: number
  /** Дата последнего просмотра (ISO) */
  lastWatchedAt: string

  /** Выбранная аудио-дорожка */
  selectedAudio: SelectedTrack | null
  /** Выбранные субтитры */
  selectedSubtitle: SelectedTrack | null
}

// =============================================================================
// ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ АНИМЕ
// =============================================================================

/**
 * Пользовательские данные аниме
 * Сохраняется в: Library/_user/anime/{folderHash}.json
 */
export interface UserAnimeData {
  /** Версия формата */
  version: 1

  /** Идентификатор для поиска папки */
  identifier: AnimeIdentifier

  // Статус просмотра
  watchStatus: WatchStatusMeta
  userRating: number | null // 1-10
  watchedAt: string | null // ISO date (когда досмотрел)

  /** Предпочтения дорожек для автовыбора */
  trackPreferences: TrackPreferences

  /**
   * Прогресс по эпизодам
   * Ключ: относительный путь от папки аниме ("Season 1/Episode 1")
   */
  episodes: Record<string, UserEpisodeData>

  // Timestamps
  createdAt: string // ISO date
  updatedAt: string // ISO date
}

// =============================================================================
// ИНДЕКСНЫЙ ФАЙЛ
// =============================================================================

/**
 * Индексный файл _user/user-data.json
 * Содержит метаданные и быстрый доступ к статистике
 */
export interface UserDataIndex {
  /** Версия формата */
  version: 1

  /** Путь к папке библиотеки (для проверки корректности) */
  libraryPath: string

  /** Статистика */
  stats: {
    /** Количество аниме с данными */
    animeCount: number
    /** Количество эпизодов с прогрессом */
    episodesWithProgress: number
    /** Последнее обновление */
    lastUpdated: string
  }

  /** Маппинг folderHash → relativePath для быстрого поиска */
  animeIndex: Record<string, string>
}

// =============================================================================
// КОНСТАНТЫ
// =============================================================================

/** Текущая версия формата user data */
export const USER_DATA_VERSION = 1

/** Имена файлов и папок */
export const USER_DATA_PATHS = {
  /** Папка пользовательских данных */
  USER_FOLDER: '_user',
  /** Индексный файл */
  INDEX_FILE: 'user-data.json',
  /** Папка с данными аниме */
  ANIME_FOLDER: 'anime',
} as const

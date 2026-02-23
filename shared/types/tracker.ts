/**
 * Типы для интеграции с animatrona-tracker
 */

/** Конфигурация подключения к tracker */
export interface TrackerConfig {
  /** URL трекера (например, https://animatrona-tracker.letar.best) */
  baseUrl: string
  /** API ключ для аутентификации */
  apiKey: string
  /** Включена ли публикация */
  enabled: boolean
}

/** Результат публикации на tracker */
export interface TrackerPublishResult {
  success: boolean
  /** ID аниме на tracker */
  animeId?: string
  /** Статус (PENDING / PUBLISHED) */
  status?: string
  /** Количество эпизодов */
  episodeCount?: number
  /** Сообщение об ошибке */
  error?: string
}

/** Результат проверки подключения */
export interface TrackerConnectionResult {
  success: boolean
  message: string
  trackerName?: string
}

/**
 * Типы статистики пользователя для системы репутации
 *
 * Отслеживает метрики IPFS трафика, время раздачи и помощь пирам.
 *
 * Примечание: В БД используется BigInt, но в IPC передаём как string
 * для совместимости с JSON сериализацией.
 */

// ============================================================================
// Дневная статистика
// ============================================================================

/**
 * Статистика за один день
 */
export interface DailyStats {
  /** ID записи */
  id?: string
  /** Дата в формате YYYY-MM-DD */
  date: string
  /** Байты загружено (upload) - строка для BigInt */
  bytesUploaded: string
  /** Байты скачано (download) - строка для BigInt */
  bytesDownloaded: string
  /** Время раздачи в мс - строка для BigInt */
  seedingTimeMs: string
  /** Количество уникальных пиров, которым помогли */
  peersHelped: number
}

// ============================================================================
// Полная статистика пользователя
// ============================================================================

/**
 * Полная статистика пользователя
 */
export interface UserStats {
  // === Трафик (суммарный) — строки для BigInt ===

  /** Всего байт загружено (upload) */
  bytesUploaded: string
  /** Всего байт скачано (download) */
  bytesDownloaded: string

  // === Время — строки для BigInt ===

  /** Общее время раздачи в мс */
  totalSeedingTimeMs: string
  /** Время текущей сессии раздачи в мс */
  currentSessionMs: string

  // === Контент ===

  /** Количество уникального контента (CID), который раздаётся */
  uniqueContentSeeded: number
  /** Общее количество пиров, которым помогли (скачали от нас) */
  peersHelped: number

  // === Timestamps ===

  /** Дата первой раздачи (ISO string или null) */
  firstSeedAt: string | null
  /** Дата последней активности (ISO string) */
  lastActiveAt: string

  // === История ===

  /** Статистика по дням (последние 30 дней) */
  dailyStats: DailyStats[]
}

// ============================================================================
// Начальные значения
// ============================================================================

/**
 * Начальная статистика для нового пользователя
 */
export const INITIAL_USER_STATS: UserStats = {
  bytesUploaded: '0',
  bytesDownloaded: '0',
  totalSeedingTimeMs: '0',
  currentSessionMs: '0',
  uniqueContentSeeded: 0,
  peersHelped: 0,
  firstSeedAt: null,
  lastActiveAt: new Date().toISOString(),
  dailyStats: [],
}

// ============================================================================
// События статистики
// ============================================================================

/**
 * Типы событий статистики
 */
export type StatsEventType = 'stats:updated' | 'stats:sessionStarted' | 'stats:sessionEnded' | 'stats:dailyReset'

/**
 * Payload события обновления статистики
 */
export interface StatsUpdatedEvent {
  /** Текущая статистика */
  stats: UserStats
  /** Дельта изменений */
  delta: {
    bytesUploaded?: number
    bytesDownloaded?: number
    seedingTimeMs?: number
    peersHelped?: number
  }
}

// ============================================================================
// IPC типы
// ============================================================================

/**
 * Результат операции со статистикой
 */
export interface StatsOperationResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

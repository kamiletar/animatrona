/**
 * Централизованный логгер для main process
 *
 * Особенности:
 * - Structured logging с контекстом
 * - Уровни логирования (debug, info, warn, error)
 * - Временные метки ISO 8601
 * - Форматирование для консоли Electron
 * - Возможность фильтрации по уровню через env
 *
 * @example
 * import { logger } from '../utils/logger'
 *
 * const log = logger.child('FFmpeg')
 * log.info('Starting transcode', { input: '/path/to/file.mkv' })
 * log.error('Transcode failed', { error: err.message, code: err.code })
 */

/** Уровни логирования */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Уровни для сравнения (меньше = более verbose) */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/** Цвета для консоли (ANSI escape codes) */
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
} as const

/** Цвет для каждого уровня */
const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: COLORS.dim,
  info: COLORS.green,
  warn: COLORS.yellow,
  error: COLORS.red,
}

/** Метка для каждого уровня */
const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
}

/**
 * Получить текущий уровень логирования из env
 */
function getMinLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase()
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel
  }
  // Production: только warn и error
  // Development: всё
  return process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
}

/**
 * Форматирует дополнительные данные для вывода
 */
function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) {
    return ''
  }

  // Сокращаем длинные значения
  const formatted = Object.entries(meta).map(([key, value]) => {
    let str = String(value)
    if (str.length > 100) {
      str = str.slice(0, 100) + '...'
    }
    return `${key}=${str}`
  })

  return ` ${COLORS.dim}[${formatted.join(', ')}]${COLORS.reset}`
}

/**
 * Интерфейс дочернего логгера
 */
export interface Logger {
  /** Debug сообщение (verbose) */
  debug(message: string, meta?: Record<string, unknown>): void
  /** Информационное сообщение */
  info(message: string, meta?: Record<string, unknown>): void
  /** Предупреждение */
  warn(message: string, meta?: Record<string, unknown>): void
  /** Ошибка */
  error(message: string, meta?: Record<string, unknown>): void
  /** Создать дочерний логгер с дополнительным контекстом */
  child(name: string): Logger
}

/**
 * Создаёт логгер с указанным контекстом
 */
function createLogger(context: string[]): Logger {
  const minLevel = getMinLevel()
  const minLevelNum = LOG_LEVELS[minLevel]
  const contextStr = context.length > 0 ? `${COLORS.cyan}[${context.join(':')}]${COLORS.reset} ` : ''

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    // Фильтрация по уровню
    if (LOG_LEVELS[level] < minLevelNum) {
      return
    }

    const timestamp = new Date().toISOString()
    const levelColor = LEVEL_COLORS[level]
    const levelLabel = LEVEL_LABELS[level]
    const metaStr = formatMeta(meta)

    const output = `${COLORS.dim}${timestamp}${COLORS.reset} ${levelColor}${levelLabel}${COLORS.reset} ${contextStr}${message}${metaStr}`

    // Используем соответствующий метод console
    // ESLint разрешает только warn и error
    switch (level) {
      case 'debug':
      case 'info':
      case 'warn':
        console.warn(output)
        break
      case 'error':
        console.error(output)
        break
    }
  }

  return {
    debug: (message, meta) => log('debug', message, meta),
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
    child: (name) => createLogger([...context, name]),
  }
}

/**
 * Корневой логгер
 *
 * Использование:
 * ```typescript
 * import { logger } from '../utils/logger'
 *
 * // Создание дочернего логгера для модуля
 * const log = logger.child('TranscodeManager')
 *
 * log.info('Task started', { taskId: '123' })
 * log.error('Task failed', { error: 'Timeout' })
 * ```
 */
export const logger = createLogger([])

/**
 * Создаёт логгер для модуля (shortcut)
 *
 * @example
 * const log = createModuleLogger('FFmpeg')
 * log.info('Probe completed', { duration: 120.5 })
 */
export function createModuleLogger(moduleName: string): Logger {
  return logger.child(moduleName)
}

/**
 * Retry-обёртка для SQLite операций (renderer process)
 *
 * libsql не поддерживает busy_timeout корректно (github.com/tursodatabase/libsql-client-ts/issues/288),
 * поэтому реализуем retry на уровне приложения для конкурентных записей.
 */

/** Ошибки SQLite, при которых стоит повторить операцию */
const RETRYABLE_PATTERNS = ['database is locked', 'SQLITE_BUSY', 'Operation has timed out', 'database table is locked']

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return RETRYABLE_PATTERNS.some((pattern) => message.includes(pattern))
}

/**
 * Выполнить операцию с retry при SQLITE_BUSY / database locked
 *
 * Экспоненциальный backoff с jitter:
 * попытка 1: ~100ms, попытка 2: ~200ms, попытка 3: ~400ms, ...
 */
export async function withDbRetry<T>(operation: () => Promise<T>, maxAttempts = 5): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === maxAttempts || !isRetryableError(error)) {
        throw error
      }

      const baseDelay = 100 * 2 ** (attempt - 1)
      const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1)
      await new Promise((resolve) => setTimeout(resolve, Math.round(baseDelay + jitter)))
    }
  }

  throw new Error('withDbRetry: unreachable')
}

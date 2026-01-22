/**
 * Утилиты форматирования для UI
 */

/**
 * Форматирует время в человекочитаемый формат
 *
 * @param seconds - Время в секундах
 * @returns Строка формата "Xч Yм Zс" или "Yм Zс" или "Zс"
 */
export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || seconds < 0 || !isFinite(seconds)) {
    return '--:--'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}ч ${minutes}м ${secs}с`
  }
  if (minutes > 0) {
    return `${minutes}м ${secs}с`
  }
  return `${secs}с`
}

/**
 * Форматирует миллисекунды в человекочитаемый формат
 *
 * @param ms - Время в миллисекундах
 * @returns Строка формата "Xч Yм Zс"
 */
export function formatDurationMs(ms: number | undefined): string {
  if (ms === undefined || ms < 0) {
    return '--:--'
  }
  return formatDuration(ms / 1000)
}

/**
 * Форматирует размер файла
 *
 * @param bytes - Размер в байтах
 * @returns Строка формата "X.XX MB" или "X.XX GB"
 */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes < 0) {
    return '--'
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Форматирует скорость транскодирования
 *
 * @param speed - Скорость относительно реального времени
 * @returns Строка формата "1.5x" или "--"
 */
export function formatSpeed(speed: number | undefined): string {
  if (speed === undefined || speed < 0 || !isFinite(speed)) {
    return '--'
  }
  return `${speed.toFixed(2)}x`
}

/**
 * Форматирует FPS
 *
 * @param fps - Кадров в секунду
 * @returns Строка формата "45 fps" или "--"
 */
export function formatFps(fps: number | undefined): string {
  if (fps === undefined || fps < 0 || !isFinite(fps)) {
    return '--'
  }
  return `${fps.toFixed(0)} fps`
}

/**
 * Форматирует битрейт
 *
 * @param kbps - Битрейт в kbps
 * @returns Строка формата "2.5 Mbps" или "256 kbps"
 */
export function formatBitrate(kbps: number | undefined): string {
  if (kbps === undefined || kbps < 0) {
    return '--'
  }

  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`
  }
  return `${kbps.toFixed(0)} kbps`
}

/**
 * Рассчитывает коэффициент сжатия
 *
 * @param inputSize - Размер входного файла (bytes)
 * @param outputSize - Размер выходного файла (bytes)
 * @returns Процент от оригинала или undefined
 */
export function calculateCompressionRatio(
  inputSize: number | undefined,
  outputSize: number | undefined
): number | undefined {
  if (!inputSize || !outputSize || inputSize === 0) {
    return undefined
  }
  return (outputSize / inputSize) * 100
}

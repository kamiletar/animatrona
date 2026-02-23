/**
 * Консолидированные утилиты форматирования для отображения данных
 *
 * Объединяет функции из:
 * - lib/format-utils.ts (оригинал: formatFileSize, formatDuration, formatBitrate)
 * - utils/format.ts (formatDurationHuman, formatDurationMs, formatBytes, formatSpeed, formatFps, formatBitrateKbps, calculateCompressionRatio)
 * - p2p-sharing/format-utils.ts (formatTransferSpeed)
 */

// --- Размеры файлов ---

/**
 * Форматирует размер файла в читаемый вид (английские единицы)
 * @param bytes - Размер в байтах
 * @returns Строка вида "1.5 GB", "256 MB", "12 KB", "100 B"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/**
 * Форматирует размер файла (безопасный вариант с undefined)
 * @param bytes - Размер в байтах
 * @returns Строка формата "X.XX MB" или "X.XX GB"
 */
export function formatBytes(bytes: number | undefined | null): string {
  if (bytes == null || bytes < 0) {
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

// --- Длительность ---

/**
 * Форматирует длительность в формате таймлайна
 * @param seconds - Длительность в секундах
 * @returns Строка вида "1:23:45" или "23:45"
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Форматирует время в человекочитаемый формат
 * @param seconds - Время в секундах
 * @returns Строка формата "Xч Yм Zс" или "Yм Zс" или "Zс"
 */
export function formatDurationHuman(seconds: number | undefined): string {
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
 * @param ms - Время в миллисекундах
 * @returns Строка формата "Xч Yм Zс"
 */
export function formatDurationMs(ms: number | undefined): string {
  if (ms === undefined || ms < 0) {
    return '--:--'
  }
  return formatDurationHuman(ms / 1000)
}

// --- Скорости и битрейты ---

/**
 * Форматирует битрейт (вход: bits/sec)
 * @param bitsPerSecond - Битрейт в бит/с
 * @returns Строка вида "5.2 Mbps" или "320 kbps"
 */
export function formatBitrate(bitsPerSecond: number): string {
  if (bitsPerSecond >= 1_000_000) {
    return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`
  }
  return `${Math.round(bitsPerSecond / 1000)} kbps`
}

/**
 * Форматирует битрейт (вход: kbps)
 * @param kbps - Битрейт в kbps
 * @returns Строка формата "2.5 Mbps" или "256 kbps"
 */
export function formatBitrateKbps(kbps: number | undefined): string {
  if (kbps === undefined || kbps < 0) {
    return '--'
  }

  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`
  }
  return `${kbps.toFixed(0)} kbps`
}

/**
 * Форматирует скорость транскодирования (множитель реального времени)
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
 * Форматирует скорость передачи данных (bytes/sec)
 * @param bytesPerSec - Скорость в байт/сек
 * @returns Строка формата "5.2 MB/s" или "0 B/s"
 */
export function formatTransferSpeed(bytesPerSec: number | undefined | null): string {
  if (bytesPerSec == null || Number.isNaN(bytesPerSec) || bytesPerSec < 1) return '0 B/s'
  const k = 1024
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.min(Math.floor(Math.log(bytesPerSec) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytesPerSec / k ** i).toFixed(1))} ${sizes[i]}`
}

// --- Прочее ---

/**
 * Форматирует FPS
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
 * Рассчитывает коэффициент сжатия
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

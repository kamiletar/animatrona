/**
 * Утилиты форматирования для отображения данных
 */

/**
 * Форматирует размер файла в читаемый вид
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
 * Форматирует длительность в читаемый вид
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
 * Форматирует битрейт в читаемый вид
 * @param bitsPerSecond - Битрейт в бит/с
 * @returns Строка вида "5.2 Mbps" или "320 kbps"
 */
export function formatBitrate(bitsPerSecond: number): string {
  if (bitsPerSecond >= 1_000_000) {
    return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`
  }
  return `${Math.round(bitsPerSecond / 1000)} kbps`
}

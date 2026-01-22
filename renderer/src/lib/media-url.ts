/**
 * Утилиты для работы с media:// протоколом
 *
 * Electron блокирует file:// URLs в renderer для безопасности.
 * Используем кастомный протокол media:// для доступа к локальным файлам.
 */

/**
 * Конвертирует локальный путь или file:// URL в media:// URL
 *
 * @example
 * toMediaUrl('C:/Users/test/poster.webp') → 'media://C:/Users/test/poster.webp'
 * toMediaUrl('file:///C:/Users/test/poster.webp') → 'media://C:/Users/test/poster.webp'
 * toMediaUrl(null) → null
 */
export function toMediaUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null
  }

  // Уже media:// URL
  if (path.startsWith('media://')) {
    return path
  }

  // Конвертируем file:// URL в путь
  if (path.startsWith('file:///')) {
    path = path.slice(8) // Убираем 'file:///'
  } else if (path.startsWith('file://')) {
    path = path.slice(7) // Убираем 'file://'
  }

  // Создаём media:// URL
  return `media://${path}`
}

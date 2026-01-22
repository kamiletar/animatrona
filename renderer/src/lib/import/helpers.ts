/**
 * Вспомогательные функции для импорта
 * Чистые функции без зависимостей от React
 */

import type { AgeRating, AnimeSource, AnimeStatus, ChapterType, SeasonType } from '@/generated/prisma'

/**
 * Ограничитель параллельных операций (простая реализация p-limit)
 *
 * @example
 * const limit = createConcurrencyLimiter(4)
 * await Promise.all(tasks.map(task => limit(() => task())))
 */
export function createConcurrencyLimiter(concurrency: number) {
  const queue: Array<() => void> = []
  let activeCount = 0

  const next = () => {
    if (queue.length > 0 && activeCount < concurrency) {
      activeCount++
      const fn = queue.shift()
      if (fn) {
        fn()
      }
    }
  }

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          activeCount--
          next()
        }
      }

      queue.push(run)
      next()
    })
  }
}

/**
 * Формирует полный URL постера Shikimori
 *
 * @param mainUrl - URL постера (может быть относительным или полным)
 * @returns Полный URL или null
 */
export function getPosterUrl(mainUrl: string | undefined | null): string | null {
  if (!mainUrl) {
    return null
  }
  // Если URL уже полный — возвращаем как есть
  if (mainUrl.startsWith('http://') || mainUrl.startsWith('https://')) {
    return mainUrl
  }
  // Иначе добавляем домен
  return `https://shikimori.one${mainUrl}`
}

/**
 * Проверяет, нужно ли транскодировать аудиодорожку
 *
 * Логика:
 * - MP3 любой битрейт → НЕ перекодировать (lossy-to-lossy ухудшит качество)
 * - AAC ≤ 256 kbps → НЕ перекодировать (уже оптимальный)
 * - AAC > 256 kbps → перекодировать (слишком большой)
 * - FLAC, Opus, WAV/PCM и др. → перекодировать в AAC
 *
 * @param codec - кодек аудио (aac, opus, flac, mp3, etc.)
 * @param bitrate - битрейт в bps (не kbps!)
 * @returns true если нужно транскодировать
 */
export function needsAudioTranscode(codec: string, bitrate: number | null | undefined): boolean {
  const lowerCodec = codec.toLowerCase()

  // MP3 — никогда не перекодировать (lossy-to-lossy только ухудшит качество)
  if (lowerCodec === 'mp3') {
    return false
  }

  // AAC с битрейтом ≤ 256 kbps (256000 bps) — не нужно транскодировать
  if (lowerCodec === 'aac' && bitrate && bitrate > 0 && bitrate <= 256000) {
    return false
  }

  // Все остальные кодеки (FLAC, Opus, WAV/PCM) или AAC с высоким битрейтом — транскодировать
  return true
}

/**
 * Форматирует количество каналов в строку
 *
 * @example
 * formatChannels(2) // "2.0"
 * formatChannels(6) // "5.1"
 * formatChannels(8) // "7.1"
 */
export function formatChannels(channels: number): string {
  switch (channels) {
    case 1:
      return '1.0'
    case 2:
      return '2.0'
    case 6:
      return '5.1'
    case 8:
      return '7.1'
    default:
      return `${channels}.0`
  }
}

/**
 * Преобразует статус Shikimori в статус БД
 */
export function mapShikimoriStatus(status: string): AnimeStatus {
  switch (status) {
    case 'ongoing':
      return 'ONGOING'
    case 'released':
      return 'COMPLETED'
    case 'anons':
      return 'ANNOUNCED'
    default:
      return 'ONGOING'
  }
}

/**
 * Преобразует тип аниме Shikimori в тип сезона
 */
export function mapSeasonType(kind: string | null): SeasonType {
  if (!kind) {
    return 'TV'
  }
  switch (kind) {
    case 'tv':
      return 'TV'
    case 'ova':
      return 'OVA'
    case 'ona':
      return 'ONA'
    case 'movie':
      return 'MOVIE'
    case 'special':
      return 'SPECIAL'
    default:
      return 'TV'
  }
}

/**
 * Определяет тип главы по названию
 *
 * @param title - название главы из метаданных видео
 * @returns тип главы
 */
export function detectChapterType(title: string | null): ChapterType {
  if (!title) {
    return 'CHAPTER'
  }
  const lowerTitle = title.toLowerCase()

  if (lowerTitle.includes('open') || lowerTitle.includes('op')) {
    return 'OP'
  }
  if (lowerTitle.includes('end') || lowerTitle.includes('ed')) {
    return 'ED'
  }
  if (lowerTitle.includes('recap') || lowerTitle.includes('previous')) {
    return 'RECAP'
  }
  if (lowerTitle.includes('preview') || lowerTitle.includes('next')) {
    return 'PREVIEW'
  }

  return 'CHAPTER'
}

/**
 * Определяет, можно ли пропустить главу (OP/ED/RECAP/PREVIEW)
 */
export function isChapterSkippable(title: string | null): boolean {
  const type = detectChapterType(title)
  return type === 'OP' || type === 'ED' || type === 'RECAP' || type === 'PREVIEW'
}

/**
 * Преобразует Shikimori rating в enum AgeRating
 *
 * Shikimori использует строки: g, pg, pg_13, r, r_plus, rx
 * Наш enum: G, PG, PG_13, R_17, R_PLUS, RX
 */
export function mapShikimoriAgeRating(rating: string | null | undefined): AgeRating | null {
  if (!rating) {
    return null
  }
  const normalized = rating.toLowerCase()
  switch (normalized) {
    case 'g':
      return 'G'
    case 'pg':
      return 'PG'
    case 'pg_13':
      return 'PG_13'
    case 'r':
    case 'r_17':
      return 'R_17'
    case 'r+':
    case 'r_plus':
      return 'R_PLUS'
    case 'rx':
      return 'RX'
    default:
      return null
  }
}

/**
 * Преобразует Shikimori source в enum AnimeSource
 *
 * Shikimori может возвращать разные значения для источника
 */
export function mapShikimoriSource(source: string | null | undefined): AnimeSource | null {
  if (!source) {
    return null
  }
  const normalized = source.toLowerCase()
  switch (normalized) {
    case 'manga':
      return 'MANGA'
    case 'light_novel':
    case 'novel':
      return 'LIGHT_NOVEL'
    case 'original':
      return 'ORIGINAL'
    case 'visual_novel':
      return 'VISUAL_NOVEL'
    case 'game':
      return 'GAME'
    case 'web_manga':
      return 'WEB_MANGA'
    case 'other':
    default:
      return 'OTHER'
  }
}

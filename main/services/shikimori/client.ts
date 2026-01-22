/**
 * GraphQL клиент для Shikimori API
 */

import * as fs from 'node:fs'
import * as https from 'node:https'
import * as path from 'node:path'

import { app, nativeImage } from 'electron'

import {
  GET_ANIME_DETAILS_QUERY,
  GET_ANIME_EXTENDED_QUERY,
  GET_ANIME_WITH_RELATED_QUERY,
  SEARCH_ANIME_QUERY,
} from './queries'
import type {
  PosterDownloadResult,
  ShikimoriAnimeDetails,
  ShikimoriAnimeExtended,
  ShikimoriAnimePreview,
  ShikimoriAnimeWithRelated,
  ShikimoriDetailsResponse,
  ShikimoriExtendedResponse,
  ShikimoriSearchOptions,
  ShikimoriSearchResponse,
  ShikimoriWithRelatedResponse,
} from './types'

const GRAPHQL_ENDPOINT = 'https://shikimori.one/api/graphql'
const USER_AGENT = 'Animatrona/1.0 (Desktop App)'

/** Заголовки по умолчанию */
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': USER_AGENT,
  Accept: 'application/json',
}

/** Минимальный интервал между запросами (мс) для избежания 429 */
const MIN_REQUEST_INTERVAL = 500
let lastRequestTime = 0

// === IN-MEMORY CACHE ===

/** TTL кэша в миллисекундах (5 минут) */
const CACHE_TTL_MS = 5 * 60 * 1000

/** Максимальное количество записей в кэше */
const CACHE_MAX_ENTRIES = 100

/** Структура записи кэша */
interface CacheEntry<T> {
  data: T
  expiresAt: number
}

/** In-memory кэш для API ответов */
const apiCache = new Map<string, CacheEntry<unknown>>()

/** Символ для обозначения "не найдено в кэше" */
const CACHE_MISS = Symbol('CACHE_MISS')

/**
 * Получить значение из кэша
 * Возвращает CACHE_MISS если не найдено или истёк TTL
 */
function getCached<T>(key: string): T | typeof CACHE_MISS {
  const entry = apiCache.get(key)
  if (!entry) {return CACHE_MISS}

  // Проверяем TTL
  if (Date.now() > entry.expiresAt) {
    apiCache.delete(key)
    return CACHE_MISS
  }

  return entry.data as T
}

/**
 * Сохранить значение в кэш
 */
function setCache<T>(key: string, data: T): void {
  // Очищаем старые записи если превышен лимит
  if (apiCache.size >= CACHE_MAX_ENTRIES) {
    const now = Date.now()
    // Удаляем просроченные
    for (const [k, v] of apiCache) {
      if (now > v.expiresAt) {
        apiCache.delete(k)
      }
    }
    // Если всё ещё много — удаляем первую половину (LRU-подобное)
    if (apiCache.size >= CACHE_MAX_ENTRIES) {
      const keysToDelete = Array.from(apiCache.keys()).slice(0, CACHE_MAX_ENTRIES / 2)
      for (const k of keysToDelete) {
        apiCache.delete(k)
      }
    }
  }

  apiCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

/**
 * Очистить весь кэш (для тестов или принудительного обновления)
 */
export function clearApiCache(): void {
  apiCache.clear()
}

/**
 * Ждёт необходимый интервал между запросами
 */
async function throttle(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed))
  }
  lastRequestTime = Date.now()
}

/**
 * Выполняет GraphQL запрос к Shikimori API
 */
async function executeQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  // Throttle запросы для избежания 429
  await throttle()

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(`Shikimori API error: ${response.status} ${response.statusText}`)
  }

  const json = (await response.json()) as { data?: T; errors?: { message: string }[] }

  if (json.errors && json.errors.length > 0) {
    throw new Error(`GraphQL errors: ${json.errors.map((e) => e.message).join(', ')}`)
  }

  if (!json.data) {
    throw new Error('No data in response')
  }

  return json.data
}

/**
 * Поиск аниме по названию
 */
export async function searchAnime(options: ShikimoriSearchOptions): Promise<ShikimoriAnimePreview[]> {
  const { search, limit = 10 } = options

  const data = await executeQuery<ShikimoriSearchResponse>(SEARCH_ANIME_QUERY, {
    search,
    limit,
  })

  return data.animes
}

/**
 * Получить детали аниме по Shikimori ID
 * Использует in-memory кэш для уменьшения запросов к API
 */
export async function getAnimeDetails(shikimoriId: number): Promise<ShikimoriAnimeDetails | null> {
  const cacheKey = `details:${shikimoriId}`

  // Проверяем кэш
  const cached = getCached<ShikimoriAnimeDetails | null>(cacheKey)
  if (cached !== CACHE_MISS) {
    return cached
  }

  const data = await executeQuery<ShikimoriDetailsResponse>(GET_ANIME_DETAILS_QUERY, {
    ids: String(shikimoriId),
  })

  const result = data.animes[0] ?? null

  // Сохраняем в кэш
  setCache(cacheKey, result)

  return result
}

/**
 * Получить аниме со связанными (related) по Shikimori ID
 * Использует in-memory кэш для уменьшения запросов к API
 */
export async function getAnimeWithRelated(shikimoriId: number): Promise<ShikimoriAnimeWithRelated | null> {
  const cacheKey = `related:${shikimoriId}`

  // Проверяем кэш
  const cached = getCached<ShikimoriAnimeWithRelated | null>(cacheKey)
  if (cached !== CACHE_MISS) {
    return cached
  }

  const data = await executeQuery<ShikimoriWithRelatedResponse>(GET_ANIME_WITH_RELATED_QUERY, {
    ids: String(shikimoriId),
  })

  const result = data.animes[0] ?? null

  // Сохраняем в кэш
  setCache(cacheKey, result)

  return result
}

/**
 * Получить расширенные метаданные аниме по Shikimori ID (v0.5.1)
 * Включает студии, стафф, персонажей, фандабберов, внешние ссылки
 * Использует in-memory кэш для уменьшения запросов к API
 */
export async function getAnimeExtended(shikimoriId: number): Promise<ShikimoriAnimeExtended | null> {
  const cacheKey = `extended:${shikimoriId}`

  // Проверяем кэш
  const cached = getCached<ShikimoriAnimeExtended | null>(cacheKey)
  if (cached !== CACHE_MISS) {
    return cached
  }

  const data = await executeQuery<ShikimoriExtendedResponse>(GET_ANIME_EXTENDED_QUERY, {
    ids: String(shikimoriId),
  })

  const result = data.animes[0] ?? null

  // Сохраняем в кэш
  setCache(cacheKey, result)

  return result
}

/**
 * Определить MIME-тип по расширению
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }
  return mimeTypes[ext.toLowerCase()] || 'image/jpeg'
}

/**
 * Скачать постер и сохранить локально
 * Также извлекает метаданные (размеры, blur placeholder)
 * Все операции асинхронные — не блокируют main thread
 *
 * @param posterUrl URL постера на Shikimori
 * @param animeId ID аниме (для имени файла)
 * @param options.fileName Кастомное имя файла
 * @param options.savePath Путь к папке для сохранения (если не передан — AppData/posters)
 */
export async function downloadPoster(
  posterUrl: string,
  animeId: string,
  options?: { fileName?: string; savePath?: string }
): Promise<PosterDownloadResult> {
  // Логируем входящий URL для отладки
  console.log('[downloadPoster] Input URL:', posterUrl)

  try {
    // Папка для постеров:
    // - savePath если передан (папка аниме в библиотеке)
    // - AppData/posters как fallback (для просмотра метаданных без импорта)
    const postersDir = options?.savePath || path.join(app.getPath('userData'), 'posters')

    // Создать папку если нет (асинхронно, recursive: true не бросает ошибку если существует)
    await fs.promises.mkdir(postersDir, { recursive: true })

    // Имя файла
    const ext = path.extname(new URL(posterUrl).pathname) || '.jpg'
    const finalFileName = options?.fileName || (options?.savePath ? `poster${ext}` : `${animeId}${ext}`)
    const localPath = path.join(postersDir, finalFileName)

    // Скачать файл
    await new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(localPath)

      https
        .get(posterUrl, (response) => {
          // Следуем редиректам
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location
            if (redirectUrl) {
              https
                .get(redirectUrl, (redirectResponse) => {
                  redirectResponse.pipe(file)
                  file.on('finish', () => {
                    file.close()
                    resolve()
                  })
                })
                .on('error', reject)
              return
            }
          }

          response.pipe(file)
          file.on('finish', () => {
            file.close()
            resolve()
          })
        })
        .on('error', async (err) => {
          // Удалить частичный файл асинхронно
          try {
            await fs.promises.unlink(localPath)
          } catch {
            /* игнорируем ошибку удаления */
          }
          reject(err)
        })
    })

    // Получить размер файла асинхронно
    const stats = await fs.promises.stat(localPath)
    const size = stats.size

    // Получить размеры изображения через nativeImage
    const image = nativeImage.createFromPath(localPath)
    const imageSize = image.getSize()
    const { width, height } = imageSize

    // Генерируем blur placeholder (10x10 пикселей в base64)
    let blurDataURL: string | undefined
    if (!image.isEmpty()) {
      const blurImage = image.resize({ width: 10, height: 10, quality: 'low' })
      const blurBuffer = blurImage.toJPEG(50) // Качество 50%
      blurDataURL = `data:image/jpeg;base64,${blurBuffer.toString('base64')}`
    }

    // Логируем результат для отладки
    console.log('[downloadPoster] Downloaded:', { localPath, width, height, size })

    return {
      success: true,
      localPath,
      filename: finalFileName,
      mimeType: getMimeType(ext),
      size,
      width,
      height,
      blurDataURL,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

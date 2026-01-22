'use server'

/**
 * Server Action для поиска аниме
 *
 * Использует FTS5 (Full-Text Search 5) для быстрого полнотекстового поиска.
 * При отсутствии FTS5 индекса fallback на обычный LIKE поиск.
 *
 * Русский стемминг: "головоломки" → "головоломк*" находит "головоломка"
 * Стеммированный запрос с prefix matching работает благодаря тому,
 * что stem обычно является префиксом исходного слова.
 */

import { prisma } from '@/lib/db'
import { stemSearchQuery, hasCyrillic } from '@/lib/stemmer'

/** Результат поиска для Quick Search */
export interface SearchResult {
  id: string
  name: string
  originalName: string | null
  posterPath: string | null
  year: number | null
}

/**
 * FTS5 поиск аниме
 * Возвращает до 8 результатов с ранжированием BM25
 *
 * @param query - Поисковый запрос (минимум 2 символа)
 */
export async function quickSearchAnime(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) {
    return []
  }

  // Экранируем спецсимволы FTS5 и подготавливаем запрос
  const escapedQuery = query
    .replace(/[*"(){}[\]^~\\]/g, '') // Убираем спецсимволы FTS5
    .trim()

  if (!escapedQuery) {
    return []
  }

  try {
    // FTS5 запрос с prefix matching (для автокомплита)
    // bm25() возвращает отрицательные значения, меньше = лучше
    // unicode61 токенизатор индексирует в lowercase, запрос тоже нужно преобразовать
    //
    // Для кириллицы применяем русский стемминг:
    // "головоломки" → "головоломк*" — найдёт "головоломка", "головоломки" и т.д.
    const ftsQuery = hasCyrillic(escapedQuery)
      ? stemSearchQuery(escapedQuery)
      : `${escapedQuery.toLowerCase()}*`

    const results = await prisma.$queryRaw<
      Array<{
        id: string
        name: string
        originalName: string | null
        year: number | null
        posterPath: string | null
      }>
    >`
      SELECT
        a.id,
        a.name,
        a.originalName,
        a.year,
        f.path as posterPath
      FROM anime_fts
      JOIN Anime a ON a.id = anime_fts.id
      LEFT JOIN File f ON f.id = a.posterId
      WHERE anime_fts MATCH ${ftsQuery}
      ORDER BY bm25(anime_fts)
      LIMIT 8
    `

    return results
  } catch {
    // Fallback на обычный LIKE поиск (FTS5 ещё не создан или ошибка)
    console.warn('[Search] FTS5 недоступен, используем LIKE fallback')
    return searchAnimeWithLike(escapedQuery)
  }
}

/**
 * Fallback поиск через LIKE (медленнее, но работает без FTS5)
 * SQLite не поддерживает mode: 'insensitive', используем LOWER() + COLLATE NOCASE
 */
async function searchAnimeWithLike(query: string): Promise<SearchResult[]> {
  // Raw SQL для регистронезависимого поиска в SQLite
  const lowerQuery = `%${query.toLowerCase()}%`

  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT
      a.id,
      a.name,
      a.originalName,
      a.year,
      f.path as posterPath
    FROM Anime a
    LEFT JOIN File f ON f.id = a.posterId
    WHERE LOWER(a.name) LIKE ${lowerQuery}
       OR LOWER(a.originalName) LIKE ${lowerQuery}
    ORDER BY a.name ASC
    LIMIT 8
  `

  return results
}

/**
 * @deprecated Используй quickSearchAnime вместо этой функции
 */
export async function searchAnimeForHeader(query: string): Promise<SearchResult[]> {
  return quickSearchAnime(query)
}

/**
 * FTS5 поиск для фильтров библиотеки
 * Возвращает только ID для использования в WHERE id IN (...)
 *
 * @param query - Поисковый запрос (минимум 2 символа)
 * @returns Массив ID аниме, соответствующих запросу
 */
export async function searchAnimeIds(query: string): Promise<string[]> {
  if (!query || query.length < 2) {
    return []
  }

  // Экранируем спецсимволы FTS5
  const escapedQuery = query.replace(/[*"(){}[\]^~\\]/g, '').trim()

  if (!escapedQuery) {
    return []
  }

  try {
    // FTS5 запрос с prefix matching
    // unicode61 токенизатор индексирует в lowercase
    // Для кириллицы применяем русский стемминг
    const ftsQuery = hasCyrillic(escapedQuery)
      ? stemSearchQuery(escapedQuery)
      : `${escapedQuery.toLowerCase()}*`

    const results = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM anime_fts WHERE anime_fts MATCH ${ftsQuery}
    `

    return results.map((r) => r.id)
  } catch {
    // Fallback на LIKE с mode: 'insensitive'
    console.warn('[Search] FTS5 недоступен для searchAnimeIds, используем LIKE fallback')

    // Raw SQL для регистронезависимого поиска в SQLite
    const lowerQuery = `%${query.toLowerCase()}%`

    const results = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM Anime
      WHERE LOWER(name) LIKE ${lowerQuery}
         OR LOWER(originalName) LIKE ${lowerQuery}
    `

    return results.map((r) => r.id)
  }
}

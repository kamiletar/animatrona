/**
 * REST API клиент для получения графа франшизы Shikimori
 * Используется вместо ненадёжного поля `franchise` из GraphQL
 *
 * API: GET https://shikimori.one/api/animes/{id}/franchise
 * Возвращает полный граф связей франшизы (nodes + links)
 */

import type { ShikimoriFranchiseGraph } from './types'

const REST_API_BASE = 'https://shikimori.one/api'
const USER_AGENT = 'Animatrona/1.0 (Desktop App)'

/** Минимальный интервал между запросами (мс) для избежания 429 */
const MIN_REQUEST_INTERVAL = 500
let lastRequestTime = 0

/** TTL кэша в миллисекундах (30 минут — граф меняется редко) */
const CACHE_TTL_MS = 30 * 60 * 1000

/** In-memory кэш для графов франшиз */
const franchiseCache = new Map<number, { data: ShikimoriFranchiseGraph; expiresAt: number }>()

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
 * Получить граф франшизы по ID аниме
 *
 * @param shikimoriId ID аниме на Shikimori
 * @returns Граф франшизы (nodes + links) или null если нет связей
 */
export async function getFranchiseGraph(shikimoriId: number): Promise<ShikimoriFranchiseGraph | null> {
  // Проверяем кэш
  const cached = franchiseCache.get(shikimoriId)
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[getFranchiseGraph] Cache hit for ${shikimoriId}`)
    return cached.data
  }

  // Throttle запросы
  await throttle()

  const url = `${REST_API_BASE}/animes/${shikimoriId}/franchise`
  console.log(`[getFranchiseGraph] Fetching: ${url}`)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      // 404 означает что аниме нет или нет франшизы
      if (response.status === 404) {
        console.log(`[getFranchiseGraph] No franchise for ${shikimoriId}`)
        return null
      }
      throw new Error(`Shikimori API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as ShikimoriFranchiseGraph

    // Проверяем что есть хотя бы узлы
    if (!data.nodes || data.nodes.length === 0) {
      console.log(`[getFranchiseGraph] Empty graph for ${shikimoriId}`)
      return null
    }

    console.log(
      `[getFranchiseGraph] Got graph for ${shikimoriId}: ${data.nodes.length} nodes, ${data.links.length} links`,
    )

    // Кэшируем результат
    franchiseCache.set(shikimoriId, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    // Также кэшируем для всех аниме в графе (они вернут тот же граф)
    for (const node of data.nodes) {
      if (node.id !== shikimoriId) {
        franchiseCache.set(node.id, {
          data,
          expiresAt: Date.now() + CACHE_TTL_MS,
        })
      }
    }

    return data
  } catch (error) {
    console.error(`[getFranchiseGraph] Error for ${shikimoriId}:`, error)
    throw error
  }
}

/**
 * Очистить кэш графов франшиз
 */
export function clearFranchiseCache(): void {
  franchiseCache.clear()
}

/**
 * Получить минимальный shikimoriId в графе (используется как стабильный ключ франшизы)
 */
export function getRootShikimoriId(graph: ShikimoriFranchiseGraph): number {
  return Math.min(...graph.nodes.map((n) => n.id))
}

/**
 * Получить название франшизы (берём название root аниме)
 */
export function getFranchiseName(graph: ShikimoriFranchiseGraph): string {
  const rootId = getRootShikimoriId(graph)
  const rootNode = graph.nodes.find((n) => n.id === rootId)
  return rootNode?.name || 'Unknown Franchise'
}

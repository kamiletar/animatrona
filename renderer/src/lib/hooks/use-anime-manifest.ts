'use client'

/**
 * Хук для загрузки AnimeManifest из IPFS
 *
 * v0.28.0: Расширенные метаданные (студии, персонал, видео и т.д.)
 * теперь хранятся в AnimeManifest (IPFS) вместо БД.
 *
 * Использование:
 * ```tsx
 * const { manifest, isLoading, error } = useAnimeManifest(anime.manifestCid)
 * ```
 */

import { useQuery } from '@tanstack/react-query'

import type { AnimeManifest } from '../../../../shared/types/anime-manifest'

interface UseAnimeManifestOptions {
  /** Включить загрузку (по умолчанию true) */
  enabled?: boolean
  /** Кэшировать на указанное время (ms), по умолчанию 5 минут */
  staleTime?: number
}

interface UseAnimeManifestResult {
  /** Загруженный манифест */
  manifest: AnimeManifest | null
  /** Загрузка в процессе */
  isLoading: boolean
  /** Ошибка загрузки */
  error: Error | null
  /** Перезагрузить манифест */
  refetch: () => void
}

/**
 * Загрузить AnimeManifest из IPFS по CID
 */
async function fetchManifest(manifestCid: string): Promise<AnimeManifest | null> {
  if (!window.electronAPI?.animeManifest) {
    console.warn('[useAnimeManifest] electronAPI.animeManifest недоступен')
    return null
  }

  const result = await window.electronAPI.animeManifest.get(manifestCid)

  if (!result.success) {
    throw new Error(result.error || 'Не удалось загрузить манифест')
  }

  return result.data ?? null
}

/**
 * Хук для загрузки AnimeManifest из IPFS
 *
 * @param manifestCid - CID манифеста в IPFS (или null/undefined если нет)
 * @param options - Опции запроса
 * @returns Манифест, состояние загрузки и ошибка
 */
export function useAnimeManifest(
  manifestCid: string | null | undefined,
  options: UseAnimeManifestOptions = {},
): UseAnimeManifestResult {
  const { enabled = true, staleTime = 5 * 60 * 1000 } = options

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['animeManifest', manifestCid],
    queryFn: () => fetchManifest(manifestCid!),
    enabled: enabled && !!manifestCid,
    staleTime,
    // Не ретраить при ошибке — манифест может быть недоступен оффлайн
    retry: false,
  })

  return {
    manifest: data ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  }
}

'use client'

/**
 * Хук для навигации между эпизодами
 */

import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'

import { updateAnimeWatchStatus } from '@/app/_actions/watch-progress.action'
import type { VideoPlayerRef } from '@/components/player'
import { useFindManyEpisode } from '@/lib/hooks'

import type { EpisodeNavInfo, EpisodeWithTracks } from './types'

/**
 * Извлекает путь к библиотеке из пути к папке аниме
 * Library/AnimeFolder → Library
 */
function extractLibraryPath(animeFolderPath: string): string {
  // Нормализуем слэши и убираем trailing slash
  const normalized = animeFolderPath.replace(/\\/g, '/').replace(/\/$/, '')
  const lastSlash = normalized.lastIndexOf('/')
  return lastSlash > 0 ? normalized.substring(0, lastSlash) : normalized
}

/**
 * Обновляет статус просмотра в _user/ для backup/restore системы
 */
async function updateUserWatchStatus(anime: EpisodeWithTracks['anime'], newStatus: string): Promise<void> {
  if (!anime.folderPath || !window.electronAPI?.userData) {
    return
  }

  try {
    const libraryPath = extractLibraryPath(anime.folderPath)
    await window.electronAPI.userData.updateWatchStatus(
      libraryPath,
      anime.folderPath,
      newStatus as 'NOT_STARTED' | 'WATCHING' | 'COMPLETED' | 'ON_HOLD' | 'DROPPED' | 'PLANNED',
      newStatus === 'COMPLETED' ? new Date().toISOString() : undefined,
    )
  } catch (err) {
    console.warn('[updateUserWatchStatus] Failed to update user data:', err)
  }
}

interface UseEpisodeNavigationOptions {
  /** Ref на плеер */
  playerRef: React.RefObject<VideoPlayerRef | null>
  /** Данные эпизода */
  episode: EpisodeWithTracks | null | undefined
  /** Функция сохранения прогресса */
  saveProgress: (currentTime: number, completed?: boolean) => void
  /** Callback для показа экрана завершения (вместо автоперехода) */
  onShowCompletion?: () => void
}

/**
 * Хук для навигации между эпизодами
 */
export function useEpisodeNavigation(options: UseEpisodeNavigationOptions) {
  const { playerRef, episode, saveProgress, onShowCompletion } = options
  const router = useRouter()

  // Загружаем все эпизоды аниме для навигации
  const { data: allEpisodes } = useFindManyEpisode(
    episode?.animeId
      ? {
        where: { animeId: episode.animeId },
        orderBy: { number: 'asc' },
        select: { id: true, number: true, name: true, thumbnailPaths: true },
      }
      : undefined,
  )

  // Находим предыдущий и следующий эпизоды
  const { prevEpisode, nextEpisode } = useMemo(() => {
    if (!allEpisodes || !episode) {
      return { prevEpisode: null, nextEpisode: null }
    }
    const currentIndex = allEpisodes.findIndex((ep) => ep.id === episode.id)
    return {
      prevEpisode: currentIndex > 0 ? (allEpisodes[currentIndex - 1] as EpisodeNavInfo) : null,
      nextEpisode: currentIndex < allEpisodes.length - 1 ? (allEpisodes[currentIndex + 1] as EpisodeNavInfo) : null,
    }
  }, [allEpisodes, episode])

  // Навигация к предыдущему эпизоду
  const goToPrevEpisode = useCallback(() => {
    if (prevEpisode) {
      router.push(`/watch/${prevEpisode.id}`)
    }
  }, [prevEpisode, router])

  // Навигация к следующему эпизоду
  const goToNextEpisode = useCallback(() => {
    if (nextEpisode) {
      router.push(`/watch/${nextEpisode.id}`)
    }
  }, [nextEpisode, router])

  // Обработчик окончания видео
  const handleEnded = useCallback(() => {
    if (playerRef.current) {
      saveProgress(playerRef.current.getDuration(), true)
    }

    // Автопереход на следующий эпизод
    if (nextEpisode) {
      router.push(`/watch/${nextEpisode.id}`)
    } else if (episode?.animeId) {
      // Это последний эпизод — устанавливаем статус COMPLETED
      updateAnimeWatchStatus(episode.animeId, 'COMPLETED')
        .then(() => updateUserWatchStatus(episode.anime, 'COMPLETED'))
        .catch((err) => console.error('[WatchPage] Ошибка установки статуса COMPLETED:', err))

      // Показываем экран завершения с рекомендацией сиквела
      if (onShowCompletion) {
        onShowCompletion()
      }
    }
  }, [saveProgress, nextEpisode, router, episode, playerRef, onShowCompletion])

  // Tooltip для предыдущего эпизода
  const prevEpisodeTooltip = useMemo(() => {
    return prevEpisode
      ? `Эпизод ${prevEpisode.number}${prevEpisode.name ? `: ${prevEpisode.name}` : ''}`
      : 'Это первый эпизод'
  }, [prevEpisode])

  // Tooltip для следующего эпизода
  const nextEpisodeTooltip = useMemo(() => {
    return nextEpisode
      ? `Эпизод ${nextEpisode.number}${nextEpisode.name ? `: ${nextEpisode.name}` : ''}`
      : 'Это последний эпизод'
  }, [nextEpisode])

  return {
    // Данные
    allEpisodes: allEpisodes as EpisodeNavInfo[] | undefined,
    prevEpisode,
    nextEpisode,
    hasPrevEpisode: !!prevEpisode,
    hasNextEpisode: !!nextEpisode,
    isLastEpisode: !nextEpisode && !!episode,
    prevEpisodeTooltip,
    nextEpisodeTooltip,

    // Обработчики
    goToPrevEpisode,
    goToNextEpisode,
    handleEnded,
  }
}

export type UseEpisodeNavigationReturn = ReturnType<typeof useEpisodeNavigation>

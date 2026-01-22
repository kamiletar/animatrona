'use client'

/**
 * Хук для редактора глав
 */

import { useCallback, useMemo, useState } from 'react'

import type { Chapter, VideoPlayerRef } from '@/components/player'
import { dbChapterToPlayerChapter, playerChapterToDbChapter } from '@/components/player/chapter-utils'
import { useCopyChaptersToEpisodes, useCreateChapter, useDeleteChapter, useUpdateChapter } from '@/lib/hooks'

import type { EpisodeWithTracks } from './types'

interface UseChapterEditorOptions {
  /** Ref на плеер */
  playerRef: React.RefObject<VideoPlayerRef | null>
  /** Данные эпизода */
  episode: EpisodeWithTracks | null | undefined
}

/**
 * Хук для редактора глав
 */
export function useChapterEditor(options: UseChapterEditorOptions) {
  const { playerRef, episode } = options

  // Состояние редактора глав
  const [isChapterEditorOpen, setIsChapterEditorOpen] = useState(false)
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)

  // Мутации для глав
  const { mutate: createChapter } = useCreateChapter()
  const { mutate: updateChapter } = useUpdateChapter()
  const { mutate: deleteChapter } = useDeleteChapter()
  const { mutate: copyChapters, isPending: isCopying } = useCopyChaptersToEpisodes()

  // Конвертируем главы из БД формата в формат плеера
  const playerChapters = useMemo((): Chapter[] => {
    if (!episode?.chapters) {
      return []
    }
    return episode.chapters.map(dbChapterToPlayerChapter)
  }, [episode?.chapters])

  // Seek для ChapterEditor и ChapterMarkers
  const handleSeek = useCallback((time: number) => {
    playerRef.current?.seek(time)
  }, [playerRef])

  // Обновление времени воспроизведения (вызывается из handleTimeUpdate)
  const updatePlaybackTime = useCallback((time: number, duration: number) => {
    setCurrentPlaybackTime(time)
    setVideoDuration(duration)
  }, [])

  // Обработчик изменения глав из редактора
  const handleChaptersChange = useCallback(
    (newChapters: Chapter[]) => {
      if (!episode) {
        return
      }

      const existingIds = new Set(episode.chapters.map((c) => c.id))
      const newIds = new Set(newChapters.map((c) => c.id))

      // Найти удалённые главы
      for (const oldChapter of episode.chapters) {
        if (!newIds.has(oldChapter.id)) {
          deleteChapter({ where: { id: oldChapter.id } })
        }
      }

      // Создать или обновить главы
      for (const chapter of newChapters) {
        if (existingIds.has(chapter.id)) {
          // Обновить существующую
          const dbData = playerChapterToDbChapter(chapter, episode.id)
          updateChapter({
            where: { id: chapter.id },
            data: {
              title: dbData.title,
              startMs: dbData.startMs,
              endMs: dbData.endMs,
              type: dbData.type,
              skippable: dbData.skippable,
            },
          })
        } else {
          // Создать новую
          const dbData = playerChapterToDbChapter(chapter, episode.id)
          createChapter({ data: dbData })
        }
      }
    },
    [episode, createChapter, updateChapter, deleteChapter]
  )

  // Копировать OP/ED на другие эпизоды
  const handleCopyToEpisodes = useCallback(
    (targetEpisodeIds: string[]) => {
      if (!episode?.id) {
        return
      }
      copyChapters({
        sourceEpisodeId: episode.id,
        targetEpisodeIds,
        chapterTypes: ['OP', 'ED'],
      })
    },
    [episode?.id, copyChapters]
  )

  // Toggle редактора глав
  const toggleChapterEditor = useCallback(() => {
    setIsChapterEditorOpen((prev) => !prev)
  }, [])

  // Закрыть редактор глав
  const closeChapterEditor = useCallback(() => {
    setIsChapterEditorOpen(false)
  }, [])

  return {
    // Состояние
    isChapterEditorOpen,
    currentPlaybackTime,
    videoDuration,
    playerChapters,
    isCopying,

    // Обработчики
    handleSeek,
    handleChaptersChange,
    handleCopyToEpisodes,
    toggleChapterEditor,
    closeChapterEditor,
    updatePlaybackTime,
  }
}

export type UseChapterEditorReturn = ReturnType<typeof useChapterEditor>

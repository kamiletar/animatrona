'use client'

/**
 * Создание глав (chapters) для эпизодов
 */

import type { Chapter, DemuxResult } from '../../../../shared/types'
import { detectChapterType, isChapterSkippable } from './helpers'
import type { ImportMutations } from './use-import-mutations'

/**
 * Создаёт главы из результата demux
 *
 * @param episodeId - ID эпизода
 * @param demuxResult - Результат demux с метаданными
 * @param mutations - Мутации для создания глав
 * @returns true если главы были найдены в файле и созданы, false если глав в файле нет
 */
export async function createChapters(
  episodeId: string,
  demuxResult: DemuxResult,
  mutations: ImportMutations
): Promise<boolean> {
  if (!demuxResult.metadata?.chapters || demuxResult.metadata.chapters.length === 0) {
    return false
  }

  console.warn(`[ChapterCreator] Creating ${demuxResult.metadata.chapters.length} chapters`)

  await Promise.all(
    demuxResult.metadata.chapters.map((chapter: Chapter) =>
      mutations.createChapter.mutateAsync({
        data: {
          episodeId,
          startMs: Math.round(chapter.start * 1000),
          endMs: Math.round(chapter.end * 1000),
          title: chapter.title || undefined,
          type: detectChapterType(chapter.title),
          skippable: isChapterSkippable(chapter.title),
        },
      })
    )
  )

  console.warn(`[ChapterCreator] Chapters created successfully`)
  return true
}

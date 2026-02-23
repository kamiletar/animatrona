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

  // Проверяем, есть ли среди глав значимые типы (OP/ED/RECAP/PREVIEW)
  // Если все главы — дженерик (CHAPTER), возвращаем false чтобы запустить fingerprinting
  let hasSkippableChapter = false

  await Promise.all(
    demuxResult.metadata.chapters.map((chapter: Chapter) => {
      const type = detectChapterType(chapter.title)
      if (isChapterSkippable(chapter.title)) {
        hasSkippableChapter = true
      }
      return mutations.createChapter.mutateAsync({
        data: {
          episodeId,
          startMs: Math.round(chapter.start * 1000),
          endMs: Math.round(chapter.end * 1000),
          title: chapter.title || undefined,
          type,
          skippable: isChapterSkippable(chapter.title),
        },
      })
    })
  )

  console.warn(`[ChapterCreator] Chapters created successfully, hasSkippable=${hasSkippableChapter}`)
  // Только значимые главы (OP/ED/RECAP/PREVIEW) отменяют fingerprinting
  return hasSkippableChapter
}

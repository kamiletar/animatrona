/**
 * Утилиты для работы с главами
 * Конвертация между форматами плеера (секунды) и базы данных (миллисекунды)
 */

import type { Chapter } from './ChapterMarkers'
import type { Chapter as DbChapter, ChapterType } from '@/generated/prisma'

/** Типы глав, которые можно пропустить */
const SKIPPABLE_TYPES: Set<ChapterType> = new Set(['OP', 'ED', 'RECAP', 'PREVIEW'])

/**
 * Конвертирует главу из формата БД в формат плеера
 * БД хранит время в миллисекундах, плеер работает в секундах
 */
export function dbChapterToPlayerChapter(dbChapter: DbChapter): Chapter {
  return {
    id: dbChapter.id,
    title: dbChapter.title || dbChapter.type,
    startTime: dbChapter.startMs / 1000, // мс -> сек
    endTime: dbChapter.endMs / 1000, // мс -> сек
    type: dbChapter.type,
  }
}

/**
 * Конвертирует главу из формата плеера в формат БД (без id)
 * Плеер работает в секундах, БД хранит время в миллисекундах
 */
export function playerChapterToDbChapter(
  chapter: Chapter,
  episodeId: string
): Omit<DbChapter, 'id' | 'createdAt'> {
  const type: ChapterType = chapter.type || 'CHAPTER'
  return {
    episodeId,
    title: chapter.title,
    startMs: Math.round(chapter.startTime * 1000), // сек -> мс
    endMs: Math.round(chapter.endTime * 1000), // сек -> мс
    type,
    skippable: SKIPPABLE_TYPES.has(type),
  }
}

/**
 * Определяет, можно ли пропустить главу
 */
export function isSkippableChapter(type: ChapterType | undefined): boolean {
  return type !== undefined && SKIPPABLE_TYPES.has(type)
}

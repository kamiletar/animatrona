'use server'

/**
 * Server Actions для CRUD операций с Chapter
 * Главы (opening, ending и т.д.)
 */

import type { Chapter, ChapterType, Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/db'

// === READ ===

/**
 * Получить список глав
 */
export async function findManyChapters(args?: Prisma.ChapterFindManyArgs): Promise<Chapter[]> {
  return prisma.chapter.findMany(args)
}

/**
 * Получить главу по ID
 */
export async function findUniqueChapter(id: string, include?: Prisma.ChapterInclude): Promise<Chapter | null> {
  return prisma.chapter.findUnique({
    where: { id },
    include,
  })
}

/**
 * Получить главы эпизода
 */
export async function findChaptersByEpisodeId(episodeId: string): Promise<Chapter[]> {
  return prisma.chapter.findMany({
    where: { episodeId },
    orderBy: { startMs: 'asc' },
  })
}

// === CREATE ===

/**
 * Создать главу
 */
export async function createChapter(data: Prisma.ChapterUncheckedCreateInput): Promise<Chapter> {
  return prisma.chapter.create({ data })
}

/**
 * Создать несколько глав
 */
export async function createManyChapters(data: Prisma.ChapterCreateManyInput[]): Promise<{ count: number }> {
  return prisma.chapter.createMany({ data })
}

// === UPDATE ===

/**
 * Обновить главу
 */
export async function updateChapter(id: string, data: Prisma.ChapterUpdateInput): Promise<Chapter> {
  return prisma.chapter.update({
    where: { id },
    data,
  })
}

// === DELETE ===

/**
 * Удалить главу
 */
export async function deleteChapter(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.chapter.delete({ where: { id } })
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Удалить главы эпизода
 */
export async function deleteChaptersByEpisodeId(episodeId: string): Promise<{ count: number }> {
  return prisma.chapter.deleteMany({ where: { episodeId } })
}

// === COPY ===

/**
 * Копировать главы OP/ED на другие эпизоды
 * @param sourceEpisodeId - ID исходного эпизода
 * @param targetEpisodeIds - ID эпизодов для копирования
 * @param chapterTypes - Типы глав для копирования (OP, ED в терминах Prisma)
 * @returns Количество созданных глав
 */
export async function copyChaptersToEpisodes(
  sourceEpisodeId: string,
  targetEpisodeIds: string[],
  chapterTypes: ChapterType[] = ['OP', 'ED']
): Promise<{ count: number; skipped: number }> {
  // Получаем главы источника
  const sourceChapters = await prisma.chapter.findMany({
    where: {
      episodeId: sourceEpisodeId,
      type: { in: chapterTypes },
    },
  })

  if (sourceChapters.length === 0) {
    return { count: 0, skipped: 0 }
  }

  let count = 0
  let skipped = 0

  // Для каждого целевого эпизода
  for (const targetEpisodeId of targetEpisodeIds) {
    // Проверяем существующие главы этих типов
    const existingChapters = await prisma.chapter.findMany({
      where: {
        episodeId: targetEpisodeId,
        type: { in: chapterTypes as ChapterType[] },
      },
      select: { type: true },
    })

    const existingTypes = new Set(existingChapters.map((c) => c.type))

    // Копируем только те главы, которых ещё нет
    for (const chapter of sourceChapters) {
      if (existingTypes.has(chapter.type)) {
        skipped++
        continue
      }

      await prisma.chapter.create({
        data: {
          episodeId: targetEpisodeId,
          type: chapter.type,
          title: chapter.title,
          startMs: chapter.startMs,
          endMs: chapter.endMs,
        },
      })
      count++
    }
  }

  return { count, skipped }
}

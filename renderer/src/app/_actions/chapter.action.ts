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

// === GENERATE RECAP/PREVIEW ===

/**
 * Пакетная генерация RECAP и PREVIEW глав на основе OP/ED
 * Для каждого эпизода:
 * - RECAP: от 0 до OP.startMs (если есть OP и нет RECAP)
 * - PREVIEW: от ED.endMs до durationMs (если есть ED, нет PREVIEW и durationMs > 0)
 */
export async function generateRecapAndPreview(episodeIds: string[]): Promise<{ created: number; skipped: number }> {
  let created = 0
  let skipped = 0

  for (const episodeId of episodeIds) {
    // Получить главы и длительность эпизода
    const [chapters, episode] = await Promise.all([
      prisma.chapter.findMany({
        where: { episodeId },
        orderBy: { startMs: 'asc' },
      }),
      prisma.episode.findUnique({
        where: { id: episodeId },
        select: { durationMs: true },
      }),
    ])

    if (!chapters.length) {
      continue
    }

    const types = new Set(chapters.map((c) => c.type))

    // Найти первый OP этого эпизода
    const firstOp = chapters.find((c) => c.type === 'OP')
    // Найти последний ED этого эпизода
    const lastEd = [...chapters].reverse().find((c) => c.type === 'ED')

    // RECAP: от 0 до OP.startMs
    if (firstOp && !types.has('RECAP') && firstOp.startMs > 0) {
      await prisma.chapter.create({
        data: {
          episodeId,
          type: 'RECAP',
          title: 'Ретро',
          startMs: 0,
          endMs: firstOp.startMs,
        },
      })
      created++
    } else if (firstOp && types.has('RECAP')) {
      skipped++
    }

    // PREVIEW: от ED.endMs до durationMs
    const durationMs = episode?.durationMs ?? 0
    if (lastEd && !types.has('PREVIEW') && durationMs > 0 && lastEd.endMs < durationMs) {
      await prisma.chapter.create({
        data: {
          episodeId,
          type: 'PREVIEW',
          title: 'Превью',
          startMs: lastEd.endMs,
          endMs: durationMs,
        },
      })
      created++
    } else if (lastEd && types.has('PREVIEW')) {
      skipped++
    }
  }

  return { created, skipped }
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

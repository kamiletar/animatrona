'use server'

/**
 * Server Actions для CRUD операций с SubtitleTrack
 */

import { prisma } from '@/lib/db'
import type { SubtitleTrack, Prisma } from '@/generated/prisma'

// === READ ===

/**
 * Получить список субтитров
 */
export async function findManySubtitleTracks(
  args?: Prisma.SubtitleTrackFindManyArgs
): Promise<SubtitleTrack[]> {
  return prisma.subtitleTrack.findMany(args)
}

/**
 * Получить субтитры по ID
 */
export async function findUniqueSubtitleTrack(
  id: string,
  include?: Prisma.SubtitleTrackInclude
): Promise<SubtitleTrack | null> {
  return prisma.subtitleTrack.findUnique({
    where: { id },
    include,
  })
}

// === CREATE ===

/**
 * Создать субтитры
 */
export async function createSubtitleTrack(
  data: Prisma.SubtitleTrackUncheckedCreateInput
): Promise<SubtitleTrack> {
  return prisma.subtitleTrack.create({ data })
}

/**
 * Создать несколько субтитров
 */
export async function createManySubtitleTracks(
  data: Prisma.SubtitleTrackCreateManyInput[]
): Promise<{ count: number }> {
  return prisma.subtitleTrack.createMany({ data })
}

// === UPDATE ===

/**
 * Обновить субтитры
 */
export async function updateSubtitleTrack(
  id: string,
  data: Prisma.SubtitleTrackUpdateInput
): Promise<SubtitleTrack> {
  return prisma.subtitleTrack.update({
    where: { id },
    data,
  })
}

// === DELETE ===

/**
 * Удалить субтитры
 */
export async function deleteSubtitleTrack(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.subtitleTrack.delete({ where: { id } })
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Удалить субтитры эпизода
 */
export async function deleteSubtitleTracksByEpisodeId(
  episodeId: string
): Promise<{ count: number }> {
  return prisma.subtitleTrack.deleteMany({ where: { episodeId } })
}

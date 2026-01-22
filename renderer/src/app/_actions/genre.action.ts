'use server'

/**
 * Server Actions для CRUD операций с Genre
 */

import { prisma } from '@/lib/db'
import type { Genre, Prisma } from '@/generated/prisma'

// === READ ===

/**
 * Получить список жанров
 */
export async function findManyGenres(
  args?: Prisma.GenreFindManyArgs
): Promise<Genre[]> {
  return prisma.genre.findMany(args)
}

/**
 * Получить жанр по ID
 */
export async function findUniqueGenre(
  id: string,
  include?: Prisma.GenreInclude
): Promise<Genre | null> {
  return prisma.genre.findUnique({
    where: { id },
    include,
  })
}

// === CREATE ===

/**
 * Создать жанр
 */
export async function createGenre(
  data: Prisma.GenreCreateInput
): Promise<Genre> {
  return prisma.genre.create({ data })
}

// === UPDATE ===

/**
 * Обновить жанр
 */
export async function updateGenre(
  id: string,
  data: Prisma.GenreUpdateInput
): Promise<Genre> {
  return prisma.genre.update({
    where: { id },
    data,
  })
}

// === DELETE ===

/**
 * Удалить жанр
 */
export async function deleteGenre(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.genre.delete({ where: { id } })
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

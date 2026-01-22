'use server'

/**
 * Server Actions для CRUD операций с File
 * Файлы (постеры, шрифты и т.д.)
 */

import { prisma } from '@/lib/db'
import type { File, Prisma } from '@/generated/prisma'

// === READ ===

/**
 * Получить список файлов
 */
export async function findManyFiles(
  args?: Prisma.FileFindManyArgs
): Promise<File[]> {
  return prisma.file.findMany(args)
}

/**
 * Получить файл по ID
 */
export async function findUniqueFile(
  id: string,
  include?: Prisma.FileInclude
): Promise<File | null> {
  return prisma.file.findUnique({
    where: { id },
    include,
  })
}

// === CREATE ===

/**
 * Создать файл
 */
export async function createFile(
  data: Prisma.FileCreateInput
): Promise<File> {
  return prisma.file.create({ data })
}

/**
 * Создать несколько файлов
 */
export async function createManyFiles(
  data: Prisma.FileCreateManyInput[]
): Promise<{ count: number }> {
  return prisma.file.createMany({ data })
}

/**
 * Upsert файла по пути — создаёт новый или обновляет существующий
 */
export async function upsertFile(
  data: Prisma.FileCreateInput
): Promise<File> {
  return prisma.file.upsert({
    where: { path: data.path },
    create: data,
    update: {
      filename: data.filename,
      mimeType: data.mimeType,
      size: data.size,
      width: data.width,
      height: data.height,
      blurDataURL: data.blurDataURL,
      category: data.category,
      source: data.source,
    },
  })
}

// === UPDATE ===

/**
 * Обновить файл
 */
export async function updateFile(
  id: string,
  data: Prisma.FileUpdateInput
): Promise<File> {
  return prisma.file.update({
    where: { id },
    data,
  })
}

// === DELETE ===

/**
 * Удалить файл
 */
export async function deleteFile(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.file.delete({ where: { id } })
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

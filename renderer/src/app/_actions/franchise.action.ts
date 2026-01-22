'use server'

/**
 * Server Actions для CRUD операций с Franchise
 * Франшизы (серии связанных аниме)
 *
 * Новая логика: франшиза определяется через REST API /api/animes/{id}/franchise
 * Все аниме в одном графе = одна франшиза
 * rootShikimoriId = минимальный shikimoriId из графа (стабильный ключ)
 */

import type { Franchise, Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/db'
import type { ShikimoriFranchiseGraph } from '@/types/electron.d'

// === READ ===

/**
 * Получить список франшиз
 */
export async function findManyFranchises(args?: Prisma.FranchiseFindManyArgs): Promise<Franchise[]> {
  return prisma.franchise.findMany(args)
}

/**
 * Получить франшизу по ID
 */
export async function findUniqueFranchise(id: string, include?: Prisma.FranchiseInclude): Promise<Franchise | null> {
  return prisma.franchise.findUnique({
    where: { id },
    include,
  })
}

// === CREATE ===

/**
 * Создать франшизу
 */
export async function createFranchise(data: Prisma.FranchiseCreateInput): Promise<Franchise> {
  return prisma.franchise.create({ data })
}

/**
 * Создать или найти франшизу по shikimoriFranchiseId
 * Используется при синхронизации связей — если франшиза уже существует, возвращает её
 */
export async function upsertFranchiseByShikimoriId(
  shikimoriFranchiseId: string,
  data: { name: string },
): Promise<Franchise> {
  return prisma.franchise.upsert({
    where: { shikimoriFranchiseId },
    create: {
      name: data.name,
      shikimoriFranchiseId,
    },
    update: {
      // Не обновляем ничего — просто возвращаем существующую
    },
  })
}

// === UPDATE ===

/**
 * Обновить франшизу
 */
export async function updateFranchise(id: string, data: Prisma.FranchiseUpdateInput): Promise<Franchise> {
  return prisma.franchise.update({
    where: { id },
    data,
  })
}

// === DELETE ===

/**
 * Удалить франшизу
 */
export async function deleteFranchise(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.franchise.delete({ where: { id } })
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// === GRAPH SYNC ===

/**
 * Найти франшизу по rootShikimoriId (стабильный ключ)
 */
export async function findFranchiseByRootShikimoriId(
  rootShikimoriId: number,
  include?: Prisma.FranchiseInclude,
): Promise<Franchise | null> {
  return prisma.franchise.findUnique({
    where: { rootShikimoriId },
    include,
  })
}

/**
 * Синхронизировать франшизу из графа REST API
 *
 * Логика:
 * 1. rootShikimoriId = минимальный shikimoriId из графа (стабильный ключ)
 * 2. Upsert франшизу по rootShikimoriId
 * 3. Привязать все аниме из графа к этой франшизе
 *
 * @param graph - Граф франшизы из REST API
 * @param rootShikimoriId - Минимальный shikimoriId (уже вычислен в IPC)
 * @param franchiseName - Название франшизы (уже вычислено в IPC)
 */
export async function syncFranchiseFromGraph(
  graph: ShikimoriFranchiseGraph,
  rootShikimoriId: number,
  franchiseName: string,
): Promise<{ franchise: Franchise; updatedAnimeCount: number }> {
  // Upsert франшизу по rootShikimoriId
  const franchise = await prisma.franchise.upsert({
    where: { rootShikimoriId },
    create: {
      name: franchiseName,
      rootShikimoriId,
      graphJson: JSON.stringify(graph),
      graphUpdatedAt: new Date(),
    },
    update: {
      name: franchiseName,
      graphJson: JSON.stringify(graph),
      graphUpdatedAt: new Date(),
    },
  })

  // Привязать все аниме из графа к этой франшизе
  const shikimoriIds = graph.nodes.map((n) => n.id)
  const result = await prisma.anime.updateMany({
    where: { shikimoriId: { in: shikimoriIds } },
    data: { franchiseId: franchise.id },
  })

  return {
    franchise,
    updatedAnimeCount: result.count,
  }
}

/**
 * Обновить граф франшизы (без привязки аниме)
 * Используется для периодического обновления графа
 */
export async function updateFranchiseGraph(
  franchiseId: string,
  graph: ShikimoriFranchiseGraph,
  franchiseName?: string,
): Promise<Franchise> {
  return prisma.franchise.update({
    where: { id: franchiseId },
    data: {
      ...(franchiseName && { name: franchiseName }),
      graphJson: JSON.stringify(graph),
      graphUpdatedAt: new Date(),
    },
  })
}

/**
 * Получить франшизы которые нужно обновить (graphUpdatedAt старше недели)
 */
export async function findStaleGraphFranchises(limit = 10): Promise<Franchise[]> {
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  return prisma.franchise.findMany({
    where: {
      rootShikimoriId: { not: null },
      OR: [{ graphUpdatedAt: null }, { graphUpdatedAt: { lt: oneWeekAgo } }],
    },
    take: limit,
    orderBy: { graphUpdatedAt: 'asc' },
  })
}

/**
 * Получить граф франшизы из БД (распарсить JSON)
 */
export async function getFranchiseGraphFromDb(franchiseId: string): Promise<ShikimoriFranchiseGraph | null> {
  const franchise = await prisma.franchise.findUnique({
    where: { id: franchiseId },
    select: { graphJson: true },
  })

  if (!franchise?.graphJson) {return null}

  try {
    return JSON.parse(franchise.graphJson) as ShikimoriFranchiseGraph
  } catch {
    return null
  }
}

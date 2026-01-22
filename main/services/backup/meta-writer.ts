/**
 * Сервис записи метафайлов релиза
 *
 * Записывает ТОЛЬКО релизные данные в anime.meta.json
 * Пользовательские данные (progress, watchStatus) — в user-data-service.ts
 */

import * as fs from 'fs/promises'
import * as path from 'path'

import type { AnimeFallbackInfo, AnimeMeta } from '../../../shared/types/backup'
import { ANIME_META_FILE, ANIME_META_VERSION } from '../../../shared/types/backup'

// =============================================================================
// ANIME META — РЕЛИЗНЫЕ ДАННЫЕ
// =============================================================================

export interface WriteAnimeMetaParams {
  /** Путь к папке аниме */
  animeFolder: string

  /** Shikimori ID (null если не связано) */
  shikimoriId: number | null

  /** BDRemux флаг */
  isBdRemux: boolean

  /** Fallback информация */
  fallbackInfo: AnimeFallbackInfo
}

/**
 * Записывает anime.meta.json в папку аниме
 * Содержит ТОЛЬКО релизные данные (можно распространять через P2P)
 */
export async function writeAnimeMeta(params: WriteAnimeMetaParams): Promise<void> {
  const metaPath = path.join(params.animeFolder, ANIME_META_FILE)

  // Проверяем существует ли файл для сохранения createdAt
  let existingCreatedAt: string | null = null
  try {
    const existing = await fs.readFile(metaPath, 'utf-8')
    const parsed = JSON.parse(existing) as AnimeMeta
    existingCreatedAt = parsed.createdAt
  } catch {
    // Файл не существует — новый
  }

  const now = new Date().toISOString()

  const meta: AnimeMeta = {
    version: ANIME_META_VERSION,
    shikimoriId: params.shikimoriId,
    isBdRemux: params.isBdRemux,
    fallbackInfo: params.fallbackInfo,
    createdAt: existingCreatedAt ?? now,
  }

  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
}

/**
 * Обновляет только указанные поля в anime.meta.json
 */
export async function updateAnimeMeta(
  animeFolder: string,
  updates: Partial<Pick<AnimeMeta, 'shikimoriId' | 'isBdRemux' | 'fallbackInfo'>>
): Promise<void> {
  const metaPath = path.join(animeFolder, ANIME_META_FILE)

  // Читаем существующий файл
  let existing: AnimeMeta
  try {
    const content = await fs.readFile(metaPath, 'utf-8')
    existing = JSON.parse(content) as AnimeMeta
  } catch {
    // Файл не существует — нельзя обновить
    console.warn(`[meta-writer] anime.meta.json not found at ${animeFolder}, skipping update`)
    return
  }

  // Применяем обновления
  const updated: AnimeMeta = {
    ...existing,
    ...updates,
  }

  await fs.writeFile(metaPath, JSON.stringify(updated, null, 2), 'utf-8')
}

/**
 * Читает anime.meta.json
 */
export async function readAnimeMeta(animeFolder: string): Promise<AnimeMeta | null> {
  const metaPath = path.join(animeFolder, ANIME_META_FILE)

  try {
    const content = await fs.readFile(metaPath, 'utf-8')
    return JSON.parse(content) as AnimeMeta
  } catch {
    return null
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Проверяет существование anime.meta.json
 */
export async function hasAnimeMeta(animeFolder: string): Promise<boolean> {
  const metaPath = path.join(animeFolder, ANIME_META_FILE)
  try {
    await fs.access(metaPath)
    return true
  } catch {
    return false
  }
}

/**
 * Удаляет anime.meta.json (при удалении аниме из библиотеки)
 */
export async function deleteAnimeMeta(animeFolder: string): Promise<void> {
  const metaPath = path.join(animeFolder, ANIME_META_FILE)
  try {
    await fs.unlink(metaPath)
  } catch {
    // Файл не существует — ок
  }
}

/* eslint-disable no-console */
/**
 * IPC handlers для истории импортов
 *
 * Каналы:
 * - history:getAll — получить все записи
 * - history:get — получить записи с фильтром
 * - history:getById — получить запись по ID
 * - history:add — добавить запись
 * - history:delete — удалить запись
 * - history:clear — очистить историю
 * - history:getStats — получить статистику
 * - history:getRecent — получить последние N записей
 */

import { ipcMain } from 'electron'
import { z } from 'zod'

import type { ImportHistoryCreateData, ImportHistoryFilter } from '../../shared/types/import-history'
import {
  addHistoryEntry,
  clearHistory,
  deleteHistoryEntry,
  getAllHistory,
  getHistory,
  getHistoryById,
  getHistoryStats,
  getRecentHistory,
} from '../services/history-store'
import { createValidatedHandler, idSchema } from '../utils/ipc-validator'

/** Флаг для предотвращения повторной регистрации */
let isRegistered = false

// === Zod схемы ===

const historyFilterSchema: z.ZodType<ImportHistoryFilter> = z.object({
  status: z.enum(['completed', 'error', 'cancelled']).optional(),
  search: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().min(0).optional(),
})

const historyCreateSchema: z.ZodType<ImportHistoryCreateData> = z.object({
  queueItemId: z.string(),
  animeName: z.string(),
  animeNameRu: z.string().optional(),
  animeId: z.string().optional(),
  shikimoriId: z.number().optional(),
  posterUrl: z.string().optional(),
  episodesCount: z.number().int(),
  seasonNumber: z.number().int().optional(),
  status: z.enum(['completed', 'error', 'cancelled']),
  errorMessage: z.string().optional(),
  startedAt: z.string(),
  completedAt: z.string(),
  durationMs: z.number(),
  totalSizeBytes: z.number().optional(),
  vmafScore: z.number().optional(),
  cqValue: z.number().optional(),
  usedCpuFallback: z.boolean().optional(),
  templateId: z.string().optional(),
  profileId: z.string().optional(),
  sourceFolderPath: z.string().optional(),
})

/**
 * Регистрирует IPC handlers для истории импортов
 */
export function registerHistoryHandlers(): void {
  if (isRegistered) {
    console.warn('[History] Handlers already registered, skipping')
    return
  }

  // Получить все записи
  ipcMain.handle('history:getAll', async () => {
    try {
      const history = getAllHistory()
      return { success: true, data: history }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Получить записи с фильтром
  ipcMain.handle(
    'history:get',
    createValidatedHandler(historyFilterSchema.optional(), async (filter?: ImportHistoryFilter) => {
      return getHistory(filter)
    })
  )

  // Получить запись по ID
  ipcMain.handle(
    'history:getById',
    createValidatedHandler(idSchema, async (id: string) => {
      return getHistoryById(id)
    })
  )

  // Добавить запись
  ipcMain.handle(
    'history:add',
    createValidatedHandler(historyCreateSchema, async (data: ImportHistoryCreateData) => {
      return addHistoryEntry(data)
    })
  )

  // Удалить запись
  ipcMain.handle(
    'history:delete',
    createValidatedHandler(idSchema, async (id: string) => {
      return deleteHistoryEntry(id)
    })
  )

  // Очистить историю
  ipcMain.handle('history:clear', async () => {
    try {
      clearHistory()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Получить статистику
  ipcMain.handle('history:getStats', async () => {
    try {
      const stats = getHistoryStats()
      return { success: true, data: stats }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Получить последние N записей
  ipcMain.handle('history:getRecent', async (_event, limit?: number) => {
    try {
      const history = getRecentHistory(limit)
      return { success: true, data: history }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  isRegistered = true
  console.log('[History] IPC handlers registered')
}

/**
 * Отменяет регистрацию handlers
 */
export function unregisterHistoryHandlers(): void {
  if (!isRegistered) {
    return
  }

  ipcMain.removeHandler('history:getAll')
  ipcMain.removeHandler('history:get')
  ipcMain.removeHandler('history:getById')
  ipcMain.removeHandler('history:add')
  ipcMain.removeHandler('history:delete')
  ipcMain.removeHandler('history:clear')
  ipcMain.removeHandler('history:getStats')
  ipcMain.removeHandler('history:getRecent')

  isRegistered = false
}

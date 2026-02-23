/**
 * Stats Store — Персистентное хранилище статистики пользователя
 *
 * Хранит статистику в JSON файле в userData директории (main process).
 * Использует строки для BigInt совместимости с БД.
 * Поддерживает историю по дням (последние 30 дней).
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import type { DailyStats, UserStats } from '../../../shared/types/stats'
import { INITIAL_USER_STATS } from '../../../shared/types/stats'
import { createModuleLogger } from '../../utils/logger'

const log = createModuleLogger('StatsStore')

const STATS_FILE = 'user-stats.json'
const MAX_DAILY_HISTORY = 30 // Хранить 30 дней

// ============================================================================
// Helpers для работы с BigInt как string
// ============================================================================

/**
 * Сложить два BigInt в строковом формате
 */
function addBigIntStrings(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString()
}

/**
 * Получить путь к файлу статистики
 */
function getStatsPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, STATS_FILE)
}

/**
 * Получить текущую дату в формате YYYY-MM-DD
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Загрузить статистику из файла
 */
export function loadStats(): UserStats {
  try {
    const filePath = getStatsPath()
    if (!fs.existsSync(filePath)) {
      return { ...INITIAL_USER_STATS }
    }
    const data = fs.readFileSync(filePath, 'utf-8')
    const stats = JSON.parse(data) as UserStats

    // Миграция: добавляем недостающие поля и конвертируем number в string
    return {
      ...INITIAL_USER_STATS,
      ...stats,
      // Убедимся что BigInt поля — строки
      bytesUploaded: String(stats.bytesUploaded ?? '0'),
      bytesDownloaded: String(stats.bytesDownloaded ?? '0'),
      totalSeedingTimeMs: String(stats.totalSeedingTimeMs ?? '0'),
      currentSessionMs: String(stats.currentSessionMs ?? '0'),
    }
  } catch (error) {
    log.error('Ошибка загрузки статистики', { error })
    return { ...INITIAL_USER_STATS }
  }
}

/**
 * Сохранить статистику в файл
 */
export function saveStats(stats: UserStats): void {
  try {
    const filePath = getStatsPath()
    fs.writeFileSync(filePath, JSON.stringify(stats, null, 2), 'utf-8')
  } catch (error) {
    log.error('Ошибка сохранения статистики', { error })
    throw error
  }
}

/**
 * Получить или создать запись за сегодня
 */
function getOrCreateTodayStats(stats: UserStats): DailyStats {
  const today = getCurrentDate()
  let todayStats = stats.dailyStats.find((d) => d.date === today)

  if (!todayStats) {
    todayStats = {
      date: today,
      bytesUploaded: '0',
      bytesDownloaded: '0',
      seedingTimeMs: '0',
      peersHelped: 0,
    }
    stats.dailyStats.push(todayStats)

    // Ограничиваем историю
    if (stats.dailyStats.length > MAX_DAILY_HISTORY) {
      stats.dailyStats = stats.dailyStats.slice(-MAX_DAILY_HISTORY)
    }
  }

  return todayStats
}

/**
 * Добавить байты upload
 */
export function addBytesUploaded(bytes: number): UserStats {
  const stats = loadStats()
  const bytesStr = String(bytes)

  stats.bytesUploaded = addBigIntStrings(stats.bytesUploaded, bytesStr)
  stats.lastActiveAt = new Date().toISOString()

  // Обновляем дневную статистику
  const todayStats = getOrCreateTodayStats(stats)
  todayStats.bytesUploaded = addBigIntStrings(todayStats.bytesUploaded, bytesStr)

  // Если это первый upload — фиксируем дату
  if (!stats.firstSeedAt) {
    stats.firstSeedAt = new Date().toISOString()
  }

  saveStats(stats)
  return stats
}

/**
 * Добавить байты download
 */
export function addBytesDownloaded(bytes: number): UserStats {
  const stats = loadStats()
  const bytesStr = String(bytes)

  stats.bytesDownloaded = addBigIntStrings(stats.bytesDownloaded, bytesStr)
  stats.lastActiveAt = new Date().toISOString()

  // Обновляем дневную статистику
  const todayStats = getOrCreateTodayStats(stats)
  todayStats.bytesDownloaded = addBigIntStrings(todayStats.bytesDownloaded, bytesStr)

  saveStats(stats)
  return stats
}

/**
 * Добавить время раздачи
 */
export function addSeedingTime(ms: number): UserStats {
  const stats = loadStats()
  const msStr = String(ms)

  stats.totalSeedingTimeMs = addBigIntStrings(stats.totalSeedingTimeMs, msStr)
  stats.lastActiveAt = new Date().toISOString()

  // Обновляем дневную статистику
  const todayStats = getOrCreateTodayStats(stats)
  todayStats.seedingTimeMs = addBigIntStrings(todayStats.seedingTimeMs, msStr)

  saveStats(stats)
  return stats
}

/**
 * Добавить помощь пиру
 */
export function addPeerHelped(): UserStats {
  const stats = loadStats()

  stats.peersHelped += 1
  stats.lastActiveAt = new Date().toISOString()

  // Обновляем дневную статистику
  const todayStats = getOrCreateTodayStats(stats)
  todayStats.peersHelped += 1

  saveStats(stats)
  return stats
}

/**
 * Установить количество уникального контента
 */
export function setUniqueContentCount(count: number): UserStats {
  const stats = loadStats()

  stats.uniqueContentSeeded = count
  stats.lastActiveAt = new Date().toISOString()

  saveStats(stats)
  return stats
}

/**
 * Обновить время текущей сессии
 */
export function updateCurrentSession(ms: number): UserStats {
  const stats = loadStats()

  stats.currentSessionMs = String(ms)
  stats.lastActiveAt = new Date().toISOString()

  saveStats(stats)
  return stats
}

/**
 * Сбросить сессию (при старте/остановке ноды)
 */
export function resetCurrentSession(): UserStats {
  const stats = loadStats()
  stats.currentSessionMs = '0'
  saveStats(stats)
  return stats
}

/**
 * Получить статистику за период
 */
export function getDailyHistory(days = 30): DailyStats[] {
  const stats = loadStats()
  return stats.dailyStats.slice(-days)
}

/**
 * Полный сброс статистики (для тестов)
 */
export function resetStats(): UserStats {
  const stats = { ...INITIAL_USER_STATS }
  saveStats(stats)
  log.info('Статистика сброшена')
  return stats
}

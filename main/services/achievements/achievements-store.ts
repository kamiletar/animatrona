/**
 * Achievements Store — Персистентное хранилище достижений пользователя
 *
 * Хранит достижения в JSON файле в userData директории (main process).
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import { createModuleLogger } from '../../utils/logger'

import {
  type AchievementId,
  INITIAL_USER_ACHIEVEMENTS,
  type UserAchievement,
  type UserAchievements,
} from '../../../shared/types/achievements'

const ACHIEVEMENTS_FILE = 'user-achievements.json'
const log = createModuleLogger('AchievementsStore')

/**
 * Получить путь к файлу достижений
 */
function getAchievementsPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, ACHIEVEMENTS_FILE)
}

/**
 * Загрузить достижения из файла
 */
export function loadAchievements(): UserAchievements {
  try {
    const filePath = getAchievementsPath()
    if (!fs.existsSync(filePath)) {
      return { ...INITIAL_USER_ACHIEVEMENTS }
    }
    const data = fs.readFileSync(filePath, 'utf-8')
    const achievements = JSON.parse(data) as UserAchievements

    // Миграция: добавляем недостающие поля
    return {
      ...INITIAL_USER_ACHIEVEMENTS,
      ...achievements,
    }
  } catch (error) {
    log.error('Ошибка загрузки достижений', { error })
    return { ...INITIAL_USER_ACHIEVEMENTS }
  }
}

/**
 * Сохранить достижения в файл
 */
export function saveAchievements(achievements: UserAchievements): void {
  try {
    const filePath = getAchievementsPath()
    fs.writeFileSync(filePath, JSON.stringify(achievements, null, 2), 'utf-8')
  } catch (error) {
    log.error('Ошибка сохранения достижений', { error })
    throw error
  }
}

/**
 * Проверить, разблокировано ли достижение
 */
export function isAchievementUnlocked(id: AchievementId): boolean {
  const achievements = loadAchievements()
  return achievements.unlocked.some((a) => a.id === id)
}

/**
 * Разблокировать достижение
 */
export function unlockAchievement(id: AchievementId): UserAchievement {
  const achievements = loadAchievements()

  // Проверяем, не разблокировано ли уже
  if (achievements.unlocked.some((a) => a.id === id)) {
    throw new Error(`Achievement ${id} already unlocked`)
  }

  const achievement: UserAchievement = {
    id,
    unlockedAt: new Date().toISOString(),
    notified: false,
  }

  achievements.unlocked.push(achievement)
  saveAchievements(achievements)

  log.info('Разблокировано достижение', { id })
  return achievement
}

/**
 * Обновить прогресс достижения
 */
export function updateProgress(id: AchievementId, progress: number): void {
  const achievements = loadAchievements()

  // Ограничиваем 0-100
  const clampedProgress = Math.min(100, Math.max(0, progress))
  achievements.progress[id] = clampedProgress

  saveAchievements(achievements)
}

/**
 * Отметить достижение как показанное
 */
export function markAsNotified(id: AchievementId): void {
  const achievements = loadAchievements()
  const achievement = achievements.unlocked.find((a) => a.id === id)

  if (achievement) {
    achievement.notified = true
    saveAchievements(achievements)
  }
}

/**
 * Получить непоказанные достижения
 */
export function getUnnotifiedAchievements(): UserAchievement[] {
  const achievements = loadAchievements()
  return achievements.unlocked.filter((a) => !a.notified)
}

/**
 * Сбросить достижения (для тестов)
 */
export function resetAchievements(): UserAchievements {
  const achievements = { ...INITIAL_USER_ACHIEVEMENTS }
  saveAchievements(achievements)
  log.info('Достижения сброшены')
  return achievements
}

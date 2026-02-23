/**
 * IPC Handlers для интеграции с animatrona-tracker
 *
 * Каналы:
 * - tracker:getConfig — Получить конфигурацию
 * - tracker:updateConfig — Обновить конфигурацию
 * - tracker:testConnection — Проверить подключение
 * - tracker:publish — Опубликовать аниме на tracker
 */

import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import type { TrackerConfig, TrackerConnectionResult, TrackerPublishResult } from '../../shared/types/tracker'
import { getAnimeManifestFromIpfs } from '../services/anime-manifest-generator'
import { publishToTracker, testTrackerConnection } from '../services/tracker-client'
import { createHandler } from '../utils/ipc-handler-factory'
import { createModuleLogger } from '../utils/logger'

const log = createModuleLogger('TrackerHandlers')

// Путь к конфигурации
function getConfigPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'tracker-config.json')
}

// Дефолтная конфигурация
const DEFAULT_CONFIG: TrackerConfig = {
  baseUrl: 'https://animatrona-tracker.letar.best',
  apiKey: '',
  enabled: false,
}

/**
 * Загрузить конфигурацию tracker
 */
function loadTrackerConfig(): TrackerConfig {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) }
    }
  } catch (error) {
    log.error('Ошибка загрузки конфигурации tracker', { error })
  }
  return DEFAULT_CONFIG
}

/**
 * Сохранить конфигурацию tracker
 */
function saveTrackerConfig(config: TrackerConfig): void {
  try {
    const configPath = getConfigPath()
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  } catch (error) {
    log.error('Ошибка сохранения конфигурации tracker', { error })
  }
}

/**
 * Регистрация IPC handlers для tracker
 */
export function registerTrackerHandlers(): void {
  // Получить конфигурацию
  createHandler('tracker:getConfig', (): TrackerConfig => {
    return loadTrackerConfig()
  })

  // Обновить конфигурацию
  createHandler('tracker:updateConfig', (updates: Partial<TrackerConfig>): TrackerConfig => {
    const current = loadTrackerConfig()
    const updated = { ...current, ...updates }
    saveTrackerConfig(updated)
    log.info('Конфигурация tracker обновлена', { enabled: updated.enabled, hasApiKey: !!updated.apiKey })
    return updated
  })

  // Проверить подключение
  createHandler('tracker:testConnection', async (): Promise<TrackerConnectionResult> => {
    const config = loadTrackerConfig()

    if (!config.apiKey) {
      return { success: false, message: 'API ключ не настроен' }
    }

    return testTrackerConnection(config)
  })

  // Опубликовать аниме на tracker по manifestCid
  createHandler('tracker:publish', async (manifestCid: string): Promise<TrackerPublishResult> => {
    const config = loadTrackerConfig()

    if (!config.enabled) {
      return { success: false, error: 'Публикация отключена в настройках' }
    }

    if (!config.apiKey) {
      return { success: false, error: 'API ключ не настроен' }
    }

    // Загружаем манифест из IPFS
    const manifest = await getAnimeManifestFromIpfs(manifestCid)
    if (!manifest) {
      return { success: false, error: 'Не удалось загрузить манифест из IPFS' }
    }

    return publishToTracker(config, manifest, manifestCid)
  })
}

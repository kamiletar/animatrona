/**
 * TrackerClient — Клиент для публикации аниме на animatrona-tracker
 *
 * Отправляет AnimeManifest на tracker через REST API с аутентификацией по API Key.
 */

import type { AnimeManifest } from '../../shared/types/anime-manifest'
import { createModuleLogger } from '../utils/logger'

const log = createModuleLogger('TrackerClient')

/** Конфигурация подключения к tracker */
export interface TrackerConfig {
  /** URL трекера (например, https://animatrona-tracker.letar.best) */
  baseUrl: string
  /** API ключ для аутентификации */
  apiKey: string
}

/** Результат публикации на tracker */
export interface TrackerPublishResult {
  success: boolean
  /** ID аниме на tracker */
  animeId?: string
  /** Статус (PENDING / PUBLISHED) */
  status?: string
  /** Количество эпизодов */
  episodeCount?: number
  /** Сообщение об ошибке */
  error?: string
}

/** Результат проверки подключения */
export interface TrackerConnectionResult {
  success: boolean
  message: string
  trackerName?: string
}

/**
 * Публикует аниме на tracker
 *
 * @param config - Конфигурация подключения
 * @param manifest - AnimeManifest для публикации
 * @param manifestCid - CID манифеста в IPFS
 * @returns Результат публикации
 */
export async function publishToTracker(
  config: TrackerConfig,
  manifest: AnimeManifest,
  manifestCid: string
): Promise<TrackerPublishResult> {
  log.info('Публикация на tracker', {
    baseUrl: config.baseUrl,
    animeName: manifest.name,
    manifestCid,
    episodeCount: manifest.episodes.length,
  })

  try {
    // Формируем payload для API
    const payload = {
      manifestCid,
      title: manifest.name,
      titleOriginal: manifest.originalName,
      description: manifest.description,
      coverUrl: manifest.posterCid ? `ipfs://${manifest.posterCid}` : undefined,
      year: manifest.year,
      // Берём первую студию, если есть
      studio: manifest.studios?.[0]?.name,
      // Жанры — только названия
      genres: manifest.genres?.map((g) => g.nameRu || g.name) ?? [],
      // Эпизоды
      episodes: manifest.episodes.map((ep) => ({
        number: ep.number,
        title: ep.name,
        duration: ep.durationMs ? Math.round(ep.durationMs / 1000) : undefined,
        videoCid: ep.videoCid || ep.manifestCid,
      })),
    }

    const response = await fetch(`${config.baseUrl}/api/anime`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      const errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error)

      log.error('Ошибка публикации', {
        status: response.status,
        error: errorMessage,
      })

      return {
        success: false,
        error: `${response.status}: ${errorMessage}`,
      }
    }

    const result = await response.json()

    log.info('Успешная публикация', {
      animeId: result.anime?.id,
      status: result.anime?.status,
    })

    return {
      success: true,
      animeId: result.anime?.id,
      status: result.anime?.status,
      episodeCount: result.anime?.episodeCount,
    }
  } catch (error) {
    // TypeError: terminated — соединение прервано
    if (error instanceof TypeError && error.message === 'terminated') {
      log.warn('Соединение прервано при публикации')
      return {
        success: false,
        error: 'Соединение прервано',
      }
    }

    const message = error instanceof Error ? error.message : String(error)
    log.error('Ошибка сети при публикации', { error: message })

    return {
      success: false,
      error: `Ошибка сети: ${message}`,
    }
  }
}

/**
 * Проверяет подключение к tracker
 *
 * @param config - Конфигурация подключения
 * @returns Результат проверки
 */
export async function testTrackerConnection(config: TrackerConfig): Promise<TrackerConnectionResult> {
  log.info('Проверка подключения к tracker', { baseUrl: config.baseUrl })

  try {
    // Пробуем получить список аниме (публичный эндпоинт)
    const response = await fetch(`${config.baseUrl}/api/anime?limit=1`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    })

    if (response.status === 401) {
      await response.body?.cancel().catch(() => {
        /* игнорируем */
      })
      return {
        success: false,
        message: 'Неверный API ключ',
      }
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => {
        /* игнорируем */
      })
      return {
        success: false,
        message: `Ошибка сервера: ${response.status}`,
      }
    }

    return {
      success: true,
      message: 'Подключение успешно',
      trackerName: new URL(config.baseUrl).hostname,
    }
  } catch (error) {
    // TypeError: terminated — соединение прервано
    if (error instanceof TypeError && error.message === 'terminated') {
      return {
        success: false,
        message: 'Соединение прервано',
      }
    }

    const message = error instanceof Error ? error.message : String(error)
    log.error('Ошибка подключения к tracker', { error: message })

    return {
      success: false,
      message: `Не удалось подключиться: ${message}`,
    }
  }
}

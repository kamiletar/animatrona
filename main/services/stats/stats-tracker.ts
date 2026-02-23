/**
 * Stats Tracker — Трекер статистики IPFS
 *
 * Отслеживает события от Kubo ноды и обновляет статистику.
 * Эмитит события для других сервисов (reputation, achievements, bonus).
 */

import { EventEmitter } from 'events'

import type { StatsUpdatedEvent, UserStats } from '../../../shared/types/stats'
import { createModuleLogger } from '../../utils/logger'
import { getKuboService } from '../kubo'
import * as statsStore from './stats-store'

const log = createModuleLogger('StatsTracker')

/**
 * События трекера
 */
export interface StatsTrackerEvents {
  'stats:updated': (event: StatsUpdatedEvent) => void
  'stats:sessionStarted': () => void
  'stats:sessionEnded': () => void
}

/**
 * Интервал обновления времени сессии (1 минута)
 */
const SESSION_UPDATE_INTERVAL = 60 * 1000

/**
 * Интервал сохранения статистики (5 минут)
 */
const STATS_SAVE_INTERVAL = 5 * 60 * 1000

/**
 * Трекер статистики IPFS
 */
class StatsTracker extends EventEmitter {
  private static instance: StatsTracker | null = null

  /** Время начала текущей сессии */
  private sessionStartTime: number | null = null

  /** Интервал обновления сессии */
  private sessionInterval: NodeJS.Timeout | null = null

  /** Интервал периодического сохранения */
  private saveInterval: NodeJS.Timeout | null = null

  /** Флаг инициализации */
  private isInitialized = false

  /** Счётчик байт за текущий интервал */
  private pendingBytesUp = 0
  private pendingBytesDown = 0
  private pendingPeersHelped = 0

  private constructor() {
    super()
  }

  /**
   * Получить singleton экземпляр
   */
  static getInstance(): StatsTracker {
    if (!StatsTracker.instance) {
      StatsTracker.instance = new StatsTracker()
    }
    return StatsTracker.instance
  }

  /**
   * Инициализировать трекер
   */
  initialize(): void {
    if (this.isInitialized) {
      log.info('Уже инициализирован')
      return
    }

    log.info('Инициализация...')

    // Подписываемся на события Kubo
    this.subscribeToKuboEvents()

    // Запускаем периодическое сохранение
    this.startPeriodicSave()

    this.isInitialized = true
    log.info('Инициализация завершена')
  }

  /**
   * Остановить трекер
   */
  shutdown(): void {
    log.info('Остановка...')

    // Останавливаем интервалы
    if (this.sessionInterval) {
      clearInterval(this.sessionInterval)
      this.sessionInterval = null
    }

    if (this.saveInterval) {
      clearInterval(this.saveInterval)
      this.saveInterval = null
    }

    // Сохраняем накопленные данные
    this.flushPendingStats()

    // Завершаем сессию
    if (this.sessionStartTime) {
      this.endSession()
    }

    this.isInitialized = false
    log.info('Остановлен')
  }

  /**
   * Подписаться на события Kubo
   */
  private subscribeToKuboEvents(): void {
    const kuboService = getKuboService()

    // При изменении статуса ноды
    kuboService.on('status:changed', (status) => {
      if (status.isRunning && !this.sessionStartTime) {
        this.startSession()
      } else if (!status.isRunning && this.sessionStartTime) {
        this.endSession()
      }
    })

    // При подключении пира — это потенциальный пир, которому мы можем помочь
    kuboService.on('peer:connected', () => {
      // Не считаем подключение как помощь — это будет при передаче данных
    })
  }

  /**
   * Начать сессию раздачи
   */
  startSession(): void {
    if (this.sessionStartTime) {
      log.info('Сессия уже активна')
      return
    }

    this.sessionStartTime = Date.now()
    statsStore.resetCurrentSession()

    // Запускаем обновление времени сессии
    this.sessionInterval = setInterval(() => {
      if (this.sessionStartTime) {
        const elapsed = Date.now() - this.sessionStartTime
        statsStore.updateCurrentSession(elapsed)
      }
    }, SESSION_UPDATE_INTERVAL)

    this.emit('stats:sessionStarted')
    log.info('Сессия начата')
  }

  /**
   * Завершить сессию раздачи
   */
  endSession(): void {
    if (!this.sessionStartTime) {
      log.info('Нет активной сессии')
      return
    }

    // Добавляем время сессии к общему
    const sessionDuration = Date.now() - this.sessionStartTime
    statsStore.addSeedingTime(sessionDuration)

    // Очищаем
    this.sessionStartTime = null
    if (this.sessionInterval) {
      clearInterval(this.sessionInterval)
      this.sessionInterval = null
    }

    statsStore.resetCurrentSession()

    this.emit('stats:sessionEnded')
    log.info(`Сессия завершена (${Math.round(sessionDuration / 1000 / 60)} мин)`)
  }

  /**
   * Запустить периодическое сохранение
   */
  private startPeriodicSave(): void {
    this.saveInterval = setInterval(() => {
      this.flushPendingStats()
    }, STATS_SAVE_INTERVAL)
  }

  /**
   * Сохранить накопленную статистику
   */
  private flushPendingStats(): void {
    let stats = statsStore.loadStats()
    let hasChanges = false

    if (this.pendingBytesUp > 0) {
      stats = statsStore.addBytesUploaded(this.pendingBytesUp)
      this.pendingBytesUp = 0
      hasChanges = true
    }

    if (this.pendingBytesDown > 0) {
      stats = statsStore.addBytesDownloaded(this.pendingBytesDown)
      this.pendingBytesDown = 0
      hasChanges = true
    }

    if (this.pendingPeersHelped > 0) {
      for (let i = 0; i < this.pendingPeersHelped; i++) {
        stats = statsStore.addPeerHelped()
      }
      this.pendingPeersHelped = 0
      hasChanges = true
    }

    if (hasChanges) {
      this.emitStatsUpdated(stats)
    }
  }

  /**
   * Отслеживать байты upload (вызывается из IPFS)
   */
  trackBytesUploaded(bytes: number): void {
    this.pendingBytesUp += bytes
  }

  /**
   * Отслеживать байты download (вызывается из IPFS)
   */
  trackBytesDownloaded(bytes: number): void {
    this.pendingBytesDown += bytes
  }

  /**
   * Отслеживать помощь пиру (вызывается когда пир скачал от нас)
   */
  trackPeerHelped(): void {
    this.pendingPeersHelped += 1
  }

  /**
   * Обновить количество уникального контента
   */
  updateUniqueContentCount(count: number): void {
    const stats = statsStore.setUniqueContentCount(count)
    this.emitStatsUpdated(stats)
  }

  /**
   * Получить текущую статистику
   */
  getStats(): UserStats {
    return statsStore.loadStats()
  }

  /**
   * Получить историю по дням
   */
  getDailyHistory(days = 30) {
    return statsStore.getDailyHistory(days)
  }

  /**
   * Эмитить событие обновления статистики
   */
  private emitStatsUpdated(stats: UserStats): void {
    const event: StatsUpdatedEvent = {
      stats,
      delta: {},
    }
    this.emit('stats:updated', event)
  }
}

/**
 * Получить singleton экземпляр StatsTracker
 */
export function getStatsTracker(): StatsTracker {
  return StatsTracker.getInstance()
}

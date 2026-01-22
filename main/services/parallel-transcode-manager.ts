/**
 * ParallelTranscodeManager — координатор параллельного кодирования
 *
 * Заменяет старый TranscodeManager, добавляя:
 * - Раздельные пулы для видео (GPU) и аудио (CPU)
 * - Параллельное кодирование видео и аудио одновременно
 * - Агрегированный прогресс для UI
 * - Отслеживание завершения эпизодов
 */

import { EventEmitter } from 'events'
import type {
  AggregatedProgress,
  AudioPoolTask,
  BatchImportItem,
  ImportQueueItem,
  VideoPoolTask,
} from '../../shared/types/parallel-transcode'
import type { CqSearchProgress } from '../../shared/types/vmaf'
import { AudioPool } from './pools/audio-pool'
import { type LogEntry, VideoPool } from './pools/video-pool'

export class ParallelTranscodeManager extends EventEmitter {
  private static instance: ParallelTranscodeManager | null = null

  /** Пул видео-кодирования (GPU) */
  private videoPool: VideoPool

  /** Пул аудио-кодирования (CPU) */
  private audioPool: AudioPool

  /** Очередь импорта (элементы = эпизоды) */
  private importQueue: Map<string, ImportQueueItem> = new Map()

  /** Завершённые видео-задачи (для отслеживания) */
  private completedVideoTasks: Set<string> = new Set()

  /** Завершённые аудио-задачи (для отслеживания) */
  private completedAudioTasks: Set<string> = new Set()

  /** Глобальная пауза */
  private globalPause = false

  /** ID текущего batch (для отслеживания завершения) */
  private currentBatchId: string | null = null

  /** ID элементов текущего batch */
  private currentBatchItems: Set<string> = new Set()

  // === Новые поля для сохранения состояния между навигациями ===

  /**
   * VMAF прогресс для каждого item
   * Хранится в main process для сохранения при навигации в renderer
   */
  private vmafProgressMap: Map<string, CqSearchProgress> = new Map()

  /**
   * ID текущего обрабатываемого item (защита от дублирования)
   * Используется для предотвращения повторного запуска обработки
   */
  private processingItemId: string | null = null

  // === Throttle для событий прогресса (предотвращение утечки памяти) ===

  /** Время последней отправки агрегированного прогресса */
  private lastProgressEmitTime = 0

  /** Минимальный интервал между отправками прогресса (мс) — 4 раза/сек вместо 8 */
  private readonly PROGRESS_EMIT_INTERVAL = 250

  private constructor() {
    super()

    // Инициализация пулов с дефолтными значениями
    // VideoPool: 2 параллельных GPU кодирования (Dual NVENC по умолчанию)
    // Реальное значение устанавливается через setVideoMaxConcurrent() перед addBatch()
    this.videoPool = new VideoPool({ maxConcurrent: 2 })
    // AudioPool: ограничиваем до 4 параллельных задач
    // (больше создаёт overhead от многих FFmpeg процессов)
    this.audioPool = new AudioPool({ maxConcurrent: 4 })

    this.setupPoolListeners()
  }

  /** Singleton */
  static getInstance(): ParallelTranscodeManager {
    if (!ParallelTranscodeManager.instance) {
      ParallelTranscodeManager.instance = new ParallelTranscodeManager()
    }
    return ParallelTranscodeManager.instance
  }

  // === Публичные методы ===

  /**
   * Полная очистка перед новым импортом
   * Сбрасывает все состояния пулов и очередей
   */
  reset(): void {
    console.warn(
      `[ParallelTranscode] RESET called! importQueue=${this.importQueue.size}, completedVideo=${this.completedVideoTasks.size}, completedAudio=${this.completedAudioTasks.size}`
    )
    // Выводим stack trace для отладки кто вызвал reset
    console.warn('[ParallelTranscode] reset() stack:', new Error().stack)
    this.videoPool.clear()
    this.audioPool.clear()
    this.importQueue.clear()
    this.completedVideoTasks.clear()
    this.completedAudioTasks.clear()
    this.globalPause = false
    this.currentBatchId = null
    this.currentBatchItems.clear()
    this.vmafProgressMap.clear()
    this.processingItemId = null
    console.warn('[ParallelTranscode] Reset completed')
  }

  /**
   * Добавить batch эпизодов для импорта
   * Все задачи добавляются в пулы БЕЗ сброса состояния
   *
   * @param items Элементы для добавления
   * @param batchId Уникальный ID batch'а (для отслеживания завершения)
   *
   * @remarks
   * Используй startNewBatch() если нужен сброс перед новым batch'ом
   */
  addBatch(items: BatchImportItem[], batchId?: string): void {
    // Устанавливаем batch ID если передан
    if (batchId) {
      this.currentBatchId = batchId
      this.currentBatchItems = new Set(items.map((item) => item.id))
    }

    for (const item of items) {
      this.addImportItem(item)
    }
    this.emitAggregatedProgress()
  }

  /**
   * Начать новый batch с полным сбросом состояния
   * Используй когда нужно гарантировать чистый старт
   *
   * @param items Элементы для добавления
   * @param batchId Уникальный ID batch'а (для отслеживания завершения)
   */
  startNewBatch(items: BatchImportItem[], batchId?: string): void {
    this.reset()
    this.addBatch(items, batchId)
  }

  /**
   * Получить текущий batch ID
   */
  getCurrentBatchId(): string | null {
    return this.currentBatchId
  }

  /**
   * Установить максимальное количество параллельных аудио-задач
   * Применяется к AudioPool (CPU-пул)
   */
  setAudioMaxConcurrent(value: number): void {
    this.audioPool.setMaxConcurrent(value)
    console.warn(`[ParallelTranscode] Audio max concurrent set to ${this.audioPool.getMaxConcurrent()}`)
  }

  /**
   * Получить текущий лимит параллельных аудио-задач
   */
  getAudioMaxConcurrent(): number {
    return this.audioPool.getMaxConcurrent()
  }

  /**
   * Установить максимальное количество параллельных видео-задач
   * Применяется к VideoPool (GPU-пул)
   */
  setVideoMaxConcurrent(value: number): void {
    this.videoPool.setMaxConcurrent(value)
    console.warn(`[ParallelTranscode] Video max concurrent set to ${this.videoPool.getMaxConcurrent()}`)
  }

  /**
   * Получить текущий лимит параллельных видео-задач
   */
  getVideoMaxConcurrent(): number {
    return this.videoPool.getMaxConcurrent()
  }

  // === VMAF прогресс (сохраняется в main для навигации) ===

  /**
   * Установить VMAF прогресс для item
   * Вызывается из vmaf.handlers.ts при поиске CQ
   */
  setVmafProgress(itemId: string, progress: CqSearchProgress): void {
    this.vmafProgressMap.set(itemId, progress)
    this.emit('vmafProgress', itemId, progress)
  }

  /**
   * Получить VMAF прогресс для item
   */
  getVmafProgress(itemId: string): CqSearchProgress | undefined {
    return this.vmafProgressMap.get(itemId)
  }

  /**
   * Получить все VMAF прогрессы
   */
  getAllVmafProgress(): Record<string, CqSearchProgress> {
    return Object.fromEntries(this.vmafProgressMap)
  }

  /**
   * Очистить VMAF прогресс для item
   */
  clearVmafProgress(itemId: string): void {
    this.vmafProgressMap.delete(itemId)
  }

  // === FFmpeg Log Viewer ===

  /**
   * Получить все логи видеопула
   */
  getVideoLogs(): LogEntry[] {
    return this.videoPool.getAllLogs()
  }

  /**
   * Получить логи конкретной видео-задачи
   */
  getVideoTaskLogs(taskId: string): LogEntry[] {
    return this.videoPool.getTaskLogs(taskId)
  }

  /**
   * Очистить все видео-логи
   */
  clearVideoLogs(): void {
    this.videoPool.clearAllLogs()
  }

  /**
   * Получить количество записей в видео-логах
   */
  getVideoLogCount(): number {
    return this.videoPool.getLogCount()
  }

  // === Защита от дублирования обработки ===

  /**
   * Проверить, обрабатывается ли item или вообще идёт обработка
   *
   * @param itemId Опциональный ID item для проверки конкретного
   * @returns true если обрабатывается
   */
  isItemProcessing(itemId?: string): boolean {
    if (itemId) {
      return this.processingItemId === itemId
    }
    return (
      this.processingItemId !== null || this.videoPool.getStatus().running > 0 || this.audioPool.getStatus().running > 0
    )
  }

  /**
   * Установить текущий обрабатываемый item (защита от дублей)
   *
   * @returns true если успешно установлен, false если уже обрабатывается другой
   */
  setProcessingItem(itemId: string | null): boolean {
    if (itemId === null) {
      this.processingItemId = null
      return true
    }

    // Если уже обрабатывается этот же item — не запускаем повторно!
    // Это защита от перезагрузки страницы и навигации
    if (this.processingItemId === itemId) {
      console.warn(`[ParallelTranscode] Item ${itemId} is already processing, rejecting duplicate start`)
      return false
    }

    // Если обрабатывается другой item — не разрешаем
    if (this.processingItemId !== null) {
      console.warn(
        `[ParallelTranscode] Cannot set processing item ${itemId}, already processing ${this.processingItemId}`
      )
      return false
    }

    this.processingItemId = itemId
    return true
  }

  /**
   * Получить ID текущего обрабатываемого item
   */
  getProcessingItemId(): string | null {
    return this.processingItemId
  }

  /**
   * Добавить один эпизод для импорта
   */
  addImportItem(item: BatchImportItem): void {
    // Защита от дублей — не добавлять item который уже существует
    if (this.importQueue.has(item.id)) {
      console.warn(`[ParallelTranscode] Item ${item.id} already exists in queue, skipping`)
      return
    }

    // Создаём видео-задачу
    const videoTask: VideoPoolTask = {
      id: `video-${item.id}`,
      type: 'video',
      queueItemId: item.id,
      animeQueueItemId: item.animeQueueItemId,
      episodeId: item.episodeId,
      inputPath: item.video.inputPath,
      outputPath: item.video.outputPath,
      options: item.video.options,
      status: 'queued',
      progress: null,
      // Передаём CPU fallback из VMAF результата
      useCpuFallback: item.video.useCpuFallback,
    }

    // Создаём аудио-задачи
    const audioTasks: AudioPoolTask[] = item.audioTracks.map((track) => ({
      id: `audio-${item.id}-${track.trackIndex}`,
      type: 'audio',
      queueItemId: item.id,
      animeQueueItemId: item.animeQueueItemId,
      episodeId: item.episodeId,
      trackId: track.trackId,
      trackIndex: track.trackIndex,
      inputPath: track.inputPath,
      outputPath: track.outputPath,
      options: track.options,
      status: 'queued',
      progress: null,
      // Флаг для кодирования напрямую из исходного MKV (нужен -map 0:a:N)
      useStreamMapping: track.useStreamMapping,
    }))

    // Сохраняем в очередь импорта
    const importItem: ImportQueueItem = {
      id: item.id,
      episodeId: item.episodeId,
      status: 'processing',
      videoTask,
      audioTasks,
      addedAt: new Date().toISOString(),
    }
    this.importQueue.set(item.id, importItem)

    // Добавляем в пулы — они начнут обработку параллельно
    this.videoPool.addTask(videoTask)
    this.audioPool.addTasks(audioTasks)

    this.emit('itemAdded', item.id, item.episodeId)
  }

  /** Получить агрегированный прогресс */
  getAggregatedProgress(): AggregatedProgress {
    const videoStatus = this.videoPool.getStatus()
    const audioStatus = this.audioPool.getStatus()

    // Считаем статистику
    const videoCompleted = videoStatus.tasks.filter((t) => t.status === 'completed').length
    const videoErrors = videoStatus.tasks.filter((t) => t.status === 'error').length
    const audioCompleted = audioStatus.tasks.filter((t) => t.status === 'completed').length
    const audioErrors = audioStatus.tasks.filter((t) => t.status === 'error').length

    // Рассчитываем средний процент активных видео-задач
    const runningVideoTasks = videoStatus.tasks.filter((t) => t.status === 'running')
    let currentVideoPercent = 0
    if (runningVideoTasks.length > 0) {
      const totalPercent = runningVideoTasks.reduce((sum, task) => sum + (task.progress?.percent ?? 0), 0)
      currentVideoPercent = totalPercent / runningVideoTasks.length
    }

    // Взвешенный прогресс: видео 80%, аудио 20%
    // Учитываем прогресс текущих видео-задач для более плавного отображения
    const videoWeight = 0.8
    const audioWeight = 0.2

    // Прогресс видео: завершённые + частичный прогресс активных
    const videoTotal = videoStatus.tasks.length
    const videoProgress =
      videoTotal > 0
        ? ((videoCompleted + (runningVideoTasks.length > 0 ? currentVideoPercent / 100 : 0)) / videoTotal) * 100
        : 100

    // Прогресс аудио: только завершённые (аудио быстро кодируется)
    const audioTotal = audioStatus.tasks.length
    const audioProgress = audioTotal > 0 ? (audioCompleted / audioTotal) * 100 : 100

    // Итоговый взвешенный прогресс
    const totalPercent = videoProgress * videoWeight + audioProgress * audioWeight

    // Статистика текущего элемента (per-anime)
    // processingItemId — это ID аниме в очереди импорта (не episodeId)
    const currentAnimeId = this.processingItemId
    let currentItemStats = undefined
    if (currentAnimeId) {
      // Фильтруем по animeQueueItemId, которое мы передали при создании batch items
      const itemVideoTasks = videoStatus.tasks.filter((t) => t.animeQueueItemId === currentAnimeId)
      const itemAudioTasks = audioStatus.tasks.filter((t) => t.animeQueueItemId === currentAnimeId)

      if (itemVideoTasks.length > 0 || itemAudioTasks.length > 0) {
        currentItemStats = {
          itemId: currentAnimeId,
          videoTotal: itemVideoTasks.length,
          videoCompleted: itemVideoTasks.filter((t) => t.status === 'completed').length,
          audioTotal: itemAudioTasks.length,
          audioCompleted: itemAudioTasks.filter((t) => t.status === 'completed').length,
        }
      }
    }

    return {
      totalPercent,
      currentVideoPercent,
      videoTasks: {
        active: videoStatus.running,
        queued: videoStatus.queued,
        completed: videoCompleted,
        total: videoStatus.tasks.length,
        errors: videoErrors,
        tasks: videoStatus.tasks.filter((t) => t.status === 'running' || t.status === 'queued'),
      },
      audioTasks: {
        active: audioStatus.running,
        queued: audioStatus.queued,
        completed: audioCompleted,
        total: audioStatus.tasks.length,
        errors: audioErrors,
        tasks: audioStatus.tasks.filter((t) => t.status === 'running' || t.status === 'queued'),
      },
      items: Array.from(this.importQueue.values()),
      currentItemStats,
    }
  }

  /** Приостановить все задачи */
  pauseAll(): void {
    this.globalPause = true
    this.videoPool.pauseAll()
    this.audioPool.pauseAll()
    this.emit('paused')
  }

  /** Возобновить все задачи */
  resumeAll(): void {
    this.globalPause = false
    this.videoPool.resumeAll()
    this.audioPool.resumeAll()
    this.emit('resumed')
  }

  /** Отменить элемент импорта */
  cancelItem(itemId: string): boolean {
    const item = this.importQueue.get(itemId)
    if (!item) {
      return false
    }

    // Отменяем видео
    this.videoPool.cancelTask(item.videoTask.id)

    // Отменяем все аудио
    for (const audioTask of item.audioTasks) {
      this.audioPool.cancelTask(audioTask.id)
    }

    item.status = 'cancelled'
    this.emit('itemCancelled', itemId, item.episodeId)
    this.emitAggregatedProgress()
    return true
  }

  /** Отменить все */
  cancelAll(): void {
    console.warn(`[ParallelTranscode] CANCEL ALL called! importQueue=${this.importQueue.size}`)
    console.warn('[ParallelTranscode] cancelAll() stack:', new Error().stack)
    this.videoPool.clear()
    this.audioPool.clear()

    for (const item of this.importQueue.values()) {
      item.status = 'cancelled'
    }

    this.emit('allCancelled')
    this.emitAggregatedProgress()
  }

  /** Очистить завершённые элементы */
  clearCompleted(): void {
    for (const [id, item] of this.importQueue) {
      if (item.status === 'completed' || item.status === 'cancelled' || item.status === 'error') {
        this.importQueue.delete(id)
      }
    }
    this.completedVideoTasks.clear()
    this.completedAudioTasks.clear()
  }

  /** Получить элемент по ID */
  getItem(itemId: string): ImportQueueItem | undefined {
    return this.importQueue.get(itemId)
  }

  /** Получить все элементы */
  getItems(): ImportQueueItem[] {
    return Array.from(this.importQueue.values())
  }

  /** Проверить, есть ли активные задачи */
  isProcessing(): boolean {
    const videoStatus = this.videoPool.getStatus()
    const audioStatus = this.audioPool.getStatus()
    return videoStatus.running > 0 || audioStatus.running > 0 || videoStatus.queued > 0 || audioStatus.queued > 0
  }

  // === Приватные методы ===

  /** Настройка слушателей событий от пулов */
  private setupPoolListeners(): void {
    // === Video Pool Events ===

    this.videoPool.on('taskProgress', (taskId: string, progress) => {
      this.emit('videoProgress', taskId, progress)
      this.emitAggregatedProgressThrottled() // Throttled: 4 раза/сек вместо каждого события
    })

    this.videoPool.on('taskCompleted', (task: VideoPoolTask) => {
      this.completedVideoTasks.add(task.id)
      this.handleVideoCompleted(task)
    })

    this.videoPool.on('taskError', (task: VideoPoolTask) => {
      this.emit('taskError', task.id, 'video', task.error)
      this.handleTaskError(task.queueItemId)
    })

    this.videoPool.on('taskCancelled', (_task: VideoPoolTask) => {
      // Уже обработано в cancelItem
    })

    // === Audio Pool Events ===

    this.audioPool.on('taskProgress', (taskId: string, progress) => {
      this.emit('audioProgress', taskId, progress)
      this.emitAggregatedProgressThrottled() // Throttled: 4 раза/сек вместо каждого события
    })

    this.audioPool.on('taskCompleted', (task: AudioPoolTask) => {
      this.completedAudioTasks.add(task.id)
      this.handleAudioCompleted(task)
    })

    this.audioPool.on('taskError', (task: AudioPoolTask) => {
      this.emit('taskError', task.id, 'audio', task.error)
      this.handleTaskError(task.queueItemId)
    })

    this.audioPool.on('taskCancelled', (_task: AudioPoolTask) => {
      // Уже обработано в cancelItem
    })
  }

  /** Обработка завершения видео */
  private handleVideoCompleted(task: VideoPoolTask): void {
    const item = this.importQueue.get(task.queueItemId)
    if (!item) {
      console.warn(`[ParallelTranscode] handleVideoCompleted: item ${task.queueItemId} not found in queue!`)
      return
    }

    console.warn(
      `[ParallelTranscode] handleVideoCompleted: ${task.queueItemId}, videoTask.status=${item.videoTask.status}`
    )

    item.videoCompleted = true
    // Передаём все данные о кодировании для сохранения в БД
    this.emit('videoCompleted', task.queueItemId, task.episodeId, task.outputPath, {
      ffmpegCommand: task.ffmpegCommand,
      transcodeDurationMs: task.transcodeDurationMs,
      activeGpuWorkers: task.activeGpuWorkers,
    })
    this.emitAggregatedProgress() // Обновить счётчики
    this.checkItemCompletion(item)
  }

  /** Обработка завершения аудио */
  private handleAudioCompleted(task: AudioPoolTask): void {
    this.emit('audioTrackCompleted', task.trackId, task.outputPath, task.episodeId)

    const item = this.importQueue.get(task.queueItemId)
    if (item) {
      const audioStatuses = item.audioTasks.map((t) => t.status).join(', ')
      console.warn(
        `[ParallelTranscode] handleAudioCompleted: ${task.queueItemId}, trackId=${task.trackId}, audioStatuses=[${audioStatuses}]`
      )
      this.emitAggregatedProgress() // Обновить счётчики
      this.checkItemCompletion(item)
    } else {
      console.warn(`[ParallelTranscode] handleAudioCompleted: item ${task.queueItemId} not found!`)
    }
  }

  /** Обработка ошибки в задаче */
  private handleTaskError(itemId: string): void {
    const item = this.importQueue.get(itemId)
    if (!item) {
      return
    }

    // Если хотя бы одна задача завершилась с ошибкой, помечаем весь элемент
    item.status = 'error'
    this.emit('itemError', itemId, item.episodeId)
    this.emitAggregatedProgress()
  }

  /** Проверка полного завершения элемента */
  private checkItemCompletion(item: ImportQueueItem): void {
    // Проверяем видео (завершено = completed, error или cancelled)
    const videoFinished =
      item.videoTask.status === 'completed' ||
      item.videoTask.status === 'error' ||
      item.videoTask.status === 'cancelled'
    const videoSuccessful = item.videoTask.status === 'completed'

    // Проверяем все аудио
    const allAudioFinished = item.audioTasks.every(
      (t) => t.status === 'completed' || t.status === 'error' || t.status === 'cancelled'
    )
    const allAudioSuccessful = item.audioTasks.every((t) => t.status === 'completed')

    // Отладочный вывод для диагностики
    const audioStatuses = item.audioTasks.map((t) => t.status)
    const audioCompleted = audioStatuses.filter((s) => s === 'completed').length
    const audioTotal = item.audioTasks.length
    console.warn(
      `[ParallelTranscode] checkItemCompletion: ${item.id} - ` +
        `video=${item.videoTask.status}(finished=${videoFinished}), ` +
        `audio=${audioCompleted}/${audioTotal}(allFinished=${allAudioFinished})`
    )

    if (videoFinished && allAudioFinished) {
      if (videoSuccessful && allAudioSuccessful) {
        item.status = 'completed'
        console.warn(`[ParallelTranscode] Item ${item.id} completed successfully, emitting itemCompleted event`)
        this.emit('itemCompleted', item.id, item.episodeId, true)
      } else {
        item.status = 'error'
        const errorMessage = item.videoTask.error || item.audioTasks.find((t) => t.error)?.error || 'Unknown error'
        console.warn(`[ParallelTranscode] Item ${item.id} completed with error: ${errorMessage}`)
        this.emit('itemCompleted', item.id, item.episodeId, false, errorMessage)
        this.emit('itemError', item.id, item.episodeId)
      }
      this.emitAggregatedProgress()

      // Проверяем завершение всего batch
      this.checkBatchCompletion()
    }
  }

  /** Проверка завершения всего batch */
  private checkBatchCompletion(): void {
    if (!this.currentBatchId || this.currentBatchItems.size === 0) {
      return
    }

    // Проверяем статус всех элементов batch
    let allCompleted = true
    let hasErrors = false

    for (const itemId of this.currentBatchItems) {
      const item = this.importQueue.get(itemId)
      if (!item) {
        continue
      }

      if (item.status === 'processing') {
        allCompleted = false
        break
      }

      if (item.status === 'error') {
        hasErrors = true
      }
    }

    if (allCompleted) {
      const batchId = this.currentBatchId
      console.warn(`[ParallelTranscode] Batch ${batchId} completed. Has errors: ${hasErrors}`)

      // Сбрасываем batch данные
      this.currentBatchId = null
      this.currentBatchItems.clear()

      // Эмитим событие завершения batch
      this.emit('batchCompleted', batchId, !hasErrors)
    }
  }

  /**
   * Throttled версия emitAggregatedProgress
   * Ограничивает частоту отправки до 4 раз/сек (250ms интервал)
   * Это снижает нагрузку на IPC и количество re-renders в renderer
   */
  private emitAggregatedProgressThrottled(): void {
    const now = Date.now()
    if (now - this.lastProgressEmitTime < this.PROGRESS_EMIT_INTERVAL) {
      return
    }
    this.lastProgressEmitTime = now
    this.emitAggregatedProgress()
  }

  /** Отправить агрегированный прогресс */
  private emitAggregatedProgress(): void {
    const progress = this.getAggregatedProgress()

    // DEBUG: Логируем прогресс видео-задач (только при наличии активных)
    if (progress.videoTasks.tasks.length > 0) {
      const videoProgress = progress.videoTasks.tasks.map((t) => ({
        id: t.id.slice(-6),
        status: t.status,
        percent: t.progress?.percent?.toFixed(1) ?? 'null',
      }))
    }

    this.emit('aggregatedProgress', progress)
  }
}

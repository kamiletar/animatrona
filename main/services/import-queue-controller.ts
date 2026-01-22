/* eslint-disable no-console */
/**
 * ImportQueueController — координатор очереди импорта
 *
 * Event-driven архитектура:
 * - Main process хранит очередь и статусы (единственный источник правды)
 * - Renderer только отображает и отправляет команды
 * - При F5 renderer получает актуальное состояние из main
 *
 * События (main → renderer):
 * - import-queue:state-changed — полное состояние изменилось
 * - import-queue:item-status — статус одного item изменился
 * - import-queue:item-progress — прогресс одного item изменился
 *
 * Команды (renderer → main через IPC handlers):
 * - addItems — добавить items в очередь
 * - startQueue — начать обработку
 * - pauseQueue — приостановить
 * - cancelItem — отменить item
 * - getState — получить текущее состояние
 */

import { BrowserWindow, Notification } from 'electron'
import { EventEmitter } from 'events'
import type {
  ImportQueueAddData,
  ImportQueueDetailProgress,
  ImportQueueEntry,
  ImportQueueState,
  ImportQueueStatus,
  ImportQueueVmafProgress,
  ImportQueueVmafResult,
} from '../../shared/types/import-queue'
import type { CqSearchProgress } from '../../shared/types/vmaf'
import { setPowerSaveTranscoding } from '../ipc/app.handlers'
import { findOptimalCQ } from '../src/ffmpeg'

/**
 * Контроллер очереди импорта
 * Singleton — живёт всё время работы приложения
 */
export class ImportQueueController extends EventEmitter {
  private static instance: ImportQueueController | null = null

  /** Очередь items (Map для быстрого доступа по id) */
  private queue: Map<string, ImportQueueEntry> = new Map()

  /** ID текущего обрабатываемого item */
  private currentId: string | null = null

  /** Очередь на паузе */
  private isPaused = false

  /** Автозапуск при добавлении */
  private autoStart = true

  /** Счётчик приоритетов */
  private priorityCounter = 0

  // === Throttle для событий прогресса (предотвращение утечки памяти) ===

  /** Время последней отправки прогресса для каждого item */
  private lastItemProgressEmit: Map<string, number> = new Map()

  /** Последняя отправленная сумма прогресса воркеров (для throttle detailProgress) */
  private lastWorkersProgressSum: Map<string, number> = new Map()

  /** Минимальный интервал между отправками прогресса item (мс) — 4 раза/сек */
  private readonly ITEM_PROGRESS_INTERVAL = 250

  /** Флаг — была ли хоть одна обработка (для нотификации "очередь завершена") */
  private hadProcessing = false

  private constructor() {
    super()
    console.log('[ImportQueueController] Initialized')
  }

  // ==========================================
  // === Desktop Notifications ===
  // ==========================================

  /**
   * Показать нотификацию о завершении сериала
   */
  private notifyCompleted(animeName: string): void {
    if (!Notification.isSupported()) return

    new Notification({
      title: 'Импорт завершён',
      body: animeName,
      silent: false,
    }).show()
  }

  /**
   * Показать нотификацию об ошибке
   */
  private notifyError(animeName: string, error?: string): void {
    if (!Notification.isSupported()) return

    new Notification({
      title: 'Ошибка импорта',
      body: error ? `${animeName}: ${error}` : animeName,
      silent: false,
    }).show()
  }

  /**
   * Показать нотификацию о завершении всей очереди
   */
  private notifyQueueCompleted(): void {
    if (!Notification.isSupported()) return

    const completed = [...this.queue.values()].filter((i) => i.status === 'completed').length
    const errors = [...this.queue.values()].filter((i) => i.status === 'error').length

    let body = `Обработано: ${completed}`
    if (errors > 0) {
      body += `, ошибок: ${errors}`
    }

    new Notification({
      title: 'Очередь импорта завершена',
      body,
      silent: false,
    }).show()
  }

  /** Singleton */
  static getInstance(): ImportQueueController {
    if (!ImportQueueController.instance) {
      ImportQueueController.instance = new ImportQueueController()
    }
    return ImportQueueController.instance
  }

  // ==========================================
  // === Команды от renderer ===
  // ==========================================

  /**
   * Добавить items в очередь
   */
  addItems(items: ImportQueueAddData[]): void {
    const now = new Date().toISOString()

    for (const itemData of items) {
      const id = crypto.randomUUID()
      const entry: ImportQueueEntry = {
        ...itemData,
        id,
        status: 'pending',
        priority: this.priorityCounter++,
        addedAt: now,
      }

      // Защита от дублей по folderPath
      const existingByPath = [...this.queue.values()].find(
        (i) => i.folderPath === entry.folderPath && i.status !== 'completed' && i.status !== 'error',
      )
      if (existingByPath) {
        console.warn(`[ImportQueueController] Item with path ${entry.folderPath} already in queue, skipping`)
        continue
      }

      this.queue.set(id, entry)
      console.log(
        `[ImportQueueController] Added item ${id}: ${entry.selectedAnime.russian || entry.selectedAnime.name}`,
      )
    }

    this.emitStateChanged()

    // Автозапуск если включён и нет активной обработки
    if (this.autoStart && !this.currentId && !this.isPaused) {
      this.startQueue()
    }
  }

  /**
   * Начать обработку очереди
   */
  startQueue(): void {
    if (this.currentId) {
      console.log('[ImportQueueController] Queue already processing')
      return
    }

    this.isPaused = false
    this.processNext()
  }

  /**
   * Приостановить очередь (текущий item завершится)
   */
  pauseQueue(): void {
    this.isPaused = true
    this.emitStateChanged()
  }

  /**
   * Возобновить очередь
   */
  resumeQueue(): void {
    this.isPaused = false
    if (!this.currentId) {
      this.processNext()
    }
    this.emitStateChanged()
  }

  /**
   * Отменить item
   */
  cancelItem(itemId: string): void {
    const item = this.queue.get(itemId)
    if (!item) {
      console.warn(`[ImportQueueController] Item ${itemId} not found`)
      return
    }

    // Если это текущий обрабатываемый — отменяем и переходим к следующему
    if (this.currentId === itemId) {
      this.updateItemStatus(itemId, 'cancelled')
      this.currentId = null
      this.processNext()
    } else {
      this.updateItemStatus(itemId, 'cancelled')
    }
  }

  /**
   * Удалить item из очереди
   */
  removeItem(itemId: string): void {
    if (this.currentId === itemId) {
      console.warn(`[ImportQueueController] Cannot remove currently processing item ${itemId}`)
      return
    }

    this.queue.delete(itemId)
    this.emitStateChanged()
  }

  /**
   * Повторить обработку item с ошибкой
   * Сбрасывает статус на pending и очищает ошибки
   */
  retryItem(itemId: string): void {
    const item = this.queue.get(itemId)
    if (!item) {
      console.warn(`[ImportQueueController] Item ${itemId} not found for retry`)
      return
    }

    // Можно повторять только error или cancelled items
    if (item.status !== 'error' && item.status !== 'cancelled') {
      console.warn(`[ImportQueueController] Cannot retry item ${itemId} with status ${item.status}`)
      return
    }

    // Сбрасываем item в исходное состояние
    item.status = 'pending'
    item.error = undefined
    item.progress = undefined
    item.currentFileName = undefined
    item.currentStage = undefined
    item.detailProgress = undefined
    item.startedAt = undefined
    item.completedAt = undefined
    // vmafResult сохраняем — не нужно повторно подбирать CQ

    console.log(
      `[ImportQueueController] Retrying item ${itemId}: ${item.selectedAnime.russian || item.selectedAnime.name}`,
    )

    this.emitStateChanged()

    // Автозапуск если включён и нет активной обработки
    if (this.autoStart && !this.currentId && !this.isPaused) {
      this.startQueue()
    }
  }

  /**
   * Изменить порядок элементов в очереди (drag & drop)
   * @param activeId - ID перетаскиваемого элемента
   * @param overId - ID элемента, над которым отпустили
   */
  reorderItems(activeId: string, overId: string): void {
    if (activeId === overId) return

    const activeItem = this.queue.get(activeId)
    const overItem = this.queue.get(overId)

    if (!activeItem || !overItem) {
      console.warn(`[ImportQueueController] Cannot reorder: item not found`)
      return
    }

    // Можно переупорядочивать только pending items
    if (activeItem.status !== 'pending' || overItem.status !== 'pending') {
      console.warn(`[ImportQueueController] Cannot reorder: only pending items can be reordered`)
      return
    }

    // Получаем все pending items отсортированные по priority
    const pendingItems = [...this.queue.values()]
      .filter((item) => item.status === 'pending')
      .sort((a, b) => a.priority - b.priority)

    const oldIndex = pendingItems.findIndex((item) => item.id === activeId)
    const newIndex = pendingItems.findIndex((item) => item.id === overId)

    if (oldIndex === -1 || newIndex === -1) return

    // Перемещаем элемент
    pendingItems.splice(oldIndex, 1)
    pendingItems.splice(newIndex, 0, activeItem)

    // Пересчитываем priorities
    pendingItems.forEach((item, index) => {
      item.priority = index
    })

    this.emitStateChanged()
    console.log(`[ImportQueueController] Reordered: ${activeId} moved to position ${newIndex}`)
  }

  /**
   * Отменить всю очередь
   */
  cancelAll(): void {
    // Отменяем все pending и processing items
    for (const [id, item] of this.queue) {
      if (
        item.status === 'pending' || item.status === 'vmaf' || item.status === 'preparing'
        || item.status === 'transcoding'
      ) {
        item.status = 'cancelled'
        item.completedAt = new Date().toISOString()
        this.emitItemStatus(id, 'cancelled')
      }
    }

    this.currentId = null
    this.emitStateChanged()
    console.log('[ImportQueueController] All items cancelled')
  }

  /**
   * Получить текущее состояние
   */
  getState(): ImportQueueState {
    return {
      items: [...this.queue.values()].sort((a, b) => a.priority - b.priority),
      currentId: this.currentId,
      isPaused: this.isPaused,
      autoStart: this.autoStart,
    }
  }

  /**
   * Получить item по ID
   */
  getItem(itemId: string): ImportQueueEntry | undefined {
    return this.queue.get(itemId)
  }

  /**
   * Установить автозапуск
   */
  setAutoStart(enabled: boolean): void {
    this.autoStart = enabled
  }

  // ==========================================
  // === Обновления от renderer ===
  // ==========================================

  /**
   * Обновить статус item (вызывается из renderer через IPC)
   */
  updateItemStatus(itemId: string, status: ImportQueueStatus, error?: string): void {
    const item = this.queue.get(itemId)
    if (!item) {
      console.warn(`[ImportQueueController] Item ${itemId} not found for status update`)
      return
    }

    const prevStatus = item.status
    item.status = status

    if (error) {
      item.error = error
    }

    // Обновляем временные метки
    if (status === 'preparing' && !item.startedAt) {
      item.startedAt = new Date().toISOString()
      this.hadProcessing = true
    }
    if (status === 'completed' || status === 'error' || status === 'cancelled') {
      item.completedAt = new Date().toISOString()

      // Desktop notifications
      const animeName = item.selectedAnime.russian || item.selectedAnime.name
      if (status === 'completed') {
        this.notifyCompleted(animeName)
      } else if (status === 'error') {
        this.notifyError(animeName, error)
      }
    }

    console.log(`[ImportQueueController] Item ${itemId} status: ${prevStatus} → ${status}`)
    this.emitItemStatus(itemId, status, error)

    // Если завершён — переходим к следующему
    if (status === 'completed' || status === 'error' || status === 'cancelled') {
      if (this.currentId === itemId) {
        this.currentId = null
        if (!this.isPaused) {
          this.processNext()
        }
      }
    }
  }

  /**
   * Обновить прогресс item
   *
   * Throttled: отправляет IPC события не чаще 2 раз/сек (500ms интервал)
   * Также очищает завершённые воркеры из detailProgress для экономии памяти
   */
  updateItemProgress(
    itemId: string,
    progress: number,
    currentFileName?: string,
    currentStage?: string,
    detailProgress?: ImportQueueDetailProgress,
  ): void {
    const item = this.queue.get(itemId)
    if (!item) return

    const oldProgress = item.progress ?? 0
    const oldStage = item.currentStage

    // Всегда обновляем internal state
    item.progress = progress
    if (currentFileName !== undefined) item.currentFileName = currentFileName
    if (currentStage !== undefined) item.currentStage = currentStage

    // Очищаем завершённые воркеры из detailProgress для экономии памяти
    if (detailProgress !== undefined) {
      item.detailProgress = {
        ...detailProgress,
        // Оставляем только активные видео воркеры (progress < 100)
        videoWorkers: detailProgress.videoWorkers?.filter((w) => w.progress < 100),
        // Оставляем только активные аудио воркеры (не completed)
        audioWorkers: detailProgress.audioWorkers?.filter((w) => w.status === 'running' || w.status === 'pending'),
      }
    }

    // Throttle IPC событий
    const now = Date.now()
    const lastEmit = this.lastItemProgressEmit.get(itemId) ?? 0

    // Вычисляем сумму прогресса воркеров для отслеживания изменений в detailProgress
    const workersProgressSum = item.detailProgress
      ? (item.detailProgress.videoWorkers?.reduce((sum, w) => sum + w.progress, 0) ?? 0)
        + (item.detailProgress.audioWorkers?.reduce((sum, w) => sum + w.progress, 0) ?? 0)
      : 0
    const lastWorkersSum = this.lastWorkersProgressSum.get(itemId) ?? 0

    // Условия для отправки события:
    // 1. Прошло ITEM_PROGRESS_INTERVAL (250ms)
    // 2. ИЛИ общий прогресс изменился на >= 5%
    // 3. ИЛИ стадия изменилась
    // 4. ИЛИ сумма прогресса воркеров изменилась на >= 1% (плавное обновление GPU воркеров)
    const significantChange = Math.abs(progress - oldProgress) >= 5
    const stageChanged = currentStage !== undefined && currentStage !== oldStage
    const workersChanged = Math.abs(workersProgressSum - lastWorkersSum) >= 1

    if (now - lastEmit >= this.ITEM_PROGRESS_INTERVAL || significantChange || stageChanged || workersChanged) {
      this.lastItemProgressEmit.set(itemId, now)
      this.lastWorkersProgressSum.set(itemId, workersProgressSum)
      this.emitItemProgress(itemId, progress, currentFileName, currentStage, item.detailProgress)
    }
  }

  /**
   * Обновить VMAF прогресс
   */
  updateVmafProgress(itemId: string, vmafProgress: ImportQueueVmafProgress): void {
    const item = this.queue.get(itemId)
    if (!item) return

    item.vmafProgress = vmafProgress
    this.emitItemProgress(itemId, item.progress || 0, item.currentFileName, 'vmaf', undefined, vmafProgress)
  }

  /**
   * Установить результат VMAF
   */
  setVmafResult(itemId: string, result: ImportQueueVmafResult): void {
    const item = this.queue.get(itemId)
    if (!item) return

    item.vmafResult = result

    // Обновляем cqOverride в настройках импорта
    if (item.importSettings) {
      item.importSettings.cqOverride = result.optimalCq
    }

    this.emitStateChanged()
  }

  /**
   * Установить результат импорта (animeId)
   */
  setImportResult(itemId: string, animeId: string): void {
    const item = this.queue.get(itemId)
    if (!item) return

    item.createdAnimeId = animeId
    this.emitStateChanged()
  }

  /**
   * Обновить данные item (профиль, параллельность, sync offset и т.д.)
   * Только для pending items
   */
  updateItem(itemId: string, data: Partial<ImportQueueAddData>): void {
    const item = this.queue.get(itemId)
    if (!item) {
      console.warn(`[ImportQueueController] Item ${itemId} not found for update`)
      return
    }

    // Нельзя редактировать текущий обрабатываемый item
    if (this.currentId === itemId) {
      console.warn(`[ImportQueueController] Cannot update currently processing item ${itemId}`)
      return
    }

    // Нельзя редактировать завершённые items
    if (['completed', 'error', 'cancelled'].includes(item.status)) {
      console.warn(`[ImportQueueController] Cannot update completed/error/cancelled item ${itemId}`)
      return
    }

    // Обновляем поля
    if (data.importSettings) {
      item.importSettings = { ...item.importSettings, ...data.importSettings }
    }
    if (data.syncOffset !== undefined) {
      item.syncOffset = data.syncOffset
    }
    if (data.vmafSettings) {
      item.vmafSettings = { ...item.vmafSettings, ...data.vmafSettings }
    }
    if (data.donorPath !== undefined) {
      item.donorPath = data.donorPath
    }
    if (data.donorFiles) {
      item.donorFiles = data.donorFiles
    }

    console.log(`[ImportQueueController] Updated item ${itemId}`)
    this.emitStateChanged()
  }

  // ==========================================
  // === Внутренняя логика ===
  // ==========================================

  /**
   * Обработать следующий item в очереди
   */
  private processNext(): void {
    if (this.isPaused) {
      console.log('[ImportQueueController] Queue is paused, not processing next')
      return
    }

    // Найти следующий pending item
    const pending = [...this.queue.values()]
      .filter((i) => i.status === 'pending')
      .sort((a, b) => a.priority - b.priority)

    if (pending.length === 0) {
      console.log('[ImportQueueController] No pending items')
      this.currentId = null
      // Разрешаем спящий режим когда очередь пуста
      setPowerSaveTranscoding(false)
      // Нотификация о завершении всей очереди (только если была обработка)
      if (this.hadProcessing) {
        this.notifyQueueCompleted()
        this.hadProcessing = false
      }
      this.emitStateChanged()
      return
    }

    const next = pending[0]
    this.currentId = next.id

    // Блокируем спящий режим при старте обработки
    setPowerSaveTranscoding(true)

    console.log(
      `[ImportQueueController] Processing next item: ${next.id} (${
        next.selectedAnime.russian || next.selectedAnime.name
      })`,
    )

    // Устанавливаем статус vmaf если нужен VMAF, иначе preparing
    const needsVmaf = next.vmafSettings?.enabled && !next.vmafResult
    const newStatus: ImportQueueStatus = needsVmaf ? 'vmaf' : 'preparing'

    this.updateItemStatus(next.id, newStatus)

    // КРИТИЧНО: Отправляем полное состояние чтобы renderer узнал о новом currentId
    // Без этого renderer не видит что item стал текущим и не запустит обработку
    this.emitStateChanged()

    // Запускаем VMAF (асинхронно)
    // Транскодирование запускается renderer'ом когда он видит status='preparing'
    // (см. ImportQueueProcessor.tsx — слушает currentItem.status === 'preparing')
    if (needsVmaf) {
      this.runVmaf(next.id).catch((err) => {
        console.error(`[ImportQueueController] VMAF failed for ${next.id}:`, err)
        this.updateItemStatus(next.id, 'error', err instanceof Error ? err.message : String(err))
      })
    }
  }

  /**
   * Запустить VMAF подбор CQ для item
   */
  private async runVmaf(itemId: string): Promise<void> {
    const item = this.queue.get(itemId)
    if (!item) {
      throw new Error(`Item ${itemId} not found`)
    }

    if (!item.vmafSettings?.enabled) {
      throw new Error('VMAF not enabled for this item')
    }

    // Получаем первый выбранный файл
    const selectedFiles = item.files.filter((f) => f.selected)
    if (selectedFiles.length === 0) {
      throw new Error('No selected files for VMAF')
    }
    const sampleFile = selectedFiles[0]

    // Получаем профиль кодирования
    const profile = item.encodingProfile
    if (!profile) {
      throw new Error('Encoding profile not found')
    }

    const animeName = item.selectedAnime.russian || item.selectedAnime.name
    const encodingMode = profile.preferCpu ? 'CPU (preferCpu)' : profile.useGpu ? 'GPU' : 'CPU'
    console.log(
      `[ImportQueueController] Starting VMAF for "${animeName}" with targetVmaf=${item.vmafSettings.targetVmaf}, encoding=${encodingMode}`,
    )

    // Формируем videoOptions из профиля
    const videoOptions = {
      codec: profile.codec.toLowerCase() as 'av1' | 'hevc' | 'h264',
      useGpu: profile.useGpu,
      preset: profile.preset,
      rateControl: profile.rateControl as 'CONSTQP' | 'VBR',
      maxBitrate: profile.maxBitrate ?? undefined,
      tune: profile.tune as 'HQ' | 'UHQ' | 'ULL' | 'LL' | undefined,
      multipass: profile.multipass as 'DISABLED' | 'QRES' | 'FULLRES' | undefined,
      spatialAq: profile.spatialAq,
      temporalAq: profile.temporalAq,
      aqStrength: profile.aqStrength ?? undefined,
      lookahead: profile.lookahead ?? undefined,
      lookaheadLevel: profile.lookaheadLevel ?? undefined,
      gopSize: profile.gopSize ?? undefined,
      bRefMode: profile.bRefMode as 'DISABLED' | 'EACH' | 'MIDDLE' | undefined,
      bFrames: profile.bFrames ?? undefined,
    }

    // Опции VMAF поиска
    const vmafOptions = {
      targetVmaf: item.vmafSettings.targetVmaf,
      tolerance: 0.5,
      maxIterations: 10,
    }

    // Запускаем VMAF поиск (с поддержкой preferCpu из профиля)
    const preferCpu = profile.preferCpu ?? false
    const result = await findOptimalCQ(
      sampleFile.path,
      videoOptions,
      vmafOptions,
      (progress: CqSearchProgress) => {
        // Обновляем прогресс item
        const vmafProgress: ImportQueueVmafProgress = {
          ...progress,
          lastVmaf: progress.lastVmaf,
        }
        this.updateVmafProgress(itemId, vmafProgress)
      },
      preferCpu,
    )

    console.log(
      `[ImportQueueController] VMAF completed for "${animeName}": optimalCq=${result.optimalCq}, vmaf=${result.vmafScore}, time=${result.totalTime}ms`,
    )

    // Сохраняем результат
    const vmafResult: ImportQueueVmafResult = {
      optimalCq: result.optimalCq,
      vmafScore: result.vmafScore,
      iterations: result.iterations,
      totalTime: result.totalTime,
      useCpuFallback: result.useCpuFallback,
    }
    this.setVmafResult(itemId, vmafResult)

    // Переходим к preparing
    this.updateItemStatus(itemId, 'preparing')
  }

  // ==========================================
  // === Отправка событий ===
  // ==========================================

  /**
   * Отправить событие всем окнам
   */
  private emit2Windows(event: string, ...args: unknown[]): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(event, ...args)
      }
    }
  }

  /**
   * Отправить полное состояние
   */
  private emitStateChanged(): void {
    this.emit2Windows('import-queue:state-changed', this.getState())
  }

  /**
   * Отправить изменение статуса item
   */
  private emitItemStatus(itemId: string, status: ImportQueueStatus, error?: string): void {
    this.emit2Windows('import-queue:item-status', { itemId, status, error })
  }

  /**
   * Отправить изменение прогресса item
   */
  private emitItemProgress(
    itemId: string,
    progress: number,
    currentFileName?: string,
    currentStage?: string,
    detailProgress?: ImportQueueDetailProgress,
    vmafProgress?: ImportQueueVmafProgress,
  ): void {
    this.emit2Windows('import-queue:item-progress', {
      itemId,
      progress,
      currentFileName,
      currentStage,
      detailProgress,
      vmafProgress,
    })
  }

  // ==========================================
  // === Очистка ===
  // ==========================================

  /**
   * Очистить завершённые items
   */
  clearCompleted(): void {
    const toRemove: string[] = []
    for (const [id, item] of this.queue) {
      if (item.status === 'completed' || item.status === 'error' || item.status === 'cancelled') {
        toRemove.push(id)
      }
    }

    for (const id of toRemove) {
      this.queue.delete(id)
      this.lastItemProgressEmit.delete(id) // Очистка throttle Map
    }

    if (toRemove.length > 0) {
      console.log(`[ImportQueueController] Cleared ${toRemove.length} completed items`)
      this.emitStateChanged()
    }
  }

  /**
   * Полная очистка
   */
  clearAll(): void {
    if (this.currentId) {
      console.warn('[ImportQueueController] Cannot clear while processing')
      return
    }

    this.queue.clear()
    this.lastItemProgressEmit.clear() // Очистка throttle Map
    this.currentId = null
    this.priorityCounter = 0
    this.emitStateChanged()
  }
}

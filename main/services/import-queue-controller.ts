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
import { prisma } from '../utils/db'
import { createModuleLogger } from '../utils/logger'

const log = createModuleLogger('ImportQueue')

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
    log.info('Initialized')
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
        log.warn('Item already in queue, skipping', { path: entry.folderPath })
        continue
      }

      this.queue.set(id, entry)
      log.info('Added item', { id, anime: entry.selectedAnime.russian || entry.selectedAnime.name })
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
      log.info('Queue already processing')
      return
    }

    this.isPaused = false
    this.processNext().catch((err) => log.error('processNext error', { error: String(err) }))
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
      this.processNext().catch((err) => log.error('processNext error', { error: String(err) }))
    }
    this.emitStateChanged()
  }

  /**
   * Отменить item
   */
  cancelItem(itemId: string): void {
    const item = this.queue.get(itemId)
    if (!item) {
      log.warn('Item not found', { itemId })
      return
    }

    // Если это текущий обрабатываемый — отменяем и переходим к следующему
    if (this.currentId === itemId) {
      this.updateItemStatus(itemId, 'cancelled')
      this.currentId = null
      this.processNext().catch((err) => log.error('processNext error', { error: String(err) }))
    } else {
      this.updateItemStatus(itemId, 'cancelled')
    }
  }

  /**
   * Удалить item из очереди
   */
  removeItem(itemId: string): void {
    if (this.currentId === itemId) {
      log.warn('Cannot remove currently processing item', { itemId })
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
      log.warn('Item not found for retry', { itemId })
      return
    }

    // Можно повторять только error или cancelled items
    if (item.status !== 'error' && item.status !== 'cancelled') {
      log.warn('Cannot retry item with this status', { itemId, status: item.status })
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

    log.info('Retrying item', { itemId, anime: item.selectedAnime.russian || item.selectedAnime.name })

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
      log.warn('Cannot reorder: item not found')
      return
    }

    // Можно переупорядочивать только pending items
    if (activeItem.status !== 'pending' || overItem.status !== 'pending') {
      log.warn('Cannot reorder: only pending items can be reordered')
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
    log.info('Reordered item', { activeId, newIndex })
  }

  /**
   * Отменить всю очередь
   */
  cancelAll(): void {
    // Отменяем все pending и processing items
    for (const [id, item] of this.queue) {
      if (
        item.status === 'pending'
        || item.status === 'vmaf'
        || item.status === 'preparing'
        || item.status === 'transcoding'
      ) {
        item.status = 'cancelled'
        item.completedAt = new Date().toISOString()
        this.emitItemStatus(id, 'cancelled')
      }
    }

    this.currentId = null
    this.emitStateChanged()
    log.info('All items cancelled')
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
      log.warn('Item not found for status update', { itemId })
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

    log.info('Item status changed', { itemId, from: prevStatus, to: status })
    this.emitItemStatus(itemId, status, error)

    // Если завершён — переходим к следующему
    if (status === 'completed' || status === 'error' || status === 'cancelled') {
      if (this.currentId === itemId) {
        this.currentId = null
        if (!this.isPaused) {
          this.processNext().catch((err) => log.error('processNext error', { error: String(err) }))
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
        // Видео воркеры: показываем все (включая завершённые) для наглядности
        videoWorkers: detailProgress.videoWorkers,
        // Аудио воркеры: показываем все (включая завершённые) для наглядности
        audioWorkers: detailProgress.audioWorkers,
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
      log.warn('Item not found for update', { itemId })
      return
    }

    // Нельзя редактировать текущий обрабатываемый item
    if (this.currentId === itemId) {
      log.warn('Cannot update currently processing item', { itemId })
      return
    }

    // Нельзя редактировать завершённые items
    if (['completed', 'error', 'cancelled'].includes(item.status)) {
      log.warn('Cannot update completed/error/cancelled item', { itemId })
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

    log.info('Updated item', { itemId })
    this.emitStateChanged()
  }

  // ==========================================
  // === Внутренняя логика ===
  // ==========================================

  /**
   * Обработать следующий item в очереди
   */
  private async processNext(): Promise<void> {
    if (this.isPaused) {
      log.info('Queue is paused, not processing next')
      return
    }

    // Найти следующий pending item
    const pending = [...this.queue.values()]
      .filter((i) => i.status === 'pending')
      .sort((a, b) => a.priority - b.priority)

    if (pending.length === 0) {
      log.info('No pending items')
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

    // Получаем глобальные настройки и сохраняем в item для renderer
    const globalSettings = await this.getGlobalSettings()
    next.globalUseGpu = globalSettings?.useGpu ?? true

    // Блокируем спящий режим при старте обработки
    setPowerSaveTranscoding(true)

    log.info('Processing next item', {
      id: next.id,
      anime: next.selectedAnime.russian || next.selectedAnime.name,
      globalUseGpu: next.globalUseGpu,
    })

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
        log.error('VMAF failed', { itemId: next.id, error: String(err) })
        this.updateItemStatus(next.id, 'error', err instanceof Error ? err.message : String(err))
      })
    }
  }

  /**
   * Получить глобальные настройки приложения
   */
  private async getGlobalSettings(): Promise<{ useGpu: boolean } | null> {
    try {
      const settings = await prisma.settings.findFirst()
      log.info('Global settings loaded', { useGpu: settings?.useGpu, hasSettings: !!settings })
      return settings ? { useGpu: settings.useGpu } : null
    } catch (err) {
      log.warn('Failed to get global settings', { error: String(err) })
      return null
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

    // Получаем глобальные настройки для проверки useGpu
    const globalSettings = await this.getGlobalSettings()

    // Определяем режим кодирования:
    // 1. profile.preferCpu — принудительно CPU в профиле
    // 2. !profile.useGpu — GPU отключен в профиле
    // 3. globalSettings?.useGpu === false — GPU отключен глобально
    const shouldUseCpu = profile.preferCpu || !profile.useGpu || globalSettings?.useGpu === false

    const animeName = item.selectedAnime.russian || item.selectedAnime.name
    const encodingMode = shouldUseCpu ? 'CPU' : 'GPU'
    log.info('Starting VMAF', {
      animeName,
      targetVmaf: item.vmafSettings.targetVmaf,
      encoding: encodingMode,
      reason: profile.preferCpu
        ? 'preferCpu'
        : !profile.useGpu
        ? 'profile.useGpu=false'
        : globalSettings?.useGpu === false
        ? 'settings.useGpu=false'
        : 'GPU enabled',
    })

    // Формируем videoOptions из профиля
    // ВАЖНО: если глобально GPU отключен, переопределяем useGpu в опциях
    const videoOptions = {
      codec: profile.codec.toLowerCase() as 'av1' | 'hevc' | 'h264',
      useGpu: !shouldUseCpu, // Учитываем глобальную настройку
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

    // Запускаем VMAF поиск (preferCpu если нужно использовать CPU)
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
      shouldUseCpu,
    )

    log.info('VMAF completed', {
      animeName,
      optimalCq: result.optimalCq,
      vmaf: result.vmafScore,
      timeMs: result.totalTime,
    })

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
      log.info('Cleared completed items', { count: toRemove.length })
      this.emitStateChanged()
    }
  }

  /**
   * Полная очистка
   */
  clearAll(): void {
    if (this.currentId) {
      log.warn('Cannot clear while processing')
      return
    }

    this.queue.clear()
    this.lastItemProgressEmit.clear() // Очистка throttle Map
    this.currentId = null
    this.priorityCounter = 0
    this.emitStateChanged()
  }
}

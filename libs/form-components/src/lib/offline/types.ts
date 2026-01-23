/**
 * Типы для оффлайн-функциональности форм
 */

// ============================================
// РАСШИРЯЕМЫЕ ТИПЫ ДЕЙСТВИЙ
// ============================================

/**
 * Базовые типы действий синхронизации
 */
export type BaseSyncActionType = 'FORM_SUBMIT' | 'FORM_UPDATE' | 'FORM_DELETE'

/**
 * Реестр для расширения типов действий в приложениях
 *
 * @example В приложении:
 * ```ts
 * declare module '@lena/form-components/offline' {
 *   interface SyncActionTypeRegistry {
 *     'BOOK_LESSON': true
 *     'UPDATE_PROFILE': true
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface SyncActionTypeRegistry {}

/**
 * Все доступные типы действий (базовые + расширенные)
 */
export type SyncActionType = BaseSyncActionType | keyof SyncActionTypeRegistry | (string & {})

// ============================================
// ДЕЙСТВИЯ И ОЧЕРЕДЬ
// ============================================

/**
 * Действие для синхронизации
 */
export interface SyncAction {
  type: SyncActionType
  payload: Record<string, unknown>
}

/**
 * Статус элемента очереди
 */
export type SyncItemStatus = 'PENDING' | 'SYNCED' | 'FAILED'

/**
 * Элемент очереди синхронизации
 */
export interface SyncQueueItem {
  id: string
  action: SyncAction
  createdAt: number
  attempts: number
  maxAttempts: number
  status: SyncItemStatus
  error?: string
}

/**
 * Результат обработки элемента очереди
 */
export interface ProcessQueueResult {
  success: boolean
  item?: SyncQueueItem
  error?: string
}

/**
 * Обработчик действия синхронизации
 */
export type SyncActionHandler = (action: SyncAction) => Promise<{ success: boolean; error?: string }>

// ============================================
// STORE ТИПЫ
// ============================================

/**
 * Store очереди синхронизации
 */
export interface SyncQueueStore {
  getQueue: () => SyncQueueItem[]
  getQueueLength: () => number
  subscribe: (listener: () => void) => () => void
  initialize: () => Promise<void>
  add: (action: SyncAction) => Promise<SyncQueueItem>
  remove: (id: string) => Promise<boolean>
  processAll: (handler: SyncActionHandler) => Promise<ProcessQueueResult[]>
}

// ============================================
// ХУКИ ТИПЫ
// ============================================

/**
 * Результат оффлайн отправки формы
 */
export interface OfflineSubmitResult {
  /** Успешно ли выполнено действие */
  success: boolean
  /** Сообщение об ошибке */
  error?: string
  /** Было ли действие добавлено в очередь (оффлайн) */
  queued?: boolean
  /** ID элемента в очереди */
  queueItemId?: string
}

/**
 * Обработчик отправки формы
 */
export type FormSubmitHandler<T> = (value: T) => Promise<{ success: boolean; error?: string }>

/**
 * Опции хука useOfflineForm
 */
export interface UseOfflineFormOptions<T> {
  /** Тип действия для очереди синхронизации */
  actionType: SyncActionType
  /** Обработчик онлайн отправки */
  onlineSubmit: FormSubmitHandler<T>
  /** Callback при успешной отправке */
  onSuccess?: () => void
  /** Callback при добавлении в очередь */
  onQueued?: () => void
  /** Callback при ошибке */
  onError?: (error: string) => void
}

/**
 * Результат хука useOfflineForm
 */
export interface UseOfflineFormResult<T> {
  /** Функция отправки формы */
  submit: (value: T) => Promise<OfflineSubmitResult>
  /** Текущий статус оффлайн */
  isOffline: boolean
  /** Количество ожидающих синхронизации действий */
  pendingCount: number
  /** Общее количество элементов в очереди */
  queueLength: number
  /** Идёт ли обработка очереди */
  isProcessing: boolean
  /** Время последней попытки синхронизации */
  lastSyncAttempt: number | null
}

/**
 * Результат хука useSyncQueue
 */
export interface UseSyncQueueResult {
  /** Элементы очереди */
  queue: SyncQueueItem[]
  /** Количество элементов в очереди */
  queueLength: number
  /** Только pending элементы */
  pendingCount: number
  /** Загружается ли очередь из IndexedDB */
  isLoading: boolean
  /** Обрабатывается ли очередь */
  isProcessing: boolean
  /** Добавить действие в очередь */
  addAction: (action: SyncAction) => Promise<SyncQueueItem>
  /** Удалить действие из очереди */
  removeAction: (id: string) => Promise<boolean>
  /** Обработать всю очередь */
  processQueue: (handler: SyncActionHandler) => Promise<ProcessQueueResult[]>
}

// ============================================
// КОМПОНЕНТЫ ТИПЫ
// ============================================

/**
 * Конфигурация оффлайн режима для Form
 */
export interface FormOfflineConfig {
  /** Тип действия для очереди синхронизации */
  actionType: SyncActionType
  /** Ключ для хранения очереди (опционально) */
  storageKey?: string
  /** Callback при добавлении в очередь */
  onQueued?: () => void
  /** Callback при успешной синхронизации */
  onSynced?: () => void
  /** Callback при ошибке синхронизации */
  onSyncError?: (error: string) => void
}

/**
 * Props для Form.OfflineIndicator
 */
export interface OfflineIndicatorProps {
  /** Текст индикатора */
  label?: string
  /** Цветовая палитра */
  colorPalette?: string
  /** Вариант отображения */
  variant?: 'subtle' | 'solid' | 'outline'
}

/**
 * Props для Form.SyncStatus
 */
export interface SyncStatusProps {
  /** Показывать когда очередь пуста */
  showWhenEmpty?: boolean
  /** Текст при синхронизации */
  syncingLabel?: string
  /** Текст ожидающих элементов */
  pendingLabel?: string | ((count: number) => string)
  /** Текст когда синхронизировано */
  syncedLabel?: string
  /** Цветовая палитра */
  colorPalette?: string
}

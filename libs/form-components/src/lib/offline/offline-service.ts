/**
 * Сервис оффлайн-функциональности
 *
 * Бизнес-логика:
 * - Определение статуса онлайн/оффлайн
 * - Очередь синхронизации действий в IndexedDB
 */

import type { ProcessQueueResult, SyncAction, SyncActionHandler, SyncQueueItem, SyncQueueStore } from './types'

// ============================================
// ЛЕНИВЫЙ ИМПОРТ IDB-KEYVAL
// ============================================

/**
 * Проверка, что мы в браузере с поддержкой IndexedDB
 */
function canUseIDB(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
}

/**
 * Ленивый импорт idb-keyval для избежания SSR проблем
 * Кэшируем промис для предотвращения повторных импортов
 */
let idbModule: typeof import('idb-keyval') | null = null
async function getIDB(): Promise<typeof import('idb-keyval') | null> {
  if (!canUseIDB()) {
    return null
  }
  if (!idbModule) {
    idbModule = await import('idb-keyval')
  }
  return idbModule
}

// ============================================
// КОНСТАНТЫ
// ============================================

const DEFAULT_SYNC_QUEUE_STORAGE_KEY = 'lena-form-sync-queue'

// ============================================
// СТАТУС СОЕДИНЕНИЯ
// ============================================

/**
 * Получить текущий статус оффлайн
 * @returns true если оффлайн, false если онлайн
 */
export function getOfflineStatus(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }
  return !navigator.onLine
}

/**
 * Подписаться на изменения статуса соединения
 * @param callback - функция, вызываемая при изменении статуса
 * @returns функция отписки
 */
export function subscribeToStatusChanges(callback: (isOffline: boolean) => void): () => void {
  if (typeof window === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {}
  }

  const handleOnline = () => callback(false)
  const handleOffline = () => callback(true)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

// ============================================
// ОЧЕРЕДЬ СИНХРОНИЗАЦИИ
// ============================================

/**
 * Генерация уникального ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Получить очередь из IndexedDB
 */
export async function getQueueFromStorage(storageKey?: string): Promise<SyncQueueItem[]> {
  try {
    const idb = await getIDB()
    if (!idb) {
      return []
    }
    const key = storageKey ?? DEFAULT_SYNC_QUEUE_STORAGE_KEY
    const stored = await idb.get<SyncQueueItem[]>(key)
    return stored ?? []
  } catch (error) {
    console.error('[OfflineService] Ошибка загрузки очереди из IndexedDB:', error)
    return []
  }
}

/**
 * Сохранить очередь в IndexedDB
 */
async function saveQueueToStorage(queue: SyncQueueItem[], storageKey?: string): Promise<void> {
  try {
    const idb = await getIDB()
    if (!idb) {
      return
    }
    const key = storageKey ?? DEFAULT_SYNC_QUEUE_STORAGE_KEY
    await idb.set(key, queue)
  } catch (error) {
    console.error('[OfflineService] Ошибка сохранения очереди в IndexedDB:', error)
  }
}

/**
 * Добавить действие в очередь
 */
export async function addToQueue(action: SyncAction, storageKey?: string): Promise<SyncQueueItem> {
  const queue = await getQueueFromStorage(storageKey)

  const item: SyncQueueItem = {
    id: generateId(),
    action,
    createdAt: Date.now(),
    attempts: 0,
    maxAttempts: 3,
    status: 'PENDING',
  }

  queue.push(item)
  await saveQueueToStorage(queue, storageKey)

  return item
}

/**
 * Удалить элемент из очереди
 */
export async function removeFromQueue(id: string, storageKey?: string): Promise<boolean> {
  const queue = await getQueueFromStorage(storageKey)
  const index = queue.findIndex((item) => item.id === id)

  if (index === -1) {
    return false
  }

  queue.splice(index, 1)
  await saveQueueToStorage(queue, storageKey)

  return true
}

/**
 * Обработать один элемент очереди
 */
export async function processQueueItem(item: SyncQueueItem, handler: SyncActionHandler): Promise<ProcessQueueResult> {
  try {
    const result = await handler(item.action)

    if (result.success) {
      return {
        success: true,
        item: { ...item, status: 'SYNCED' as const },
      }
    }

    // Неуспешный результат без исключения
    const updatedItem: SyncQueueItem = {
      ...item,
      attempts: item.attempts + 1,
      status: item.attempts + 1 >= item.maxAttempts ? 'FAILED' : 'PENDING',
      error: result.error,
    }

    return {
      success: false,
      item: updatedItem,
      error: result.error,
    }
  } catch (error) {
    // Исключение при выполнении
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const updatedItem: SyncQueueItem = {
      ...item,
      attempts: item.attempts + 1,
      status: item.attempts + 1 >= item.maxAttempts ? 'FAILED' : 'PENDING',
      error: errorMessage,
    }

    return {
      success: false,
      item: updatedItem,
      error: errorMessage,
    }
  }
}

/**
 * Очистить очередь
 */
export async function clearQueue(storageKey?: string): Promise<void> {
  try {
    const idb = await getIDB()
    if (!idb) {
      return
    }
    const key = storageKey ?? DEFAULT_SYNC_QUEUE_STORAGE_KEY
    await idb.del(key)
  } catch (error) {
    console.error('[OfflineService] Ошибка очистки очереди из IndexedDB:', error)
  }
}

/**
 * Создать store для очереди синхронизации
 */
export function createSyncQueueStore(storageKey?: string): SyncQueueStore {
  let queue: SyncQueueItem[] = []
  const listeners = new Set<() => void>()
  const key = storageKey ?? DEFAULT_SYNC_QUEUE_STORAGE_KEY

  const notifyListeners = () => {
    listeners.forEach((listener) => listener())
  }

  return {
    getQueue: () => queue,

    getQueueLength: () => queue.length,

    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    initialize: async () => {
      queue = await getQueueFromStorage(key)
      notifyListeners()
    },

    add: async (action: SyncAction) => {
      const item = await addToQueue(action, key)
      queue.push(item)
      notifyListeners()
      return item
    },

    remove: async (id: string) => {
      const result = await removeFromQueue(id, key)
      if (result) {
        queue = queue.filter((item) => item.id !== id)
        notifyListeners()
      }
      return result
    },

    processAll: async (handler: SyncActionHandler) => {
      const results: ProcessQueueResult[] = []

      for (const item of queue) {
        if (item.status === 'PENDING') {
          const result = await processQueueItem(item, handler)
          results.push(result)

          // Обновляем очередь после обработки
          if (result.success && result.item) {
            await removeFromQueue(item.id, key)
            queue = queue.filter((q) => q.id !== item.id)
          } else if (result.item) {
            // Обновляем элемент в очереди
            const index = queue.findIndex((q) => q.id === item.id)
            if (index !== -1) {
              queue[index] = result.item
            }
            await saveQueueToStorage(queue, key)
          }
        }
      }

      notifyListeners()
      return results
    },
  }
}

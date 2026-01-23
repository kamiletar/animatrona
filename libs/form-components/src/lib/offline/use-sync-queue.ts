'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import { createSyncQueueStore } from './offline-service'
import type { ProcessQueueResult, SyncAction, SyncActionHandler, SyncQueueItem, UseSyncQueueResult } from './types'
import { useOfflineStatus } from './use-offline-status'

// Глобальный store для очереди синхронизации (по умолчанию)
const defaultSyncQueueStore = createSyncQueueStore()
const EMPTY_QUEUE: SyncQueueItem[] = []

// Флаг инициализации
let initialized = false

const initialize = async () => {
  if (!initialized && typeof window !== 'undefined') {
    initialized = true
    await defaultSyncQueueStore.initialize()
  }
}

/**
 * Хук для работы с очередью синхронизации
 *
 * Позволяет добавлять действия в очередь при оффлайн режиме
 * и синхронизировать их при восстановлении соединения.
 *
 * @example
 * ```tsx
 * import { useSyncQueue } from '@lena/form-components/offline'
 *
 * function MyComponent() {
 *   const { queue, queueLength, addAction, processQueue, isProcessing } = useSyncQueue()
 *
 *   // Добавление действия в очередь (работает и оффлайн)
 *   const handleBookLesson = async (slotId: string) => {
 *     if (isOffline) {
 *       await addAction({ type: 'BOOK_LESSON', payload: { slotId } })
 *       toast({ title: 'Действие добавлено в очередь синхронизации' })
 *     } else {
 *       await api.bookLesson(slotId)
 *     }
 *   }
 *
 *   // Обработка очереди при восстановлении соединения
 *   useEffect(() => {
 *     if (!isOffline && queueLength > 0) {
 *       processQueue(async (action) => {
 *         switch (action.type) {
 *           case 'BOOK_LESSON':
 *             return api.bookLesson(action.payload.slotId)
 *           // ... другие типы действий
 *         }
 *       })
 *     }
 *   }, [isOffline, queueLength, processQueue])
 * }
 * ```
 */
export function useSyncQueue(): UseSyncQueueResult {
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const isOffline = useOfflineStatus()

  // Подписка на изменения очереди
  const queue = useSyncExternalStore(
    (callback) => defaultSyncQueueStore.subscribe(callback),
    () => defaultSyncQueueStore.getQueue(),
    () => EMPTY_QUEUE // SSR fallback
  )

  // Инициализация при монтировании
  useEffect(() => {
    initialize().then(() => {
      setIsLoading(false)
    })
  }, [])

  // Добавление действия в очередь
  const addAction = useCallback(async (action: SyncAction): Promise<SyncQueueItem> => {
    return defaultSyncQueueStore.add(action)
  }, [])

  // Удаление действия из очереди
  const removeAction = useCallback(async (id: string): Promise<boolean> => {
    return defaultSyncQueueStore.remove(id)
  }, [])

  // Обработка всей очереди
  const processQueue = useCallback(
    async (handler: SyncActionHandler): Promise<ProcessQueueResult[]> => {
      if (isOffline) {
        console.warn('[SyncQueue] Невозможно обработать очередь в оффлайн режиме')
        return []
      }

      setIsProcessing(true)
      try {
        return await defaultSyncQueueStore.processAll(handler)
      } finally {
        setIsProcessing(false)
      }
    },
    [isOffline]
  )

  return {
    queue,
    queueLength: queue.length,
    pendingCount: queue.filter((item) => item.status === 'PENDING').length,
    isLoading,
    isProcessing,
    addAction,
    removeAction,
    processQueue,
  }
}

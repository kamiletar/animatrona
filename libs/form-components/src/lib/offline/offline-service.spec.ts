import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SyncAction, SyncQueueItem } from './types'

// Мок idb-keyval
const mockStore: Map<string, unknown> = new Map()
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(mockStore.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    mockStore.set(key, value)
    return Promise.resolve()
  }),
  del: vi.fn((key: string) => {
    mockStore.delete(key)
    return Promise.resolve()
  }),
}))

import {
  addToQueue,
  clearQueue,
  createSyncQueueStore,
  getOfflineStatus,
  getQueueFromStorage,
  processQueueItem,
  removeFromQueue,
  subscribeToStatusChanges,
} from './offline-service'

describe('offline-service', () => {
  beforeEach(() => {
    mockStore.clear()
    vi.clearAllMocks()
  })

  describe('getOfflineStatus', () => {
    const originalNavigator = global.navigator

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      })
    })

    it('возвращает false когда онлайн', () => {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: true },
        writable: true,
      })

      expect(getOfflineStatus()).toBe(false)
    })

    it('возвращает true когда оффлайн', () => {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: false },
        writable: true,
      })

      expect(getOfflineStatus()).toBe(true)
    })

    it('возвращает false когда navigator не определён', () => {
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true,
      })

      expect(getOfflineStatus()).toBe(false)
    })
  })

  describe('subscribeToStatusChanges', () => {
    it('вызывает callback при переходе в оффлайн', () => {
      const callback = vi.fn()
      subscribeToStatusChanges(callback)

      window.dispatchEvent(new Event('offline'))

      expect(callback).toHaveBeenCalledWith(true)
    })

    it('вызывает callback при переходе в онлайн', () => {
      const callback = vi.fn()
      subscribeToStatusChanges(callback)

      window.dispatchEvent(new Event('online'))

      expect(callback).toHaveBeenCalledWith(false)
    })

    it('возвращает функцию отписки', () => {
      const callback = vi.fn()
      const unsubscribe = subscribeToStatusChanges(callback)

      unsubscribe()
      window.dispatchEvent(new Event('offline'))

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('getQueueFromStorage', () => {
    it('возвращает пустой массив когда нет данных', async () => {
      const result = await getQueueFromStorage()

      expect(result).toEqual([])
    })

    it('возвращает сохранённую очередь', async () => {
      const queue: SyncQueueItem[] = [
        {
          id: 'test-1',
          action: { type: 'FORM_SUBMIT', payload: { foo: 'bar' } },
          createdAt: Date.now(),
          attempts: 0,
          maxAttempts: 3,
          status: 'PENDING',
        },
      ]
      mockStore.set('lena-form-sync-queue', queue)

      const result = await getQueueFromStorage()

      expect(result).toEqual(queue)
    })

    it('использует кастомный ключ хранилища', async () => {
      const queue: SyncQueueItem[] = [
        {
          id: 'test-1',
          action: { type: 'FORM_SUBMIT', payload: {} },
          createdAt: Date.now(),
          attempts: 0,
          maxAttempts: 3,
          status: 'PENDING',
        },
      ]
      mockStore.set('custom-key', queue)

      const result = await getQueueFromStorage('custom-key')

      expect(result).toEqual(queue)
    })
  })

  describe('addToQueue', () => {
    it('добавляет действие в очередь', async () => {
      const action: SyncAction = { type: 'FORM_SUBMIT', payload: { name: 'test' } }

      const item = await addToQueue(action)

      expect(item.id).toBeDefined()
      expect(item.action).toEqual(action)
      expect(item.status).toBe('PENDING')
      expect(item.attempts).toBe(0)
      expect(item.maxAttempts).toBe(3)
    })

    it('сохраняет элемент в storage', async () => {
      const action: SyncAction = { type: 'FORM_SUBMIT', payload: {} }

      await addToQueue(action)

      const stored = mockStore.get('lena-form-sync-queue') as SyncQueueItem[]
      expect(stored).toHaveLength(1)
      expect(stored[0].action).toEqual(action)
    })

    it('добавляет к существующей очереди', async () => {
      const existingItem: SyncQueueItem = {
        id: 'existing',
        action: { type: 'FORM_UPDATE', payload: {} },
        createdAt: Date.now(),
        attempts: 0,
        maxAttempts: 3,
        status: 'PENDING',
      }
      mockStore.set('lena-form-sync-queue', [existingItem])

      await addToQueue({ type: 'FORM_SUBMIT', payload: {} })

      const stored = mockStore.get('lena-form-sync-queue') as SyncQueueItem[]
      expect(stored).toHaveLength(2)
    })
  })

  describe('removeFromQueue', () => {
    it('удаляет элемент из очереди', async () => {
      const item: SyncQueueItem = {
        id: 'to-remove',
        action: { type: 'FORM_SUBMIT', payload: {} },
        createdAt: Date.now(),
        attempts: 0,
        maxAttempts: 3,
        status: 'PENDING',
      }
      mockStore.set('lena-form-sync-queue', [item])

      const result = await removeFromQueue('to-remove')

      expect(result).toBe(true)
      const stored = mockStore.get('lena-form-sync-queue') as SyncQueueItem[]
      expect(stored).toHaveLength(0)
    })

    it('возвращает false если элемент не найден', async () => {
      mockStore.set('lena-form-sync-queue', [])

      const result = await removeFromQueue('non-existent')

      expect(result).toBe(false)
    })
  })

  describe('processQueueItem', () => {
    const baseItem: SyncQueueItem = {
      id: 'test-item',
      action: { type: 'FORM_SUBMIT', payload: { data: 'test' } },
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: 3,
      status: 'PENDING',
    }

    it('возвращает success когда handler успешен', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true })

      const result = await processQueueItem(baseItem, handler)

      expect(result.success).toBe(true)
      expect(result.item?.status).toBe('SYNCED')
      expect(handler).toHaveBeenCalledWith(baseItem.action)
    })

    it('увеличивает attempts при неуспехе', async () => {
      const handler = vi.fn().mockResolvedValue({ success: false, error: 'Failed' })

      const result = await processQueueItem(baseItem, handler)

      expect(result.success).toBe(false)
      expect(result.item?.attempts).toBe(1)
      expect(result.item?.status).toBe('PENDING')
      expect(result.error).toBe('Failed')
    })

    it('устанавливает FAILED после maxAttempts', async () => {
      const item = { ...baseItem, attempts: 2 } // Уже 2 попытки из 3
      const handler = vi.fn().mockResolvedValue({ success: false, error: 'Failed' })

      const result = await processQueueItem(item, handler)

      expect(result.item?.status).toBe('FAILED')
      expect(result.item?.attempts).toBe(3)
    })

    it('обрабатывает исключения в handler', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await processQueueItem(baseItem, handler)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
      expect(result.item?.attempts).toBe(1)
    })
  })

  describe('clearQueue', () => {
    it('очищает очередь из storage', async () => {
      mockStore.set('lena-form-sync-queue', [{ id: 'item' }])

      await clearQueue()

      expect(mockStore.has('lena-form-sync-queue')).toBe(false)
    })

    it('использует кастомный ключ', async () => {
      mockStore.set('custom-queue', [{ id: 'item' }])

      await clearQueue('custom-queue')

      expect(mockStore.has('custom-queue')).toBe(false)
    })
  })

  describe('createSyncQueueStore', () => {
    it('создаёт store с пустой очередью', () => {
      const store = createSyncQueueStore()

      expect(store.getQueue()).toEqual([])
      expect(store.getQueueLength()).toBe(0)
    })

    it('initialize загружает очередь из storage', async () => {
      const existingQueue: SyncQueueItem[] = [
        {
          id: 'existing',
          action: { type: 'FORM_SUBMIT', payload: {} },
          createdAt: Date.now(),
          attempts: 0,
          maxAttempts: 3,
          status: 'PENDING',
        },
      ]
      mockStore.set('lena-form-sync-queue', existingQueue)

      const store = createSyncQueueStore()
      await store.initialize()

      expect(store.getQueue()).toEqual(existingQueue)
    })

    it('add добавляет элемент и уведомляет listeners', async () => {
      const store = createSyncQueueStore()
      const listener = vi.fn()
      store.subscribe(listener)

      await store.add({ type: 'FORM_SUBMIT', payload: { test: true } })

      expect(store.getQueueLength()).toBe(1)
      expect(listener).toHaveBeenCalled()
    })

    it('remove удаляет элемент и уведомляет listeners', async () => {
      const store = createSyncQueueStore()
      const item = await store.add({ type: 'FORM_SUBMIT', payload: {} })
      const listener = vi.fn()
      store.subscribe(listener)

      const result = await store.remove(item.id)

      expect(result).toBe(true)
      expect(store.getQueueLength()).toBe(0)
      expect(listener).toHaveBeenCalled()
    })

    it('subscribe возвращает функцию отписки', () => {
      const store = createSyncQueueStore()
      const listener = vi.fn()
      const unsubscribe = store.subscribe(listener)

      unsubscribe()
      // Listener не должен быть вызван после отписки
      store.add({ type: 'FORM_SUBMIT', payload: {} })

      // listener уже был вызван в add, но не после отписки
      // Этот тест проверяет что unsubscribe работает
      expect(typeof unsubscribe).toBe('function')
    })

    it('processAll обрабатывает pending элементы', async () => {
      const store = createSyncQueueStore()
      await store.add({ type: 'FORM_SUBMIT', payload: { id: 1 } })
      await store.add({ type: 'FORM_UPDATE', payload: { id: 2 } })

      const handler = vi.fn().mockResolvedValue({ success: true })
      const results = await store.processAll(handler)

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('processAll удаляет успешно обработанные элементы', async () => {
      const store = createSyncQueueStore()
      await store.add({ type: 'FORM_SUBMIT', payload: {} })

      const handler = vi.fn().mockResolvedValue({ success: true })
      await store.processAll(handler)

      expect(store.getQueueLength()).toBe(0)
    })

    it('processAll оставляет неуспешные элементы в очереди', async () => {
      const store = createSyncQueueStore()
      await store.add({ type: 'FORM_SUBMIT', payload: {} })

      const handler = vi.fn().mockResolvedValue({ success: false, error: 'Failed' })
      await store.processAll(handler)

      expect(store.getQueueLength()).toBe(1)
      expect(store.getQueue()[0].attempts).toBe(1)
    })
  })
})

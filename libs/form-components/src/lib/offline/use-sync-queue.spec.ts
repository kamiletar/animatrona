import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SyncAction, SyncQueueItem, SyncQueueStore } from './types'

// Используем vi.hoisted для создания мок store до hoisting vi.mock
const { mockStore, resetMockStore, mockUseOfflineStatus } = vi.hoisted(() => {
  // Создаём мок store с реальной логикой
  function createMockStore(): SyncQueueStore & { _reset: () => void } {
    let queue: SyncQueueItem[] = []
    const listeners = new Set<() => void>()

    const notifyListeners = () => {
      listeners.forEach((listener) => listener())
    }

    return {
      _reset: () => {
        queue = []
        listeners.clear()
      },
      getQueue: () => queue,
      getQueueLength: () => queue.length,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      initialize: vi.fn().mockResolvedValue(undefined),
      add: vi.fn(async (action: SyncAction) => {
        const item: SyncQueueItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          action,
          createdAt: Date.now(),
          attempts: 0,
          maxAttempts: 3,
          status: 'PENDING',
        }
        queue.push(item)
        notifyListeners()
        return item
      }),
      remove: vi.fn(async (id: string) => {
        const index = queue.findIndex((item) => item.id === id)
        if (index === -1) {
          return false
        }
        queue.splice(index, 1)
        notifyListeners()
        return true
      }),
      processAll: vi.fn(async (handler) => {
        const results = []
        for (const item of [...queue]) {
          if (item.status === 'PENDING') {
            const result = await handler(item.action)
            if (result.success) {
              queue = queue.filter((q) => q.id !== item.id)
              results.push({ success: true, item: { ...item, status: 'SYNCED' as const } })
            } else {
              item.attempts++
              item.status = item.attempts >= item.maxAttempts ? 'FAILED' : 'PENDING'
              results.push({ success: false, item, error: result.error })
            }
          }
        }
        notifyListeners()
        return results
      }),
    }
  }

  const store = createMockStore()
  let isOffline = false

  return {
    mockStore: store,
    resetMockStore: () => store._reset(),
    mockUseOfflineStatus: {
      get: () => isOffline,
      set: (value: boolean) => {
        isOffline = value
      },
    },
  }
})

// Мок модулей
vi.mock('./offline-service', () => ({
  createSyncQueueStore: vi.fn(() => mockStore),
}))

vi.mock('./use-offline-status', () => ({
  useOfflineStatus: vi.fn(() => mockUseOfflineStatus.get()),
}))

// Импортируем после моков
import { useSyncQueue } from './use-sync-queue'

describe('useSyncQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockStore()
    mockUseOfflineStatus.set(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('возвращает начальное состояние', async () => {
      const { result } = renderHook(() => useSyncQueue())

      // Изначально очередь пустая
      expect(result.current.queue).toEqual([])
      expect(result.current.queueLength).toBe(0)
      expect(result.current.pendingCount).toBe(0)
      expect(result.current.isProcessing).toBe(false)
    })

    it('isLoading переходит в false после инициализации', async () => {
      const { result } = renderHook(() => useSyncQueue())

      // Изначально isLoading может быть true
      // После инициализации становится false
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('addAction', () => {
    it('добавляет действие в очередь', async () => {
      const { result } = renderHook(() => useSyncQueue())

      const action: SyncAction = { type: 'FORM_SUBMIT', payload: { name: 'test' } }

      await act(async () => {
        await result.current.addAction(action)
      })

      expect(mockStore.add).toHaveBeenCalledWith(action)
    })

    it('возвращает созданный элемент', async () => {
      const { result } = renderHook(() => useSyncQueue())

      const action: SyncAction = { type: 'FORM_UPDATE', payload: { id: 1 } }

      let item: SyncQueueItem | undefined
      await act(async () => {
        item = await result.current.addAction(action)
      })

      expect(item).toBeDefined()
      expect(item?.action).toEqual(action)
      expect(item?.status).toBe('PENDING')
    })
  })

  describe('removeAction', () => {
    it('удаляет действие из очереди', async () => {
      const { result } = renderHook(() => useSyncQueue())

      // Сначала добавляем элемент
      let item: SyncQueueItem | undefined
      await act(async () => {
        item = await result.current.addAction({ type: 'FORM_SUBMIT', payload: {} })
      })

      // Затем удаляем
      let removed = false
      await act(async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        removed = await result.current.removeAction(item!.id)
      })

      expect(removed).toBe(true)
      expect(mockStore.remove).toHaveBeenCalledWith(item?.id)
    })

    it('возвращает false если элемент не найден', async () => {
      const { result } = renderHook(() => useSyncQueue())

      let removed = false
      await act(async () => {
        removed = await result.current.removeAction('non-existent-id')
      })

      expect(removed).toBe(false)
    })
  })

  describe('processQueue', () => {
    it('обрабатывает очередь когда онлайн', async () => {
      const { result } = renderHook(() => useSyncQueue())

      // Добавляем элемент
      await act(async () => {
        await result.current.addAction({ type: 'FORM_SUBMIT', payload: { id: 1 } })
      })

      const handler = vi.fn().mockResolvedValue({ success: true })

      await act(async () => {
        await result.current.processQueue(handler)
      })

      expect(mockStore.processAll).toHaveBeenCalledWith(handler)
    })

    it('не обрабатывает когда оффлайн', async () => {
      // Устанавливаем оффлайн статус
      mockUseOfflineStatus.set(true)

      const { result } = renderHook(() => useSyncQueue())

      const handler = vi.fn()
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await act(async () => {
        const results = await result.current.processQueue(handler)
        expect(results).toEqual([])
      })

      expect(mockStore.processAll).not.toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalledWith('[SyncQueue] Невозможно обработать очередь в оффлайн режиме')

      consoleWarnSpy.mockRestore()
    })

    it('возвращает результаты обработки', async () => {
      const { result } = renderHook(() => useSyncQueue())

      await act(async () => {
        await result.current.addAction({ type: 'FORM_SUBMIT', payload: {} })
      })

      const handler = vi.fn().mockResolvedValue({ success: true })

      let results: unknown[] = []
      await act(async () => {
        results = await result.current.processQueue(handler)
      })

      // Должен вернуть результаты обработки
      expect(results).toHaveLength(1)
      expect(results[0]).toHaveProperty('success', true)
    })
  })

  describe('pendingCount', () => {
    it('считает только PENDING элементы', async () => {
      const { result } = renderHook(() => useSyncQueue())

      await act(async () => {
        await result.current.addAction({ type: 'FORM_SUBMIT', payload: { id: 1 } })
        await result.current.addAction({ type: 'FORM_UPDATE', payload: { id: 2 } })
      })

      expect(result.current.pendingCount).toBe(2)
    })
  })
})

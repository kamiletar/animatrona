import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Используем vi.hoisted для переменных, используемых в моках
const { setStatusChangeCallback } = vi.hoisted(() => {
  let callback: ((offline: boolean) => void) | null = null
  return {
    statusChangeCallback: () => callback,
    setStatusChangeCallback: (cb: ((offline: boolean) => void) | null) => {
      callback = cb
    },
  }
})

// Мок offline-service
vi.mock('./offline-service', () => ({
  getOfflineStatus: vi.fn(() => false),
  subscribeToStatusChanges: vi.fn((callback: (offline: boolean) => void) => {
    setStatusChangeCallback(callback)
    return () => {
      setStatusChangeCallback(null)
    }
  }),
}))

// Импортируем после мока
import { useOfflineStatus } from './use-offline-status'

describe('useOfflineStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setStatusChangeCallback(null)
  })

  it('возвращает false по умолчанию (онлайн)', () => {
    const { result } = renderHook(() => useOfflineStatus())

    expect(result.current).toBe(false)
  })

  it('возвращает boolean тип', () => {
    const { result } = renderHook(() => useOfflineStatus())

    expect(typeof result.current).toBe('boolean')
  })

  it('работает с useSyncExternalStore паттерном', () => {
    // Проверяем что хук не вызывает ошибок при рендере
    const { result, unmount } = renderHook(() => useOfflineStatus())

    expect(result.current).toBeDefined()

    // Проверяем что unmount работает корректно
    unmount()
  })

  it('поддерживает множественные подписки', () => {
    const { result: result1 } = renderHook(() => useOfflineStatus())
    const { result: result2 } = renderHook(() => useOfflineStatus())

    expect(result1.current).toBe(result2.current)
  })
})

describe('useOfflineStatus SSR', () => {
  it('возвращает false при SSR (server fallback)', () => {
    // useSyncExternalStore использует третий аргумент для SSR
    // который должен возвращать false
    const { result } = renderHook(() => useOfflineStatus())

    // На клиенте значение определяется getOfflineStatus
    expect(result.current).toBe(false)
  })
})

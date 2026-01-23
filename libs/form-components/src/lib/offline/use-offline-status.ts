'use client'

import { useSyncExternalStore } from 'react'

import { getOfflineStatus, subscribeToStatusChanges } from './offline-service'

// Глобальное состояние для синхронизации между вкладками
let isOffline = false

const listeners = new Set<() => void>()

const notifyListeners = () => {
  listeners.forEach((listener) => listener())
}

// Инициализация при первой загрузке
if (typeof window !== 'undefined') {
  isOffline = getOfflineStatus()

  subscribeToStatusChanges((offline) => {
    isOffline = offline
    notifyListeners()
  })
}

/**
 * Хук для определения статуса оффлайн
 *
 * @returns true если браузер оффлайн
 *
 * @example
 * ```tsx
 * import { useOfflineStatus } from '@lena/form-components/offline'
 *
 * function MyComponent() {
 *   const isOffline = useOfflineStatus()
 *
 *   if (isOffline) {
 *     return <OfflineBanner />
 *   }
 *
 *   return <OnlineContent />
 * }
 * ```
 */
export function useOfflineStatus(): boolean {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback)
      return () => {
        listeners.delete(callback)
      }
    },
    () => isOffline,
    () => false // SSR fallback — считаем что онлайн
  )
}

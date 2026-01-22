/**
 * Hook для управления уведомлениями об обновлениях
 *
 * Отслеживает изменения состояния обновлений в store
 * и показывает соответствующие toast-уведомления
 */

'use client'

import { toaster } from '@/components/ui/toaster'
import { useEffect, useRef } from 'react'
import { useUpdateStore } from './update-store'

/**
 * Hook для автоматического показа уведомлений об обновлениях
 *
 * @example
 * ```tsx
 * function Layout() {
 *   useUpdateNotifications()
 *   return <>{children}</>
 * }
 * ```
 */
export function useUpdateNotifications() {
  const status = useUpdateStore((state) => state.status)
  const preferences = useUpdateStore((state) => state.preferences)
  const setDrawerOpen = useUpdateStore((state) => state.setDrawerOpen)
  const skippedVersions = useUpdateStore((state) => state.skippedVersions)

  // Отслеживаем уже показанные версии, чтобы не показывать дважды
  const shownVersions = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Если уведомления отключены, ничего не делаем
    if (!preferences.showNotifications) {
      return
    }

    const { status: updateStatus, updateInfo, error } = status

    // Update Available
    if (updateStatus === 'available' && updateInfo) {
      const version = updateInfo.version

      // Проверяем, не пропущена ли версия и не показывали ли уже
      if (skippedVersions.includes(version) || shownVersions.current.has(version)) {
        return
      }

      // Отмечаем как показанную
      shownVersions.current.add(version)

      // Показываем toast
      toaster.create({
        title: `Доступно обновление v${version}`,
        description: updateInfo.releaseNotes?.split('\n')[0] || 'Исправления ошибок и улучшения',
        type: 'info',
        duration: 10000, // 10 секунд
        action: {
          label: 'Подробнее',
          onClick: () => setDrawerOpen(true),
        },
        meta: {
          closable: true,
        },
      })
    }

    // Download Complete
    if (updateStatus === 'downloaded' && updateInfo) {
      const version = updateInfo.version
      const downloadedKey = `downloaded-${version}`

      if (shownVersions.current.has(downloadedKey)) {
        return
      }

      shownVersions.current.add(downloadedKey)

      toaster.create({
        title: `Обновление v${version} готово`,
        description: 'Приложение будет перезапущено для установки',
        type: 'success',
        duration: 15000, // 15 секунд
        action: {
          label: 'Установить',
          onClick: async () => {
            if (window.electron?.updater) {
              await window.electron.updater.install()
            }
          },
        },
        meta: {
          closable: true,
        },
      })
    }

    // Error
    if (updateStatus === 'error' && error) {
      const errorKey = `error-${error}`

      if (shownVersions.current.has(errorKey)) {
        return
      }

      shownVersions.current.add(errorKey)

      toaster.create({
        title: 'Ошибка обновления',
        description: error,
        type: 'error',
        duration: 8000,
        meta: {
          closable: true,
        },
      })
    }
  }, [status, preferences.showNotifications, setDrawerOpen, skippedVersions])

  // Очистка shownVersions при изменении preferences
  useEffect(() => {
    if (!preferences.showNotifications) {
      shownVersions.current.clear()
    }
  }, [preferences.showNotifications])
}

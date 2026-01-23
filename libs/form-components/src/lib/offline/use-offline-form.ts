'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { OfflineSubmitResult, SyncAction, UseOfflineFormOptions, UseOfflineFormResult } from './types'
import { useOfflineStatus } from './use-offline-status'
import { useSyncQueue } from './use-sync-queue'

/**
 * Хук для оффлайн-поддержки форм с TanStack Form
 *
 * Автоматически определяет статус соединения и:
 * - Онлайн: отправляет данные напрямую
 * - Оффлайн: сохраняет в очередь IndexedDB для синхронизации
 *
 * @example
 * ```tsx
 * import { useOfflineForm } from '@lena/form-components/offline'
 *
 * function ProfileForm({ initialData }) {
 *   const { submit, isOffline, pendingCount, isProcessing } = useOfflineForm({
 *     actionType: 'UPDATE_PROFILE',
 *     onlineSubmit: async (value) => {
 *       const result = await updateProfileAction(value)
 *       return { success: result.success, error: result.error?.formErrors?.[0] }
 *     },
 *     onSuccess: () => toaster.success({ title: 'Сохранено' }),
 *     onQueued: () => toaster.info({ title: 'Сохранено локально' }),
 *     onError: (error) => toaster.error({ title: 'Ошибка', description: error }),
 *   })
 *
 *   const form = useAppForm({
 *     defaultValues: initialData,
 *     onSubmit: async ({ value }) => {
 *       await submit(value)
 *     },
 *   })
 *
 *   return (
 *     <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
 *       {isOffline && <Badge colorPalette="orange">Оффлайн режим</Badge>}
 *       {pendingCount > 0 && (
 *         <Badge colorPalette="blue">
 *           {isProcessing ? 'Синхронизация...' : `Ожидает: ${pendingCount}`}
 *         </Badge>
 *       )}
 *       <form.AppField name="name" children={(field) => <field.TextField label="Имя" />} />
 *       <Button type="submit">{isOffline ? 'Сохранить локально' : 'Сохранить'}</Button>
 *     </form>
 *   )
 * }
 * ```
 */
export function useOfflineForm<T extends object>({
  actionType,
  onlineSubmit,
  onSuccess,
  onQueued,
  onError,
}: UseOfflineFormOptions<T>): UseOfflineFormResult<T> {
  const isOffline = useOfflineStatus()
  const { addAction, processQueue, pendingCount, isProcessing, queueLength } = useSyncQueue()
  const [lastSyncAttempt, setLastSyncAttempt] = useState<number | null>(null)

  // Ref для предотвращения повторной обработки очереди
  const processingRef = useRef(false)

  /**
   * Отправка формы с поддержкой оффлайн
   */
  const submit = useCallback(
    async (value: T): Promise<OfflineSubmitResult> => {
      // Оффлайн — добавляем в очередь
      if (isOffline) {
        try {
          const queueItem = await addAction({
            type: actionType,
            payload: value as Record<string, unknown>,
          })

          onQueued?.()

          return {
            success: true,
            queued: true,
            queueItemId: queueItem.id,
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Ошибка сохранения в очередь'
          onError?.(errorMessage)
          return {
            success: false,
            error: errorMessage,
          }
        }
      }

      // Онлайн — отправляем напрямую
      try {
        const result = await onlineSubmit(value)

        if (result.success) {
          onSuccess?.()
        } else if (result.error) {
          onError?.(result.error)
        }

        return {
          success: result.success,
          error: result.error,
          queued: false,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ошибка отправки'
        onError?.(errorMessage)
        return {
          success: false,
          error: errorMessage,
          queued: false,
        }
      }
    },
    [isOffline, actionType, addAction, onlineSubmit, onSuccess, onQueued, onError]
  )

  /**
   * Обработчик действий из очереди
   * Вызывается при восстановлении соединения
   */
  const handleQueuedAction = useCallback(
    async (action: SyncAction): Promise<{ success: boolean; error?: string }> => {
      // Обрабатываем только наш тип действия
      if (action.type !== actionType) {
        return { success: true } // Пропускаем чужие действия
      }

      return onlineSubmit(action.payload as T)
    },
    [actionType, onlineSubmit]
  )

  // Автоматическая синхронизация при восстановлении соединения
  useEffect(() => {
    // Если онлайн и есть элементы в очереди — пробуем синхронизировать
    if (!isOffline && pendingCount > 0 && !processingRef.current) {
      processingRef.current = true
      setLastSyncAttempt(Date.now())

      processQueue(handleQueuedAction)
        .then((results) => {
          const failed = results.filter((r) => !r.success)
          if (failed.length > 0) {
            console.warn(`[OfflineForm] ${failed.length} действий не удалось синхронизировать`)
          }
        })
        .finally(() => {
          processingRef.current = false
        })
    }
  }, [isOffline, pendingCount, processQueue, handleQueuedAction])

  return {
    submit,
    isOffline,
    pendingCount,
    queueLength,
    isProcessing,
    lastSyncAttempt,
  }
}

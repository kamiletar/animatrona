'use client'

import { useCallback } from 'react'
import { useOfflineForm, type FormOfflineConfig } from '../../offline'
import { useFormPersistence, type FormPersistenceConfig } from '../form-persistence'
import type { FormOfflineState } from '../types'

/**
 * Конфигурация для хука useFormFeatures
 */
export interface UseFormFeaturesConfig<TData extends object> {
  /** Конфигурация persistence (сохранение данных в localStorage) */
  persistence?: FormPersistenceConfig
  /** Конфигурация offline-режима */
  offline?: FormOfflineConfig
  /** Функция для онлайн-отправки (вызывается при submit) */
  onlineSubmit: (value: TData) => Promise<void>
}

/**
 * Результат хука useFormFeatures
 */
export interface UseFormFeaturesResult<TData extends object> {
  /** Включена ли persistence */
  isPersistenceEnabled: boolean
  /** Включён ли offline-режим */
  isOfflineEnabled: boolean
  /** Результат persistence хука */
  persistenceResult: ReturnType<typeof useFormPersistence<TData>>
  /** Результат offline хука */
  offlineForm: ReturnType<typeof useOfflineForm<TData>>
  /** Состояние offline для контекста формы */
  offlineState: FormOfflineState | undefined
  /** Обработчик submit с поддержкой offline и persistence */
  handleSubmit: (value: TData) => Promise<void>
  /** Подписка на изменения формы для persistence */
  subscribeToFormChanges: (form: {
    store: { subscribe: (fn: () => void) => () => void }
    state: { values: unknown }
  }) => () => void
  /** Восстановление данных из persistence */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  restoreFormData: (form: { setFieldValue: (key: string, value: any) => void }) => void
}

/**
 * Хук, объединяющий логику persistence и offline для форм.
 * Устраняет дублирование между FormSimple и FormWithApi.
 *
 * @example
 * const features = useFormFeatures({
 *   persistence: { key: 'my-form' },
 *   offline: { actionType: 'FORM_SUBMIT' },
 *   onlineSubmit: async (value) => {
 *     await saveData(value)
 *   }
 * })
 */
export function useFormFeatures<TData extends object>({
  persistence,
  offline,
  onlineSubmit,
}: UseFormFeaturesConfig<TData>): UseFormFeaturesResult<TData> {
  const isPersistenceEnabled = !!persistence
  const isOfflineEnabled = !!offline

  // Хук persistence (если не включён — используем disabled ключ)
  const persistenceResult = useFormPersistence<TData>(persistence ?? { key: '__disabled__' })

  // Обёртка для онлайн-отправки с очисткой persistence
  const offlineOnlineSubmit = useCallback(
    async (value: TData) => {
      try {
        await onlineSubmit(value)
        // Очищаем persistence при успешной отправке
        if (isPersistenceEnabled) {
          persistenceResult.clearSavedData()
        }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Ошибка отправки' }
      }
    },
    [onlineSubmit, isPersistenceEnabled, persistenceResult]
  )

  // Хук offline (если включён)
  const offlineForm = useOfflineForm<TData>({
    actionType: offline?.actionType ?? 'FORM_SUBMIT',
    onlineSubmit: offlineOnlineSubmit,
    onSuccess: () => {
      offline?.onSynced?.()
      // Очищаем persistence при успешной синхронизации
      if (isPersistenceEnabled) {
        persistenceResult.clearSavedData()
      }
    },
    onQueued: offline?.onQueued,
    onError: offline?.onSyncError,
  })

  // Состояние offline для контекста формы
  const offlineState: FormOfflineState | undefined = isOfflineEnabled
    ? {
        isOffline: offlineForm.isOffline,
        pendingCount: offlineForm.pendingCount,
        isProcessing: offlineForm.isProcessing,
        clearPersistence: isPersistenceEnabled ? persistenceResult.clearSavedData : undefined,
      }
    : undefined

  // Обработчик submit
  const handleSubmit = useCallback(
    async (value: TData): Promise<void> => {
      if (isOfflineEnabled) {
        // Используем offline-aware submit
        await offlineForm.submit(value)
      } else {
        // Прямая отправка
        await onlineSubmit(value)
        // Очищаем persistence при успехе
        if (isPersistenceEnabled) {
          persistenceResult.clearSavedData()
        }
      }
    },
    [isOfflineEnabled, offlineForm, onlineSubmit, isPersistenceEnabled, persistenceResult]
  )

  // Подписка на изменения формы для persistence
  const subscribeToFormChanges = useCallback(
    (form: { store: { subscribe: (fn: () => void) => () => void }; state: { values: unknown } }) => {
      if (!isPersistenceEnabled) {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        return () => {}
      }

      return form.store.subscribe(() => {
        const values = form.state.values as TData
        persistenceResult.saveValues(values)
      })
    },
    [isPersistenceEnabled, persistenceResult]
  )

  // Восстановление данных из persistence
  const restoreFormData = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (form: { setFieldValue: (key: string, value: any) => void }) => {
      if (!isPersistenceEnabled || !persistenceResult.shouldRestore || !persistenceResult.savedData) {
        return
      }

      // Применяем сохранённые значения
      const dataToRestore = persistenceResult.savedData as Record<string, unknown>
      for (const [key, value] of Object.entries(dataToRestore)) {
        form.setFieldValue(key, value)
      }

      // Отмечаем восстановление как завершённое после тика
      setTimeout(() => {
        persistenceResult.markRestoreComplete()
      }, 0)
    },
    [isPersistenceEnabled, persistenceResult]
  )

  return {
    isPersistenceEnabled,
    isOfflineEnabled,
    persistenceResult,
    offlineForm,
    offlineState,
    handleSubmit,
    subscribeToFormChanges,
    restoreFormData,
  }
}

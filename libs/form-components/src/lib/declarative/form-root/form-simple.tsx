'use client'

import { useEffect, useMemo, type ReactElement, type ReactNode } from 'react'
import { useAppForm } from '../../form-hook'
import type { FormOfflineConfig } from '../../offline'
import { DeclarativeFormContext } from '../form-context'
import type { FormPersistenceConfig } from '../form-persistence'
import type { DeclarativeFormContextValue, FormMiddleware, ValidateOn } from '../types'
import { buildValidators } from './form-validators'
import { useFormFeatures } from './use-form-features'

/**
 * Props для FormSimple компонента
 */
export interface FormSimpleProps<TData extends object> {
  /** Начальные значения формы */
  initialValue: TData
  /** Обработчик отправки формы */
  onSubmit: (data: TData) => void | Promise<void>
  /** Zod схема для валидации */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema?: any
  /** Конфигурация persistence (localStorage) */
  persistence?: FormPersistenceConfig
  /** Конфигурация offline-режима */
  offline?: FormOfflineConfig
  /** Режим(ы) валидации */
  validateOn?: ValidateOn | ValidateOn[]
  /** Отключить все поля формы */
  disabled?: boolean
  /** Режим "только чтение" для всех полей */
  readOnly?: boolean
  /** Middleware для обработки событий формы */
  middleware?: FormMiddleware<TData>
  /** Содержимое формы */
  children: ReactNode
}

/**
 * Простая форма без API интеграции.
 * Используется когда нужна форма с локальными данными.
 *
 * @example
 * <FormSimple
 *   initialValue={{ name: '', email: '' }}
 *   onSubmit={handleSubmit}
 *   schema={UserSchema}
 * >
 *   <Form.Field.String name="name" label="Имя" />
 *   <Form.Field.String name="email" label="Email" />
 *   <Form.Button.Submit>Сохранить</Form.Button.Submit>
 * </FormSimple>
 */
export function FormSimple<TData extends object>({
  initialValue,
  onSubmit,
  schema,
  persistence,
  offline,
  validateOn,
  disabled,
  readOnly,
  middleware,
  children,
}: FormSimpleProps<TData>): ReactElement {
  // Используем общий хук для persistence и offline
  const features = useFormFeatures<TData>({
    persistence,
    offline,
    onlineSubmit: async (value) => {
      await onSubmit(value)
    },
  })

  // Инициализируем форму
  const form = useAppForm({
    defaultValues: initialValue,
    validators: buildValidators(schema, validateOn),
    onSubmit: async ({ value, formApi }) => {
      let dataToSubmit = value as TData

      // Применяем beforeSubmit middleware
      if (middleware?.beforeSubmit) {
        const transformed = await middleware.beforeSubmit(dataToSubmit)
        if (transformed === undefined) {
          // Отмена submit
          return
        }
        dataToSubmit = transformed
      }

      try {
        await features.handleSubmit(dataToSubmit)

        // Вызываем afterSuccess middleware
        if (middleware?.afterSuccess) {
          await middleware.afterSuccess(dataToSubmit)
        }

        // Сбрасываем форму с текущими значениями для очистки dirty-состояния
        formApi.reset(dataToSubmit)
      } catch (error) {
        // Вызываем onError middleware
        if (middleware?.onError) {
          await middleware.onError(error instanceof Error ? error : new Error(String(error)))
        }
        throw error
      }
    },
  })

  // Подписка на изменения для persistence
  useEffect(() => {
    return features.subscribeToFormChanges(form)
  }, [form, features])

  // Восстановление данных из persistence
  useEffect(() => {
    if (
      !features.isPersistenceEnabled ||
      !features.persistenceResult.shouldRestore ||
      !features.persistenceResult.savedData
    ) {
      return
    }
    features.restoreFormData(form)
  }, [
    form,
    features,
    features.isPersistenceEnabled,
    features.persistenceResult.shouldRestore,
    features.persistenceResult.savedData,
  ])

  // Мемоизируем значение контекста для предотвращения лишних ререндеров
  const contextValue = useMemo<DeclarativeFormContextValue>(
    () => ({
      form,
      schema,
      offlineState: features.offlineState,
      disabled,
      readOnly,
    }),
    [form, schema, features.offlineState, disabled, readOnly]
  )

  return (
    <DeclarativeFormContext.Provider value={contextValue}>
      {/* Диалог восстановления данных */}
      {features.isPersistenceEnabled && <features.persistenceResult.RestoreDialog />}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        {children}
      </form>
    </DeclarativeFormContext.Provider>
  )
}

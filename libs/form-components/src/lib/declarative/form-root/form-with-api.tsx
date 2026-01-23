'use client'

import { useEffect, type ReactElement, type ReactNode } from 'react'
import { useAppForm } from '../../form-hook'
import type { FormOfflineConfig } from '../../offline'
import { DeclarativeFormContext } from '../form-context'
import type { FormPersistenceConfig } from '../form-persistence'
import type { DeclarativeFormContextValue, FormApiConfig, FormMiddleware, ValidateOn } from '../types'
import { useFormApi } from '../use-form-api'
import { FormLoadingState } from './form-loading-state'
import { buildValidators } from './form-validators'
import { useFormFeatures } from './use-form-features'

/**
 * Props для FormWithApi компонента
 */
export interface FormWithApiProps<TData extends object> {
  /** Конфигурация API (ZenStack) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api: FormApiConfig<TData, any>
  /** Начальные значения (fallback пока данные загружаются) */
  initialValue?: TData
  /** Дополнительный обработчик после успешной отправки */
  onSubmit?: (data: TData) => void | Promise<void>
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
 * Форма с интеграцией ZenStack API.
 * Автоматически загружает данные в режиме редактирования,
 * использует create/update мутации для сохранения.
 *
 * @example
 * <FormWithApi
 *   api={{
 *     id: 'abc123', // пустой = создание, заполненный = редактирование
 *     query: { hook: useFindUniqueRecipe, include: { components: true } },
 *     mutations: { create: useCreateRecipe, update: useUpdateRecipe },
 *   }}
 *   schema={RecipeSchema}
 *   onSubmit={(data) => console.log('Сохранено:', data)}
 * >
 *   <Form.Field.String name="title" label="Название" />
 *   <Form.Button.Submit>Сохранить</Form.Button.Submit>
 * </FormWithApi>
 */
export function FormWithApi<TData extends object>({
  api,
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
}: FormWithApiProps<TData>): ReactElement {
  // Хук для работы с API
  const formApi = useFormApi(api)

  // Используем общий хук для persistence и offline
  const features = useFormFeatures<TData>({
    persistence,
    offline,
    onlineSubmit: async (value) => {
      // Вызываем API мутацию
      await formApi.submit(value)
      // Вызываем пользовательский callback
      await onSubmit?.(value)
    },
  })

  // Определяем начальные значения:
  // - Режим редактирования: используем загруженные данные (или initialValue как fallback)
  // - Режим создания: используем initialValue (или пустой объект)
  const defaultValues = formApi.isEditMode
    ? (formApi.data ?? initialValue ?? ({} as TData))
    : (initialValue ?? ({} as TData))

  // Инициализируем форму
  const form = useAppForm({
    defaultValues,
    validators: buildValidators(schema, validateOn),
    onSubmit: async ({ value, formApi: tanstackFormApi }) => {
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
        tanstackFormApi.reset(dataToSubmit)
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

  // Флаг загрузки данных (режим редактирования)
  const dataLoaded = formApi.isEditMode && formApi.data && !formApi.isLoading

  // Формируем значение контекста
  const contextValue: DeclarativeFormContextValue = {
    form,
    schema,
    // Экспортируем состояние API для компонентов, которым оно нужно
    apiState: {
      isEditMode: formApi.isEditMode,
      isLoading: formApi.isLoading,
      isMutating: formApi.isMutating,
      error: formApi.error,
      mutationError: formApi.mutationError,
    },
    offlineState: features.offlineState,
    disabled,
    readOnly,
  }

  // Показываем состояние загрузки в режиме редактирования
  if (formApi.isLoading) {
    return <FormLoadingState />
  }

  return (
    <DeclarativeFormContext.Provider value={contextValue} key={dataLoaded ? 'loaded' : 'initial'}>
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

'use client'

import type { ReactNode } from 'react'
import type { $ZodType } from 'zod/v4/core'
import type { FormOfflineConfig } from '../../offline'
import type { FormPersistenceConfig } from '../form-persistence'

/**
 * Тип API формы, возвращаемый useAppForm
 * Содержит Field, Subscribe и другие компоненты
 *
 * Примечание: Используется any из-за того, что createFormHook добавляет
 * дополнительные методы (Field, Subscribe, etc.) которые не являются частью
 * базового FormApi типа из @tanstack/react-form
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppFormApi = any

/**
 * Базовый тип Zod схемы (Zod v4)
 */
export type ZodSchema = $ZodType

/**
 * Режимы валидации формы
 */
export type ValidateOn = 'change' | 'blur' | 'submit' | 'mount'

/**
 * Middleware для обработки событий формы
 *
 * @example
 * ```tsx
 * <Form
 *   middleware={{
 *     beforeSubmit: (data) => ({ ...data, timestamp: Date.now() }),
 *     afterSuccess: (data) => toaster.success({ title: 'Сохранено!' }),
 *     onError: (error) => toaster.error({ title: error.message }),
 *   }}
 * >
 * ```
 */
export interface FormMiddleware<TData = unknown> {
  /**
   * Вызывается перед отправкой формы.
   * Можно трансформировать данные или вернуть undefined для отмены submit.
   */
  beforeSubmit?: (data: TData) => TData | undefined | Promise<TData | undefined>
  /**
   * Вызывается после успешной отправки.
   */
  afterSuccess?: (data: TData) => void | Promise<void>
  /**
   * Вызывается при ошибке отправки.
   */
  onError?: (error: Error) => void | Promise<void>
}

/**
 * Состояние API, доступное в контексте формы
 */
export interface FormApiState {
  /** Форма в режиме редактирования (есть id) */
  isEditMode: boolean
  /** Данные загружаются */
  isLoading: boolean
  /** Мутация выполняется */
  isMutating: boolean
  /** Ошибка запроса (TanStack Query error) */
  error: Error | null
  /** Ошибка мутации (create/update) */
  mutationError: Error | null
}

/**
 * Оффлайн состояние, доступное в контексте формы
 */
export interface FormOfflineState {
  /** Форма в оффлайн режиме */
  isOffline: boolean
  /** Количество ожидающих действий в очереди синхронизации */
  pendingCount: number
  /** Очередь синхронизации обрабатывается */
  isProcessing: boolean
  /** Очистить данные персистенции (вызывается после успешной синхронизации) */
  clearPersistence?: () => void
}

/**
 * Значение контекста декларативной формы
 */
export interface DeclarativeFormContextValue {
  form: AppFormApi
  /** Zod схема для извлечения метаданных полей */
  schema?: ZodSchema
  /** Индекс для примитивных массивов (tags: string[]) */
  primitiveArrayIndex?: number
  /** Состояние API (только при использовании пропа api) */
  apiState?: FormApiState
  /** Оффлайн состояние (только при использовании пропа offline) */
  offlineState?: FormOfflineState
  /** Глобальное отключение всех полей формы */
  disabled?: boolean
  /** Глобальный режим только для чтения всех полей */
  readOnly?: boolean
}

/**
 * Пропсы для корневого компонента Form
 */
export interface FormProps<TData extends object> {
  /** Начальные значения формы */
  initialValue: TData
  /** Колбэк при отправке формы */
  onSubmit: (data: TData) => void | Promise<void>
  /** Опциональная Zod схема для валидации */
  schema?: ZodSchema
  /** Содержимое формы (Field, Group компоненты) */
  children: ReactNode
}

/**
 * Расширенные FormProps с опциональной интеграцией API
 */
export interface FormPropsWithApi<TData extends object> {
  /** Конфигурация API для автоматической загрузки данных и мутаций */
  api?: FormApiConfig<TData>
  /** Начальные значения формы (обязательно без api, опционально с api) */
  initialValue?: TData
  /** Колбэк при отправке формы (вызывается после мутации если api передан) */
  onSubmit?: (data: TData) => void | Promise<void>
  /** Опциональная Zod схема для валидации */
  schema?: ZodSchema
  /**
   * Включить localStorage персистенцию данных формы.
   * Показывает диалог восстановления сохранённых данных при загрузке формы.
   */
  persistence?: FormPersistenceConfig
  /**
   * Включить оффлайн поддержку с автоматической очередью синхронизации.
   * В оффлайн режиме данные формы сохраняются в IndexedDB и синхронизируются при восстановлении соединения.
   */
  offline?: FormOfflineConfig
  /**
   * Режим валидации формы.
   * - 'change' — валидация при каждом изменении (по умолчанию)
   * - 'blur' — валидация при потере фокуса
   * - 'submit' — валидация только при отправке
   * - 'mount' — валидация при монтировании
   * Можно передать массив для комбинации режимов: ['blur', 'submit']
   */
  validateOn?: ValidateOn | ValidateOn[]
  /**
   * Глобальное отключение всех полей формы.
   * Полезно для состояния загрузки или когда редактирование запрещено.
   */
  disabled?: boolean
  /**
   * Глобальный режим только для чтения.
   * Все поля будут в режиме просмотра без возможности редактирования.
   */
  readOnly?: boolean
  /**
   * Middleware для обработки событий формы.
   * Позволяет трансформировать данные перед отправкой и реагировать на успех/ошибку.
   */
  middleware?: FormMiddleware<TData>
  /** Содержимое формы */
  children: ReactNode
}

// ============================================================================
// API типы (интеграция ZenStack)
// ============================================================================

/**
 * Обобщённый тип для ZenStack query хука (useFindUnique*)
 * Возвращает UseQueryResult с данными типа TData
 *
 * Примечание: args типизирован как any для совместимости с разными ORM
 * (Prisma, ZenStack), которые генерируют разные типы для include
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UseQueryHook<TData = any, TInclude = any> = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: { where: { id: string }; include?: TInclude } | any,
  options?: { enabled?: boolean }
) => {
  data: TData | undefined
  isLoading: boolean
  error: Error | null
  isFetching?: boolean
  isSuccess?: boolean
  status?: string
  fetchStatus?: string
}

/**
 * Обобщённый тип для ZenStack create мутации хука (useCreate*)
 * Используется any для совместимости с разными ORM (Prisma, ZenStack)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UseCreateHook<TData = any> = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutate: (args: { data: any }) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutateAsync: (args: { data: any }) => Promise<TData | undefined>
  isPending: boolean
  error: Error | null
}

/**
 * Обобщённый тип для ZenStack update мутации хука (useUpdate*)
 * Используется any для совместимости с разными ORM (Prisma, ZenStack)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UseUpdateHook<TData = any> = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutate: (args: { where: { id: string }; data: any }) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutateAsync: (args: { where: { id: string }; data: any }) => Promise<TData | undefined>
  isPending: boolean
  error: Error | null
}

/**
 * Конфигурация API для компонента Form
 * Включает автоматическую загрузку данных и мутации через ZenStack хуки
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FormApiConfig<TData = any, TInclude = any, TMutationData = any> {
  /** ID записи. Пустой/undefined = режим создания, заполненный = режим редактирования */
  id?: string
  /** Конфигурация запроса для загрузки существующих данных */
  query: {
    /** ZenStack useFindUnique* хук */
    hook: UseQueryHook<TData, TInclude>
    /** Prisma include объект для связей */
    include?: TInclude
  }
  /** Хуки мутаций для создания/обновления */
  mutations: {
    /** ZenStack useCreate* хук */
    create: UseCreateHook<TData>
    /** ZenStack useUpdate* хук */
    update: UseUpdateHook<TData>
  }
  /**
   * Трансформация данных формы перед отправкой в API.
   * Используйте для преобразования плоских данных формы в Prisma-совместимый формат.
   */
  transformData?: (values: TData, mode: 'create' | 'update') => TMutationData
}

/**
 * Результат хука useFormApi
 */
export interface FormApiResult<TData> {
  /** Форма в режиме редактирования (есть id) */
  isEditMode: boolean
  /** Данные загружаются */
  isLoading: boolean
  /** Мутация выполняется */
  isMutating: boolean
  /** Загруженные данные (undefined в режиме создания или во время загрузки) */
  data: TData | undefined
  /** Ошибка запроса */
  error: Error | null
  /** Ошибка мутации (create/update) */
  mutationError: Error | null
  /** Обработчик отправки, вызывающий соответствующую мутацию */
  submit: (values: TData) => Promise<void>
}

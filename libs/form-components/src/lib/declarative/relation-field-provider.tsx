'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Опция для поля выбора
 */
export interface RelationOption {
  /** Значение (обычно ID) */
  value: string
  /** Отображаемый текст */
  label: string
  /** Описание (опционально) */
  description?: string
}

/**
 * Состояние загрузки relation
 */
export interface RelationState {
  /** Опции для выбора */
  options: RelationOption[]
  /** Идёт загрузка */
  isLoading: boolean
  /** Ошибка загрузки */
  error: Error | null
}

/**
 * Результат хука загрузки данных
 */
export interface QueryHookResult<TData = unknown> {
  data?: TData[] | null
  isLoading: boolean
  error?: Error | null
}

/**
 * Конфигурация relation для загрузки
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface RelationConfig<TData = any, TArgs = any> {
  /** Имя модели (должно совпадать с model в relationMeta) */
  model: string
  /**
   * React hook для загрузки данных (должен возвращать { data, isLoading, error })
   * @example useFindManyCategory
   */
  useQuery: (args?: TArgs) => QueryHookResult<TData>
  /** Поле для отображения label */
  labelField: string
  /** Поле для значения (по умолчанию 'id') */
  valueField?: string
  /** Поле для description (опционально) */
  descriptionField?: string
  /** Аргументы для useQuery (фильтры, сортировка) */
  queryArgs?: TArgs
}

/**
 * Значение контекста RelationFieldProvider
 */
export interface RelationFieldContextValue {
  /** Получить options для модели */
  getOptions: (model: string) => RelationOption[]
  /** Получить состояние загрузки для модели */
  getState: (model: string) => RelationState
  /** Все загруженные relation */
  relations: Record<string, RelationState>
}

const RelationFieldContext = createContext<RelationFieldContextValue | null>(null)

/**
 * Хук для получения контекста RelationFieldProvider
 */
export function useRelationFieldContext(): RelationFieldContextValue | null {
  return useContext(RelationFieldContext)
}

/**
 * Хук для получения options конкретной модели
 * @param model - имя модели
 * @returns options и состояние загрузки
 */
export function useRelationOptions(model: string): RelationState {
  const context = useRelationFieldContext()

  if (!context) {
    return {
      options: [],
      isLoading: false,
      error: null,
    }
  }

  return context.getState(model)
}

/**
 * Компонент-загрузчик для одной relation
 * Вызывается внутри провайдера, соблюдает правила хуков
 */
function RelationLoader<TData>({
  config,
  onLoaded,
}: {
  config: RelationConfig<TData>
  onLoaded: (model: string, state: RelationState) => void
}) {
  const { model, useQuery, labelField, valueField = 'id', descriptionField, queryArgs } = config

  // Вызываем хук для загрузки данных
  const { data, isLoading, error } = useQuery(queryArgs)

  // Преобразуем данные в options при изменении
  useEffect(() => {
    if (isLoading) {
      onLoaded(model, { options: [], isLoading: true, error: null })
      return
    }

    if (error) {
      onLoaded(model, { options: [], isLoading: false, error: error as Error })
      return
    }

    const options: RelationOption[] = (data ?? []).map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const record = item as Record<string, any>
      return {
        value: String(record[valueField] ?? ''),
        label: String(record[labelField] ?? ''),
        description: descriptionField ? String(record[descriptionField] ?? '') : undefined,
      }
    })

    onLoaded(model, { options, isLoading: false, error: null })
  }, [data, isLoading, error, model, labelField, valueField, descriptionField, onLoaded])

  // Компонент не рендерит ничего
  return null
}

/**
 * Провайдер для автозагрузки options relation полей
 *
 * Позволяет автоматически загружать опции для полей с `relationMeta()`,
 * интегрируясь с ZenStack hooks.
 *
 * @example Базовое использование
 * ```tsx
 * import { useFindManyCategory, useFindManyTag } from '@/generated/hooks'
 *
 * <RelationFieldProvider
 *   relations={[
 *     { model: 'Category', useQuery: useFindManyCategory, labelField: 'name' },
 *     { model: 'Tag', useQuery: useFindManyTag, labelField: 'title' },
 *   ]}
 * >
 *   <Form schema={ProductFormSchema} ...>
 *     <Form.AutoFields />
 *   </Form>
 * </RelationFieldProvider>
 * ```
 *
 * @example С фильтрацией и сортировкой
 * ```tsx
 * <RelationFieldProvider
 *   relations={[
 *     {
 *       model: 'Category',
 *       useQuery: useFindManyCategory,
 *       labelField: 'name',
 *       queryArgs: {
 *         where: { isActive: true },
 *         orderBy: { name: 'asc' },
 *       },
 *     },
 *   ]}
 * >
 * ```
 *
 * @example С description для RadioCard/CheckboxCard
 * ```tsx
 * <RelationFieldProvider
 *   relations={[
 *     {
 *       model: 'Plan',
 *       useQuery: useFindManyPlan,
 *       labelField: 'name',
 *       descriptionField: 'features',
 *     },
 *   ]}
 * >
 * ```
 */
export function RelationFieldProvider({
  relations,
  children,
}: {
  /** Конфигурации relation для загрузки */
  relations: RelationConfig[]
  children: ReactNode
}) {
  // Состояние всех загруженных relation
  const [relationsState, setRelationsState] = useState<Record<string, RelationState>>({})

  // Callback для обновления состояния relation
  const handleLoaded = useMemo(
    () => (model: string, state: RelationState) => {
      setRelationsState((prev) => {
        // Проверяем, изменились ли данные
        const prevState = prev[model]
        if (
          prevState &&
          prevState.isLoading === state.isLoading &&
          prevState.error === state.error &&
          JSON.stringify(prevState.options) === JSON.stringify(state.options)
        ) {
          return prev // Без изменений
        }
        return { ...prev, [model]: state }
      })
    },
    []
  )

  // Значение контекста
  const contextValue = useMemo<RelationFieldContextValue>(
    () => ({
      getOptions: (model: string) => relationsState[model]?.options ?? [],
      getState: (model: string) =>
        relationsState[model] ?? {
          options: [],
          isLoading: false,
          error: null,
        },
      relations: relationsState,
    }),
    [relationsState]
  )

  return (
    <RelationFieldContext.Provider value={contextValue}>
      {/* Рендерим загрузчики для каждой relation */}
      {relations.map((config) => (
        <RelationLoader key={config.model} config={config} onLoaded={handleLoaded} />
      ))}
      {children}
    </RelationFieldContext.Provider>
  )
}

/**
 * HOC для оборачивания компонента в RelationFieldProvider
 *
 * @example
 * ```tsx
 * const ProductFormWithRelations = withRelations(ProductForm, [
 *   { model: 'Category', useQuery: useFindManyCategory, labelField: 'name' },
 * ])
 * ```
 */
export function withRelations<P extends object>(
  Component: React.ComponentType<P>,
  relations: RelationConfig[]
): React.FC<P> {
  const WrappedComponent = (props: P) => (
    <RelationFieldProvider relations={relations}>
      <Component {...props} />
    </RelationFieldProvider>
  )

  WrappedComponent.displayName = `withRelations(${Component.displayName ?? Component.name ?? 'Component'})`

  return WrappedComponent
}

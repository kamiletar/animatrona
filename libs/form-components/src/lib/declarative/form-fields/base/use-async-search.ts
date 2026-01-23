'use client'

import { useState } from 'react'
import { useDebounce } from './use-debounce'

/**
 * Результат async запроса (совместим с TanStack Query и ZenStack хуками)
 */
export interface AsyncQueryResult<TData = unknown> {
  data?: TData[]
  isLoading?: boolean
  error?: Error | null
}

/**
 * Функция async запроса для загрузки опций
 * @param search - Строка поиска (пустая если запрос не нужен)
 */
export type AsyncQueryFn<TData = unknown> = (search: string) => AsyncQueryResult<TData>

/**
 * Опции для useAsyncSearch
 */
export interface UseAsyncSearchOptions<TData = unknown> {
  /**
   * Async функция запроса (возвращает { data, isLoading, error })
   */
  useQuery?: AsyncQueryFn<TData>

  /**
   * Задержка debounce в миллисекундах
   * @default 300
   */
  debounce?: number

  /**
   * Минимум символов для запуска поиска
   * @default 1
   */
  minChars?: number

  /**
   * Начальное значение ввода
   * @default ''
   */
  initialValue?: string
}

/**
 * Результат useAsyncSearch
 */
export interface UseAsyncSearchResult<TData = unknown> {
  /** Текущее значение ввода */
  inputValue: string

  /** Функция для изменения значения ввода */
  setInputValue: (value: string) => void

  /** Debounced значение для запроса */
  debouncedSearch: string

  /** Нужно ли запускать запрос (достаточно символов) */
  shouldQuery: boolean

  /** Идёт ли загрузка */
  isLoading: boolean

  /** Результат запроса (массив данных) */
  data: TData[] | undefined

  /** Ошибка запроса */
  error: Error | null | undefined
}

/**
 * Хук для async поиска с debounce
 *
 * Объединяет общую логику управления вводом, debounce и async запросами
 * для компонентов Combobox и Autocomplete.
 *
 * @example Использование с ZenStack хуком
 * ```tsx
 * const {
 *   inputValue,
 *   setInputValue,
 *   shouldQuery,
 *   isLoading,
 *   data,
 * } = useAsyncSearch({
 *   useQuery: (search) => useFindManyUser({
 *     where: { name: { contains: search, mode: 'insensitive' } },
 *     take: 20,
 *   }),
 *   debounce: 300,
 *   minChars: 2,
 * })
 * ```
 *
 * @example Использование для локальной фильтрации
 * ```tsx
 * const { inputValue, setInputValue, debouncedSearch } = useAsyncSearch({
 *   debounce: 200,
 *   minChars: 1,
 * })
 *
 * const filteredOptions = useMemo(() => {
 *   return options.filter(opt => opt.label.includes(debouncedSearch))
 * }, [options, debouncedSearch])
 * ```
 */
export function useAsyncSearch<TData = unknown>(
  options: UseAsyncSearchOptions<TData> = {}
): UseAsyncSearchResult<TData> {
  const { useQuery, debounce = 300, minChars = 1, initialValue = '' } = options

  // Состояние ввода
  const [inputValue, setInputValue] = useState(initialValue)

  // Debounced значение для запроса
  const debouncedSearch = useDebounce(inputValue, debounce)

  // Нужно ли запускать запрос?
  const shouldQuery = debouncedSearch.length >= minChars

  // Вызов useQuery (если передан)
  // Передаём пустую строку если не должны запрашивать, чтобы хук всегда вызывался
  const queryResult = useQuery?.(shouldQuery ? debouncedSearch : '')

  // Извлекаем результаты
  const { data, isLoading = false, error } = queryResult ?? {}

  return {
    inputValue,
    setInputValue,
    debouncedSearch,
    shouldQuery,
    isLoading,
    data,
    error,
  }
}

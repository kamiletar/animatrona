'use client'

// Factory функция для создания Field компонентов
export { FieldError, FieldLabel, createField } from './create-field'
export type { CreateFieldOptions, FieldRenderFn, FieldRenderProps, ResolvedFieldProps } from './create-field'

// Стандартная обёртка для простых полей
export { FieldWrapper } from './field-wrapper'
export type { FieldWrapperProps } from './field-wrapper'

// Базовый хук для полей
export { useDeclarativeField } from './base-field'

// Резолвинг props с учётом схемы
export { useResolvedFieldProps } from './use-resolved-field-props'

// Утилиты для работы с ошибками
export { formatFieldErrors, getFieldErrors, hasFieldErrors, type FieldErrorsResult } from './field-utils'

// Утилиты
export { useDebounce } from './use-debounce'

// Async поиск с debounce
export { useAsyncSearch } from './use-async-search'
export type { AsyncQueryFn, AsyncQueryResult, UseAsyncSearchOptions, UseAsyncSearchResult } from './use-async-search'

// Tooltip компонент
export { FieldTooltip } from './field-tooltip'

// Унифицированный label для selection полей
export { SelectionFieldLabel } from './selection-field-label'
export type { SelectionFieldLabelProps } from './selection-field-label'

// Группировка опций для selection полей
export { getOptionLabel, useGroupedOptions } from './use-grouped-options'
export type { GroupedOptionsResult } from './use-grouped-options'

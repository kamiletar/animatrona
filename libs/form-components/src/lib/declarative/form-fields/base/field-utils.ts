'use client'

import type { ValidationError } from '@tanstack/react-form'

/**
 * Форматирует ошибки валидации в строку для отображения
 *
 * Обрабатывает различные форматы ошибок:
 * - Строки (возвращает как есть)
 * - Объекты с `message` (StandardSchemaV1Issue, ZodIssue)
 * - Объекты с `issues` массивом (ZodError)
 * - Вложенные структуры ошибок
 *
 * @example
 * ```tsx
 * const errors = field.state.meta.errors
 * {hasFieldErrors(errors) && (
 *   <Field.ErrorText>{formatFieldErrors(errors)}</Field.ErrorText>
 * )}
 * ```
 */
export function formatFieldErrors(errors: ValidationError[]): string {
  return errors
    .map((e) => extractErrorMessage(e))
    .filter(Boolean)
    .join(', ')
}

/**
 * Извлекает сообщение об ошибке из различных форматов
 *
 * @internal
 */
function extractErrorMessage(e: ValidationError): string {
  // Строковая ошибка
  if (typeof e === 'string') {
    return e
  }

  // Null/undefined
  if (e == null) {
    return ''
  }

  // Объект с ошибкой
  if (typeof e === 'object') {
    // Массив ошибок (Zod issues из superRefine, массив строк и т.д.)
    if (Array.isArray(e)) {
      return e
        .map((item: unknown) => {
          // Элемент с message (ZodIssue)
          if (typeof item === 'object' && item && 'message' in item) {
            return (item as { message: string }).message
          }
          // Строка
          if (typeof item === 'string') {
            return item
          }
          return ''
        })
        .filter(Boolean)
        .join(', ')
    }

    // Стандартный формат: { message: string }
    if ('message' in e && typeof e.message === 'string') {
      return e.message
    }

    // Zod формат с массивом issues: { issues: Array<{ message: string }> }
    if ('issues' in e && Array.isArray(e.issues)) {
      return e.issues
        .map((issue: unknown) => {
          if (typeof issue === 'object' && issue && 'message' in issue) {
            return (issue as { message: string }).message
          }
          return ''
        })
        .filter(Boolean)
        .join(', ')
    }

    // Zod flat errors: { fieldErrors: Record<string, string[]> }
    if ('fieldErrors' in e && typeof e.fieldErrors === 'object' && e.fieldErrors) {
      const fieldErrors = e.fieldErrors as Record<string, string[]>
      return Object.values(fieldErrors).flat().filter(Boolean).join(', ')
    }

    // Zod format errors: { _errors: string[] }
    if ('_errors' in e && Array.isArray(e._errors)) {
      return (e._errors as string[]).filter(Boolean).join(', ')
    }

    // Fallback: попробовать JSON.stringify для отладки
    // Это лучше чем [object Object], поможет обнаружить неизвестные форматы
    try {
      const json = JSON.stringify(e)
      // Если JSON слишком длинный или это пустой объект, не показываем
      if (json === '{}' || json.length > 200) {
        return ''
      }
      // Логируем в dev режиме для отладки неизвестных форматов
      if (process.env.NODE_ENV === 'development') {
        console.warn('[form-components] Unknown error format:', e)
      }
      return json
    } catch {
      return ''
    }
  }

  // Другие типы (число, boolean) — маловероятно, но обрабатываем
  return String(e)
}

/**
 * Проверяет наличие ошибок валидации
 *
 * @example
 * ```tsx
 * const errors = field.state.meta.errors
 * const hasError = hasFieldErrors(errors)
 * ```
 */
export function hasFieldErrors(errors: ValidationError[] | undefined): errors is ValidationError[] {
  return Boolean(errors && errors.length > 0)
}

/**
 * Интерфейс для результата useFieldErrors
 */
export interface FieldErrorsResult {
  /** Ошибки валидации */
  errors: ValidationError[]
  /** Есть ли ошибки */
  hasError: boolean
  /** Отформатированное сообщение об ошибке */
  errorMessage: string
}

/**
 * Извлекает информацию об ошибках из field API
 *
 * Упрощает получение ошибок в ручных Field компонентах,
 * которые не используют createField factory.
 *
 * @example
 * ```tsx
 * <form.Field name={fullPath}>
 *   {(field: AnyFieldApi) => {
 *     const { hasError, errorMessage } = getFieldErrors(field)
 *     return (
 *       <Field.Root invalid={hasError}>
 *         ...
 *         <FieldError hasError={hasError} errorMessage={errorMessage} />
 *       </Field.Root>
 *     )
 *   }}
 * </form.Field>
 * ```
 */
export function getFieldErrors(field: { state: { meta: { errors?: ValidationError[] } } }): FieldErrorsResult {
  const errors = field.state.meta.errors ?? []
  const hasError = hasFieldErrors(errors)
  const errorMessage = hasError ? formatFieldErrors(errors) : ''
  return { errors, hasError, errorMessage }
}

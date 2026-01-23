'use client'

import type { ValidationError } from '@tanstack/react-form'

/**
 * Форматирует ошибки валидации в строку для отображения
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
    .map((e) => {
      if (typeof e === 'string') {
        return e
      }
      if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') {
        return e.message
      }
      return String(e)
    })
    .join(', ')
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

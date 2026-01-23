'use client'

import { Field } from '@chakra-ui/react'
import { memo, type ReactElement, type ReactNode } from 'react'
import type { ResolvedFieldProps } from './create-field'
import { FieldError } from './create-field'
import { FieldLabel } from './field-label'

export interface FieldWrapperProps {
  /** Resolved props из createField */
  resolved: ResolvedFieldProps
  /** Есть ли ошибки валидации */
  hasError: boolean
  /** Отформатированное сообщение об ошибке */
  errorMessage: string
  /** Полный путь для data-field-name атрибута */
  fullPath: string
  /** Содержимое поля (Input, Textarea, etc.) */
  children: ReactNode
}

/**
 * Стандартная обёртка для простых полей
 *
 * Предоставляет:
 * - Field.Root с invalid/required/disabled/readOnly props
 * - FieldLabel с поддержкой tooltip
 * - FieldError с fallback на helperText
 *
 * Используй внутри createField render функции для простых Input-подобных полей
 * со стандартным layout: Label → Control → Error/Helper
 *
 * @example
 * ```tsx
 * export const FieldString = createField<StringFieldProps, string>({
 *   displayName: 'FieldString',
 *   render: ({ field, fullPath, resolved, hasError, errorMessage }) => (
 *     <FieldWrapper resolved={resolved} hasError={hasError} errorMessage={errorMessage} fullPath={fullPath}>
 *       <Input
 *         value={field.state.value ?? ''}
 *         onChange={(e) => field.handleChange(e.target.value)}
 *         onBlur={field.handleBlur}
 *         placeholder={resolved.placeholder}
 *         data-field-name={fullPath}
 *       />
 *     </FieldWrapper>
 *   ),
 * })
 * ```
 */
export const FieldWrapper = memo(function FieldWrapper({
  resolved,
  hasError,
  errorMessage,
  children,
}: FieldWrapperProps): ReactElement {
  return (
    <Field.Root
      invalid={hasError}
      required={resolved.required}
      disabled={resolved.disabled}
      readOnly={resolved.readOnly}
    >
      <FieldLabel label={resolved.label} tooltip={resolved.tooltip} required={resolved.required} />
      {children}
      <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
    </Field.Root>
  )
})

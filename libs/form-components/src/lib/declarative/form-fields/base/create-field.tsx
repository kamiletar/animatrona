'use client'

import { Field } from '@chakra-ui/react'
import type { AnyFieldApi } from '@tanstack/react-form'
import type { ReactElement, ReactNode } from 'react'
import type { ZodConstraints } from '../../schema-constraints'
import type { BaseFieldProps, FieldTooltipMeta } from '../../types'
import { FieldLabel } from './field-label'
import { formatFieldErrors, hasFieldErrors } from './field-utils'
import { useResolvedFieldProps } from './use-resolved-field-props'

/**
 * Resolved props после применения schema meta и form-level настроек
 */
export interface ResolvedFieldProps {
  /** Label (из props или schema meta) */
  label: ReactNode
  /** Placeholder */
  placeholder: string | undefined
  /** Подсказка под полем (может быть автоматически сгенерирована из constraints) */
  helperText: ReactNode
  /** Tooltip с иконкой */
  tooltip: FieldTooltipMeta | undefined
  /** Обязательное поле (из props или schema) */
  required: boolean | undefined
  /** Поле отключено (из props или form-level) */
  disabled: boolean | undefined
  /** Только для чтения (из props или form-level) */
  readOnly: boolean | undefined
  /** Автоматические constraints из Zod схемы (min, max, minLength, maxLength и т.д.) */
  constraints: ZodConstraints
  /** Опции для select полей (из meta.options с i18n переводами) */
  options: Array<{ value: string | number; label: string; disabled?: boolean; i18nKey?: string }> | undefined
}

/**
 * Props передаваемые в render функцию
 */
export interface FieldRenderProps<TValue = unknown, TState = Record<string, never>> {
  /** TanStack Form field API */
  field: AnyFieldApi
  /** Типизированное значение поля */
  value: TValue
  /** Полный путь к полю (например, "user.address.city") */
  fullPath: string
  /** Resolved props (label, placeholder, etc.) */
  resolved: ResolvedFieldProps
  /** Есть ли ошибки валидации */
  hasError: boolean
  /** Отформатированное сообщение об ошибке */
  errorMessage: string
  /** Локальное состояние компонента (из useFieldState) */
  fieldState: TState
}

/**
 * Render функция для createField
 *
 * Получает field API, resolved props, локальное состояние и должна вернуть полный JSX
 * включая Field.Root обёртку и отображение ошибок.
 */
export type FieldRenderFn<P extends BaseFieldProps, TValue = unknown, TState = Record<string, never>> = (
  props: FieldRenderProps<TValue, TState> & { componentProps: Omit<P, keyof BaseFieldProps> }
) => ReactElement

/**
 * Опции для createField
 *
 * @template P - Тип props компонента (extends BaseFieldProps)
 * @template TValue - Тип значения поля
 * @template TState - Тип локального состояния (из useFieldState)
 */
export interface CreateFieldOptions<P extends BaseFieldProps, TValue = unknown, TState = Record<string, never>> {
  /** Имя для React DevTools */
  displayName: string

  /**
   * Хук для локального состояния компонента
   *
   * Вызывается на верхнем уровне компонента, ДО form.Field.
   * Можно использовать useState, useEffect, useCallback, useMemo и другие хуки.
   *
   * @param props - Props компонента (без BaseFieldProps)
   * @param resolved - Resolved props (label, placeholder, etc.)
   * @returns Объект состояния, который будет передан в render как fieldState
   *
   * @example
   * ```tsx
   * useFieldState: (props) => {
   *   const [visible, setVisible] = useState(props.defaultVisible ?? false)
   *   return { visible, toggle: () => setVisible((v) => !v) }
   * }
   * ```
   */
  useFieldState?: (componentProps: Omit<P, keyof BaseFieldProps>, resolved: ResolvedFieldProps) => TState

  /** Render функция (полный контроль над JSX) */
  render: FieldRenderFn<P, TValue, TState>
}

/**
 * Factory функция для создания Field компонентов с минимальным boilerplate
 *
 * Автоматически:
 * - Резолвит props из schema meta и form-level настроек
 * - Создаёт form.Field обёртку
 * - Вычисляет hasError и errorMessage
 * - Вызывает useFieldState для локального состояния (если задан)
 *
 * @example Простое поле (Input, Textarea)
 * ```tsx
 * export const FieldString = createField<StringFieldProps, string>({
 *   displayName: 'FieldString',
 *   render: ({ field, resolved, hasError, errorMessage }) => (
 *     <FieldWrapper resolved={resolved} hasError={hasError} errorMessage={errorMessage}>
 *       <Input
 *         value={field.state.value ?? ''}
 *         onChange={(e) => field.handleChange(e.target.value)}
 *         onBlur={field.handleBlur}
 *       />
 *     </FieldWrapper>
 *   ),
 * })
 * ```
 *
 * @example Поле с локальным состоянием (Password с toggle)
 * ```tsx
 * export const FieldPassword = createField<PasswordFieldProps, string, { visible: boolean; toggle: () => void }>({
 *   displayName: 'FieldPassword',
 *   useFieldState: (props) => {
 *     const [visible, setVisible] = useState(props.defaultVisible ?? false)
 *     return { visible, toggle: () => setVisible((v) => !v) }
 *   },
 *   render: ({ field, resolved, hasError, errorMessage, fieldState }) => (
 *     <FieldWrapper resolved={resolved} hasError={hasError} errorMessage={errorMessage}>
 *       <InputGroup endElement={<IconButton onClick={fieldState.toggle}>...</IconButton>}>
 *         <Input type={fieldState.visible ? 'text' : 'password'} ... />
 *       </InputGroup>
 *     </FieldWrapper>
 *   ),
 * })
 * ```
 *
 * @example Checkbox с кастомным лейблом
 * ```tsx
 * export const FieldCheckbox = createField<CheckboxFieldProps, boolean>({
 *   displayName: 'FieldCheckbox',
 *   render: ({ field, resolved, hasError, errorMessage, componentProps }) => (
 *     <Field.Root invalid={hasError} required={resolved.required} disabled={resolved.disabled}>
 *       <Checkbox.Root
 *         checked={!!field.state.value}
 *         onCheckedChange={(e) => field.handleChange(!!e.checked)}
 *         colorPalette={componentProps.colorPalette}
 *       >
 *         <Checkbox.HiddenInput onBlur={field.handleBlur} />
 *         <Checkbox.Control />
 *         {resolved.label && <Checkbox.Label>{resolved.label}</Checkbox.Label>}
 *       </Checkbox.Root>
 *       <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
 *     </Field.Root>
 *   ),
 * })
 * ```
 */
export function createField<P extends BaseFieldProps, TValue = unknown, TState = Record<string, never>>(
  options: CreateFieldOptions<P, TValue, TState>
): (props: P) => ReactElement {
  const { displayName, useFieldState, render } = options

  function FieldComponent(props: P): ReactElement {
    const { name, label, placeholder, helperText, required, disabled, readOnly, tooltip, ...componentProps } = props

    const { form, fullPath, ...resolvedRest } = useResolvedFieldProps(name, {
      label,
      placeholder,
      helperText,
      required,
      disabled,
      readOnly,
      tooltip,
    })

    const resolved: ResolvedFieldProps = {
      label: resolvedRest.label,
      placeholder: resolvedRest.placeholder,
      helperText: resolvedRest.helperText,
      tooltip: resolvedRest.tooltip,
      required: resolvedRest.required,
      disabled: resolvedRest.disabled,
      readOnly: resolvedRest.readOnly,
      constraints: resolvedRest.constraints,
      options: resolvedRest.options,
    }

    // Вызываем useFieldState на верхнем уровне (до form.Field)
    // Это позволяет использовать хуки внутри useFieldState
    const fieldState = useFieldState
      ? useFieldState(componentProps as Omit<P, keyof BaseFieldProps>, resolved)
      : ({} as TState)

    return (
      <form.Field name={fullPath}>
        {(field: AnyFieldApi) => {
          const errors = field.state.meta.errors
          const hasError = hasFieldErrors(errors)
          const errorMessage = hasError ? formatFieldErrors(errors) : ''

          return render({
            field,
            value: field.state.value as TValue,
            fullPath,
            resolved,
            hasError,
            errorMessage,
            fieldState,
            componentProps: componentProps as Omit<P, keyof BaseFieldProps>,
          })
        }}
      </form.Field>
    )
  }

  FieldComponent.displayName = displayName
  return FieldComponent
}

/**
 * Компонент для отображения ошибок или подсказки
 *
 * Вспомогательный компонент для использования внутри createField render функций.
 * Показывает ошибку если есть, иначе helperText.
 *
 * @example
 * ```tsx
 * <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
 * ```
 */
export function FieldError({
  hasError,
  errorMessage,
  helperText,
}: {
  hasError: boolean
  errorMessage: string
  helperText: ReactNode
}): ReactElement | null {
  if (hasError) {
    return <Field.ErrorText>{errorMessage}</Field.ErrorText>
  }
  if (helperText) {
    return <Field.HelperText>{helperText}</Field.HelperText>
  }
  return null
}

// Реэкспорт для удобства
export { FieldLabel }

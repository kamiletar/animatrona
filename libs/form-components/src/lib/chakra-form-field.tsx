'use client'

import { Field as ChakraField } from '@chakra-ui/react'
import { forwardRef, type ReactNode } from 'react'
import { useTanStackFormField } from './tanstack-form-field'

export interface ChakraFormFieldProps extends Omit<ChakraField.RootProps, 'label' | 'invalid'> {
  /** Текст лейбла поля */
  label?: ReactNode
  /** Вспомогательный текст под полем */
  helperText?: ReactNode
  /** Переопределение текста ошибки (по умолчанию использует ошибки TanStack Form) */
  errorText?: ReactNode
  /** Текст для необязательного поля */
  optionalText?: ReactNode
  /** Показывать индикатор обязательного поля */
  required?: boolean
  /** Переопределение состояния невалидности (по умолчанию использует ошибки TanStack Form) */
  invalid?: boolean
  /** Дочерние элементы — сам элемент ввода формы */
  children: ReactNode
}

/**
 * ChakraFormField - поле Chakra UI v3 с интеграцией TanStack Form
 *
 * Автоматически отображает ошибки валидации из API поля TanStack Form.
 * Должен использоваться внутри компонента TanStackFormField.
 *
 * @example
 * ```tsx
 * <form.Field name="email">
 *   {(field) => (
 *     <TanStackFormField name="email" field={field}>
 *       <ChakraFormField label="Email" helperText="Ваш рабочий email" required>
 *         <Input
 *           value={field.state.value}
 *           onChange={(e) => field.handleChange(e.target.value)}
 *           onBlur={field.handleBlur}
 *         />
 *       </ChakraFormField>
 *     </TanStackFormField>
 *   )}
 * </form.Field>
 * ```
 */
export const ChakraFormField = forwardRef<HTMLDivElement, ChakraFormFieldProps>(function ChakraFormField(props, ref) {
  const { label, children, helperText, errorText, optionalText, required, invalid, ...rest } = props

  const fieldContext = useTanStackFormField()

  // Получаем ошибки из поля TanStack Form
  const fieldErrors = fieldContext?.field.state.meta.errors
  const hasErrors = fieldErrors && fieldErrors.length > 0
  const isInvalid = invalid ?? hasErrors

  // Форматируем сообщения об ошибках
  const errorMessages =
    errorText ??
    (hasErrors
      ? fieldErrors
          .map((e: unknown) => (typeof e === 'string' ? e : ((e as { message?: string }).message ?? String(e))))
          .join(', ')
      : undefined)

  // Workaround: Chakra UI Field типы не включают children в Next.js 16 production build
  const FieldLabel = ChakraField.Label as React.FC<{ children: ReactNode }>
  const FieldHelperText = ChakraField.HelperText as React.FC<{ children: ReactNode }>
  const FieldErrorText = ChakraField.ErrorText as React.FC<{ children: ReactNode }>

  return (
    <ChakraField.Root ref={ref} invalid={isInvalid} required={required} {...rest}>
      {label && (
        <FieldLabel>
          {label}
          <ChakraField.RequiredIndicator fallback={optionalText} />
        </FieldLabel>
      )}
      {children}
      {helperText && !isInvalid && <FieldHelperText>{helperText}</FieldHelperText>}
      {isInvalid && errorMessages && <FieldErrorText>{errorMessages}</FieldErrorText>}
    </ChakraField.Root>
  )
})

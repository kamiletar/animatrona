'use client'

import { PinInput } from '@chakra-ui/react'
import type { ReactElement } from 'react'
import type { BaseFieldProps } from '../../types'
import { createField, FieldWrapper } from '../base'

/**
 * Props для PinInput поля
 */
export interface PinInputFieldProps extends BaseFieldProps {
  /** Количество input боксов (по умолчанию: 4) */
  count?: number
  /** Маскировать как пароль */
  mask?: boolean
  /** Включить OTP автозаполнение */
  otp?: boolean
  /** Тип ввода: numeric, alphanumeric, alphabetic (по умолчанию: numeric) */
  type?: 'numeric' | 'alphanumeric' | 'alphabetic'
  /** Размер: 2xs, xs, sm, md, lg, xl, 2xl (по умолчанию: md) */
  size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** Вариант: outline, subtle, flushed (по умолчанию: outline) */
  variant?: 'outline' | 'subtle' | 'flushed'
  /** Соединить inputs вместе (без gap) */
  attached?: boolean
  /** Callback когда все поля заполнены */
  onComplete?: (value: string) => void
}

/**
 * Form.Field.PinInput - Поле ввода PIN/OTP кода
 *
 * Рендерит серию single-character inputs для PIN кодов, OTP и т.д.
 * Значение формы хранится как строка (например, "1234").
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.PinInput name="pin" label="Введите PIN" />
 * ```
 *
 * @example OTP с 6 цифрами
 * ```tsx
 * <Form.Field.PinInput
 *   name="otp"
 *   label="Код подтверждения"
 *   count={6}
 *   otp
 *   onComplete={(code) => verifyCode(code)}
 * />
 * ```
 *
 * @example Маскированный как пароль
 * ```tsx
 * <Form.Field.PinInput name="secret" mask count={6} />
 * ```
 */
export const FieldPinInput = createField<PinInputFieldProps, string>({
  displayName: 'FieldPinInput',

  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const {
      count = 4,
      mask,
      otp,
      type = 'numeric',
      size = 'md',
      variant = 'outline',
      attached,
      onComplete,
    } = componentProps

    // Конвертируем строку в массив для PinInput
    const stringValue = (field.state.value as string) ?? ''
    const arrayValue = stringValue.split('').slice(0, count)
    // Дополняем пустыми строками до count
    while (arrayValue.length < count) {
      arrayValue.push('')
    }

    const handleValueChange = (details: { value: string[] }) => {
      // Конвертируем массив обратно в строку
      const newValue = details.value.join('')
      field.handleChange(newValue)
    }

    const handleValueComplete = (details: { value: string[] }) => {
      const completeValue = details.value.join('')
      onComplete?.(completeValue)
    }

    return (
      <FieldWrapper resolved={resolved} hasError={hasError} errorMessage={errorMessage} fullPath={fullPath}>
        <PinInput.Root
          value={arrayValue}
          onValueChange={handleValueChange}
          onValueComplete={handleValueComplete}
          placeholder={resolved.placeholder}
          mask={mask}
          otp={otp}
          type={type}
          size={size}
          variant={variant}
          attached={attached}
          disabled={resolved.disabled}
          readOnly={resolved.readOnly}
          invalid={hasError}
          count={count}
          onBlur={field.handleBlur}
          data-field-name={fullPath}
        >
          <PinInput.HiddenInput />
          <PinInput.Control>
            {Array.from({ length: count }).map((_, index) => (
              <PinInput.Input key={index} index={index} />
            ))}
          </PinInput.Control>
        </PinInput.Root>
      </FieldWrapper>
    )
  },
})

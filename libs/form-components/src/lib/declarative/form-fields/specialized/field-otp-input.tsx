'use client'

import { Box, Button, HStack, PinInput, Text } from '@chakra-ui/react'
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { useDeclarativeForm } from '../../form-context'
import type { OTPInputFieldProps } from '../../types'
import { createField, FieldWrapper } from '../base'

/**
 * Состояние для OTP поля с таймером
 */
interface OTPFieldState {
  /** Счётчик секунд до возможности повторной отправки */
  countdown: number
  /** Идёт ли процесс повторной отправки */
  isResending: boolean
  /** Обработчик повторной отправки */
  handleResend: () => Promise<void>
  /** Форматированный countdown (MM:SS) */
  formatCountdown: (seconds: number) => string
}

/**
 * Form.Field.OTPInput - Поле ввода OTP с таймером повторной отправки
 *
 * Рендерит PIN input для OTP верификации с опциональной функцией повторной отправки.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.OTPInput name="code" label="Код подтверждения" />
 * ```
 *
 * @example С повторной отправкой
 * ```tsx
 * <Form.Field.OTPInput
 *   name="code"
 *   length={6}
 *   resendTimeout={60}
 *   onResend={async () => { await sendCode() }}
 *   autoSubmit
 * />
 * ```
 *
 * @example Буквенно-цифровой ввод
 * ```tsx
 * <Form.Field.OTPInput name="code" type="alphanumeric" />
 * ```
 */
export const FieldOTPInput = createField<OTPInputFieldProps, string, OTPFieldState>({
  displayName: 'FieldOTPInput',

  useFieldState: (props) => {
    const [countdown, setCountdown] = useState(0)
    const [isResending, setIsResending] = useState(false)

    // Эффект таймера countdown
    useEffect(() => {
      if (countdown <= 0) {
        return
      }

      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1)
      }, 1000)

      return () => clearInterval(timer)
    }, [countdown])

    const handleResend = useCallback(async () => {
      if (!props.onResend || countdown > 0) {
        return
      }

      setIsResending(true)
      try {
        await props.onResend()
        setCountdown(props.resendTimeout ?? 60)
      } finally {
        setIsResending(false)
      }
    }, [props.onResend, countdown, props.resendTimeout])

    // Форматирование countdown как MM:SS
    const formatCountdown = (seconds: number): string => {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return { countdown, isResending, handleResend, formatCountdown }
  },

  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps, fieldState }): ReactElement => {
    const formContext = useDeclarativeForm()
    const { length = 6, autoSubmit = false, type = 'numeric', mask = false, onResend } = componentProps
    const { countdown, isResending, handleResend, formatCountdown } = fieldState

    const value = (field.state.value as string) ?? ''

    const handleValueComplete = (details: { value: string[]; valueAsString: string }) => {
      field.handleChange(details.valueAsString)

      // Авто-submit когда заполнено
      if (autoSubmit && details.valueAsString.length === length) {
        formContext.form.handleSubmit()
      }
    }

    return (
      <FieldWrapper resolved={resolved} hasError={hasError} errorMessage={errorMessage} fullPath={fullPath}>
        <Box>
          <PinInput.Root
            value={value.split('')}
            onValueComplete={handleValueComplete}
            onValueChange={(details) => field.handleChange(details.valueAsString)}
            count={length}
            type={type}
            mask={mask}
            otp
          >
            <PinInput.Control>
              <HStack gap={2}>
                {Array.from({ length }).map((_, index) => (
                  <PinInput.Input key={index} index={index} data-field-name={index === 0 ? fullPath : undefined} />
                ))}
              </HStack>
            </PinInput.Control>
            <PinInput.HiddenInput />
          </PinInput.Root>

          {onResend && (
            <HStack mt={3} justify="center">
              {countdown > 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  Повторить через {formatCountdown(countdown)}
                </Text>
              ) : (
                <Button variant="ghost" size="sm" onClick={handleResend} disabled={isResending} loading={isResending}>
                  Отправить повторно
                </Button>
              )}
            </HStack>
          )}
        </Box>
      </FieldWrapper>
    )
  },
})

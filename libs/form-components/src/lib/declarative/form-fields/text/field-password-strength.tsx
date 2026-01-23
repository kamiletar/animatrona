'use client'

import { Box, Field, HStack, IconButton, Input, List, Progress, Text, VStack } from '@chakra-ui/react'
import { useState, type ReactElement } from 'react'
import { LuCheck, LuEye, LuEyeOff, LuX } from 'react-icons/lu'
import type { PasswordRequirement, PasswordStrengthFieldProps } from '../../types'
import { createField, FieldError, FieldLabel } from '../base'

/**
 * Требования к паролю по умолчанию
 */
const DEFAULT_REQUIREMENTS: PasswordRequirement[] = ['minLength:8', 'uppercase', 'lowercase', 'number', 'special']

/**
 * Описания требований
 */
const REQUIREMENT_LABELS: Record<PasswordRequirement, string> = {
  'minLength:8': 'Минимум 8 символов',
  uppercase: 'Минимум одна заглавная буква',
  lowercase: 'Минимум одна строчная буква',
  number: 'Минимум одна цифра',
  special: 'Минимум один специальный символ (!@#$%^&*)',
}

/**
 * Проверяет соответствие пароля требованию
 */
function checkRequirement(password: string, requirement: PasswordRequirement): boolean {
  switch (requirement) {
    case 'minLength:8':
      return password.length >= 8
    case 'uppercase':
      return /[A-Z]/.test(password)
    case 'lowercase':
      return /[a-z]/.test(password)
    case 'number':
      return /[0-9]/.test(password)
    case 'special':
      return /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
    default:
      return false
  }
}

/**
 * Вычисляет силу пароля (0-100)
 */
function calculateStrength(password: string, requirements: PasswordRequirement[]): number {
  if (!password) {
    return 0
  }

  const metCount = requirements.filter((req) => checkRequirement(password, req)).length
  return Math.round((metCount / requirements.length) * 100)
}

/**
 * Получает описание и цвет силы пароля
 */
function getStrengthInfo(strength: number): { label: string; colorPalette: string } {
  if (strength < 25) {
    return { label: 'Слабый', colorPalette: 'red' }
  }
  if (strength < 50) {
    return { label: 'Средний', colorPalette: 'orange' }
  }
  if (strength < 75) {
    return { label: 'Хороший', colorPalette: 'yellow' }
  }
  return { label: 'Сильный', colorPalette: 'green' }
}

/**
 * Состояние для поля пароля с индикатором силы
 */
interface PasswordStrengthFieldState {
  /** Видимость пароля */
  visible: boolean
  /** Переключить видимость */
  toggle: () => void
}

/**
 * Form.Field.PasswordStrength - Пароль с индикатором силы
 *
 * Рендерит поле пароля с визуальным индикатором силы и чеклистом требований.
 *
 * @example С требованиями по умолчанию
 * ```tsx
 * <Form.Field.PasswordStrength name="password" label="Пароль" showRequirements />
 * ```
 *
 * @example С кастомными требованиями
 * ```tsx
 * <Form.Field.PasswordStrength
 *   name="password"
 *   requirements={['minLength:8', 'uppercase', 'number']}
 *   showRequirements
 * />
 * ```
 */
export const FieldPasswordStrength = createField<PasswordStrengthFieldProps, string, PasswordStrengthFieldState>({
  displayName: 'FieldPasswordStrength',

  useFieldState: (props) => {
    const [visible, setVisible] = useState(props.defaultVisible ?? false)
    return { visible, toggle: () => setVisible((v) => !v) }
  },

  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps, fieldState }): ReactElement => {
    const { requirements = DEFAULT_REQUIREMENTS, showRequirements = true } = componentProps
    const { visible, toggle } = fieldState

    const value = (field.state.value as string) ?? ''
    const strength = calculateStrength(value, requirements)
    const { label: strengthLabel, colorPalette } = getStrengthInfo(strength)

    return (
      <Field.Root
        invalid={hasError}
        required={resolved.required}
        disabled={resolved.disabled}
        readOnly={resolved.readOnly}
      >
        <FieldLabel label={resolved.label} tooltip={resolved.tooltip} required={resolved.required} />
        <VStack gap={2} align="stretch" width="100%">
          <HStack>
            <Input
              type={visible ? 'text' : 'password'}
              value={value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder={resolved.placeholder ?? 'Введите пароль'}
              data-field-name={fullPath}
              flex={1}
            />
            <IconButton
              aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
              onClick={toggle}
              variant="ghost"
              size="sm"
            >
              {visible ? <LuEyeOff /> : <LuEye />}
            </IconButton>
          </HStack>

          {value && (
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="xs" color="fg.muted">
                  Сила
                </Text>
                <Text fontSize="xs" fontWeight="medium" color={`${colorPalette}.600`}>
                  {strengthLabel}
                </Text>
              </HStack>
              <Progress.Root value={strength} colorPalette={colorPalette} size="xs">
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
            </Box>
          )}

          {showRequirements && value && (
            <List.Root fontSize="sm" gap={1}>
              {requirements.map((req) => {
                const met = checkRequirement(value, req)
                return (
                  <List.Item key={req} display="flex" alignItems="center" gap={2}>
                    <Box color={met ? 'green.500' : 'gray.400'}>{met ? <LuCheck size={14} /> : <LuX size={14} />}</Box>
                    <Text color={met ? 'fg.default' : 'fg.muted'}>{REQUIREMENT_LABELS[req]}</Text>
                  </List.Item>
                )
              })}
            </List.Root>
          )}
        </VStack>
        <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
      </Field.Root>
    )
  },
})

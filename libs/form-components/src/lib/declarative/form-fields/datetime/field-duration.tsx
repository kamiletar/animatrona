'use client'

import { Field, HStack, NumberInput, Text } from '@chakra-ui/react'
import type { ReactElement } from 'react'
import type { DurationFieldProps } from '../../types'
import { createField, FieldError, FieldLabel } from '../base'

/**
 * Конвертирует минуты в формат ЧЧ:ММ
 */
function minutesToHHMM(minutes: number): { hours: number; mins: number } {
  return {
    hours: Math.floor(minutes / 60),
    mins: minutes % 60,
  }
}

/**
 * Конвертирует ЧЧ:ММ в минуты
 */
function hhmmToMinutes(hours: number, mins: number): number {
  return hours * 60 + mins
}

/**
 * Form.Field.Duration - Поле ввода длительности
 *
 * Рендерит поле длительности с часами и минутами или только минутами.
 * Значение хранится как общее количество минут.
 *
 * @example Формат ЧЧ:ММ (по умолчанию)
 * ```tsx
 * <Form.Field.Duration name="duration" label="Длительность" />
 * ```
 *
 * @example Только минуты
 * ```tsx
 * <Form.Field.Duration name="duration" format="minutes" />
 * ```
 *
 * @example С ограничениями min/max
 * ```tsx
 * <Form.Field.Duration name="duration" min={30} max={240} step={15} />
 * ```
 */
export const FieldDuration = createField<DurationFieldProps, number>({
  displayName: 'FieldDuration',

  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const { format = 'HH:MM', min = 0, max = 1440, step = 15 } = componentProps

    const value = (field.state.value as number) ?? 0
    const { hours, mins } = minutesToHHMM(value)

    const handleHoursChange = (newHours: number) => {
      const newValue = hhmmToMinutes(newHours, mins)
      const clampedValue = Math.max(min, Math.min(max, newValue))
      field.handleChange(clampedValue)
    }

    const handleMinsChange = (newMins: number) => {
      const newValue = hhmmToMinutes(hours, newMins)
      const clampedValue = Math.max(min, Math.min(max, newValue))
      field.handleChange(clampedValue)
    }

    const handleMinutesChange = (newValue: number) => {
      const clampedValue = Math.max(min, Math.min(max, newValue))
      field.handleChange(clampedValue)
    }

    // Формат только минуты
    if (format === 'minutes') {
      return (
        <Field.Root
          invalid={hasError}
          required={resolved.required}
          disabled={resolved.disabled}
          readOnly={resolved.readOnly}
        >
          <FieldLabel label={resolved.label} tooltip={resolved.tooltip} required={resolved.required} />
          <NumberInput.Root
            value={value.toString()}
            onValueChange={(details: { valueAsNumber: number }) => {
              const num = details.valueAsNumber
              if (!Number.isNaN(num)) {
                handleMinutesChange(num)
              }
            }}
            onBlur={field.handleBlur}
            min={min}
            max={max}
            step={step}
          >
            <NumberInput.Control>
              <NumberInput.IncrementTrigger />
              <NumberInput.DecrementTrigger />
            </NumberInput.Control>
            <NumberInput.Input placeholder={resolved.placeholder ?? 'мин'} data-field-name={fullPath} />
          </NumberInput.Root>
          <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
        </Field.Root>
      )
    }

    // Формат ЧЧ:ММ
    return (
      <Field.Root
        invalid={hasError}
        required={resolved.required}
        disabled={resolved.disabled}
        readOnly={resolved.readOnly}
      >
        <FieldLabel label={resolved.label} tooltip={resolved.tooltip} required={resolved.required} />
        <HStack gap={2}>
          <NumberInput.Root
            value={hours.toString()}
            onValueChange={(details: { valueAsNumber: number }) => {
              const num = details.valueAsNumber
              if (!Number.isNaN(num)) {
                handleHoursChange(num)
              }
            }}
            onBlur={field.handleBlur}
            min={0}
            max={Math.floor(max / 60)}
            width="80px"
          >
            <NumberInput.Control>
              <NumberInput.IncrementTrigger />
              <NumberInput.DecrementTrigger />
            </NumberInput.Control>
            <NumberInput.Input data-field-name={`${fullPath}-hours`} />
          </NumberInput.Root>
          <Text fontWeight="bold">:</Text>
          <NumberInput.Root
            value={mins.toString().padStart(2, '0')}
            onValueChange={(details: { valueAsNumber: number }) => {
              const num = details.valueAsNumber
              if (!Number.isNaN(num)) {
                handleMinsChange(num)
              }
            }}
            onBlur={field.handleBlur}
            min={0}
            max={59}
            step={step}
            width="80px"
          >
            <NumberInput.Control>
              <NumberInput.IncrementTrigger />
              <NumberInput.DecrementTrigger />
            </NumberInput.Control>
            <NumberInput.Input data-field-name={`${fullPath}-mins`} />
          </NumberInput.Root>
        </HStack>
        <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
      </Field.Root>
    )
  },
})

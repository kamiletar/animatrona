'use client'

import { NumberInput } from '@chakra-ui/react'
import { useMemo, type ReactElement } from 'react'
import type { PercentageFieldProps } from '../../types'
import { createField, FieldWrapper } from '../base'

/**
 * Form.Field.Percentage - Поле ввода процентов
 *
 * Рендерит NumberInput с форматированием процентов и символом %.
 * Значение хранится как есть (50 = 50%), а не как десятичная дробь (0.5).
 *
 * @example Базовое использование (0-100%)
 * ```tsx
 * <Form.Field.Percentage name="discount" label="Скидка" />
 * ```
 *
 * @example С кастомным диапазоном
 * ```tsx
 * <Form.Field.Percentage name="margin" label="Маржа" min={0} max={50} />
 * ```
 *
 * @example С десятичными
 * ```tsx
 * <Form.Field.Percentage name="rate" label="Ставка" decimalScale={2} step={0.1} />
 * ```
 */
export const FieldPercentage = createField<PercentageFieldProps, number | undefined>({
  displayName: 'FieldPercentage',

  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const value = field.state.value as number | undefined

    const { min = 0, max = 100, step = 1, decimalScale = 0, size } = componentProps

    // Используем 'unit' стиль с percent, чтобы хранить целые числа (50 = 50%)
    // Стиль 'percent' от Chakra ожидает десятичные (0.5 = 50%)
    const formatOptions = useMemo(
      () => ({
        style: 'unit' as const,
        unit: 'percent',
        unitDisplay: 'short' as const,
        minimumFractionDigits: decimalScale,
        maximumFractionDigits: decimalScale,
      }),
      [decimalScale]
    )

    return (
      <FieldWrapper resolved={resolved} hasError={hasError} errorMessage={errorMessage} fullPath={fullPath}>
        <NumberInput.Root
          value={value?.toString() ?? ''}
          onValueChange={(details: { valueAsNumber: number }) => {
            const num = details.valueAsNumber
            field.handleChange(Number.isNaN(num) ? undefined : num)
          }}
          onBlur={field.handleBlur}
          min={min}
          max={max}
          step={step}
          formatOptions={formatOptions}
          clampValueOnBlur
          size={size}
        >
          <NumberInput.Control>
            <NumberInput.IncrementTrigger />
            <NumberInput.DecrementTrigger />
          </NumberInput.Control>
          <NumberInput.Input placeholder={resolved.placeholder} data-field-name={fullPath} />
        </NumberInput.Root>
      </FieldWrapper>
    )
  },
})

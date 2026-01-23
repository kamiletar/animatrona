'use client'

import { NumberInput } from '@chakra-ui/react'
import { useMemo, type ReactElement } from 'react'
import type { CurrencyFieldProps } from '../../types'
import { createField, FieldWrapper } from '../base'

/**
 * Form.Field.Currency - Поле ввода валюты
 *
 * Рендерит NumberInput с форматированием валюты (символ и дробная часть).
 *
 * @example Российские рубли (по умолчанию)
 * ```tsx
 * <Form.Field.Currency name="price" label="Цена" />
 * ```
 *
 * @example Доллары США
 * ```tsx
 * <Form.Field.Currency name="amount" label="Сумма" currency="USD" />
 * ```
 *
 * @example Евро с кодом валюты
 * ```tsx
 * <Form.Field.Currency
 *   name="total"
 *   label="Итого"
 *   currency="EUR"
 *   currencyDisplay="code"
 * />
 * ```
 */
export const FieldCurrency = createField<CurrencyFieldProps, number | undefined>({
  displayName: 'FieldCurrency',

  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const value = field.state.value as number | undefined

    const {
      currency = 'RUB',
      currencyDisplay = 'symbol',
      decimalScale = 2,
      min,
      max,
      step = 0.01,
      size,
    } = componentProps

    // Мемоизируем formatOptions
    const formatOptions = useMemo(
      () => ({
        style: 'currency' as const,
        currency,
        currencyDisplay,
        minimumFractionDigits: decimalScale,
        maximumFractionDigits: decimalScale,
      }),
      [currency, currencyDisplay, decimalScale]
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

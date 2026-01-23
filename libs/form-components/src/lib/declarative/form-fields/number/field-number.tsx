'use client'

import { NumberInput } from '@chakra-ui/react'
import type { ReactElement } from 'react'
import type { NumberFieldProps } from '../../types'
import { createField, FieldWrapper } from '../base'

/**
 * Form.Field.Number - Number input field
 *
 * Renders a Chakra NumberInput with automatic form integration and error display.
 *
 * Автоматически извлекает из Zod схемы:
 * - `min` из `z.number().min(1)` → min={1}
 * - `max` из `z.number().max(100)` → max={100}
 * - `step` из `z.number().int()` → step={1}, или `z.number().multipleOf(0.5)` → step={0.5}
 * - `helperText` автоматически генерируется из constraints ("От 1 до 100")
 *
 * Props всегда имеют приоритет над автоматическими значениями из схемы.
 *
 * @example
 * ```tsx
 * <Form.Field.Number name="portions" label="Portions" />
 * // С z.number().min(1).max(100) автоматически: min={1} max={100} helperText="От 1 до 100"
 * ```
 */
export const FieldNumber = createField<NumberFieldProps, number | undefined>({
  displayName: 'FieldNumber',
  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const value = field.state.value as number | undefined
    const { constraints } = resolved

    // Props имеют приоритет над constraints
    const min = componentProps.min ?? constraints.number?.min
    const max = componentProps.max ?? constraints.number?.max
    const step = componentProps.step ?? constraints.number?.step

    // Для опциональных полей не передаём min/max в NumberInput когда значение пустое,
    // иначе Chakra будет показывать invalid state для пустого значения
    const isOptional = resolved.required === false
    const isEmpty = value === undefined || value === null
    const shouldApplyMinMax = !isOptional || !isEmpty

    return (
      <FieldWrapper resolved={resolved} hasError={hasError} errorMessage={errorMessage} fullPath={fullPath}>
        <NumberInput.Root
          value={value?.toString() ?? ''}
          onValueChange={(details: { valueAsNumber: number }) => {
            const num = details.valueAsNumber
            field.handleChange(Number.isNaN(num) ? undefined : num)
          }}
          onBlur={field.handleBlur}
          min={shouldApplyMinMax ? min : undefined}
          max={shouldApplyMinMax ? max : undefined}
          step={step}
        >
          <NumberInput.Control>
            <NumberInput.IncrementTrigger />
            <NumberInput.DecrementTrigger />
          </NumberInput.Control>
          <NumberInput.Input placeholder={resolved.placeholder} data-field-name={fullPath} inputMode="decimal" />
        </NumberInput.Root>
      </FieldWrapper>
    )
  },
})

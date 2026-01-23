'use client'

import { Input } from '@chakra-ui/react'
import type { ReactElement } from 'react'
import type { DateFieldProps } from '../../types'
import { createField, FieldWrapper } from '../base'

/**
 * Form.Field.Date - Date input field
 *
 * Renders a native date input with automatic form integration and error display.
 *
 * Автоматически извлекает из Zod схемы:
 * - `min` из `z.date().min(new Date('2024-01-01'))` → min="2024-01-01"
 * - `max` из `z.date().max(new Date('2024-12-31'))` → max="2024-12-31"
 * - `helperText` автоматически генерируется из constraints ("С 1 января 2024 г. по 31 декабря 2024 г.")
 *
 * Props всегда имеют приоритет над автоматическими значениями из схемы.
 *
 * @example
 * ```tsx
 * <Form.Field.Date name="birthDate" label="Date of Birth" />
 * ```
 *
 * @example С автоматическими constraints из Zod
 * ```tsx
 * // В схеме: z.object({ eventDate: z.date().min(new Date('2024-01-01')).max(new Date('2024-12-31')) })
 * <Form.Field.Date name="eventDate" label="Event Date" />
 * // Автоматически: min="2024-01-01", max="2024-12-31"
 * ```
 */
export const FieldDate = createField<DateFieldProps, string | Date>({
  displayName: 'FieldDate',
  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const { constraints } = resolved

    // Handle Date objects by converting to YYYY-MM-DD string
    const rawValue = field.state.value
    let stringValue = ''
    if (rawValue instanceof Date) {
      stringValue = rawValue.toISOString().split('T')[0]
    } else if (typeof rawValue === 'string') {
      stringValue = rawValue
    }

    // Props имеют приоритет над constraints
    const min = componentProps.min ?? constraints.date?.min
    const max = componentProps.max ?? constraints.date?.max

    return (
      <FieldWrapper resolved={resolved} hasError={hasError} errorMessage={errorMessage} fullPath={fullPath}>
        <Input
          type="date"
          value={stringValue}
          onChange={(e) => field.handleChange((e.target as HTMLInputElement).value)}
          onBlur={field.handleBlur}
          placeholder={resolved.placeholder}
          min={min}
          max={max}
          data-field-name={fullPath}
        />
      </FieldWrapper>
    )
  },
})

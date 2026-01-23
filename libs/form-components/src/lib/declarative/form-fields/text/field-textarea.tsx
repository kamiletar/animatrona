'use client'

import { Textarea } from '@chakra-ui/react'
import type { ReactElement } from 'react'
import type { TextareaFieldProps } from '../../types'
import { createField, FieldWrapper } from '../base'

/**
 * Form.Field.Textarea - Multiline text input field
 *
 * Renders a Chakra Textarea with automatic form integration and error display.
 *
 * Автоматически извлекает из Zod схемы:
 * - `maxLength` из `z.string().max(500)` → maxLength={500}
 * - `helperText` автоматически генерируется из constraints ("Максимум 500 символов")
 *
 * Props всегда имеют приоритет над автоматическими значениями из схемы.
 *
 * @example
 * ```tsx
 * <Form.Field.Textarea name="description" label="Description" rows={4} />
 * ```
 *
 * @example С автоматическими constraints из Zod
 * ```tsx
 * // В схеме: z.object({ bio: z.string().max(500) })
 * <Form.Field.Textarea name="bio" label="Bio" autoresize />
 * // Автоматически: maxLength={500} helperText="Максимум 500 символов"
 * ```
 */
export const FieldTextarea = createField<TextareaFieldProps, string>({
  displayName: 'FieldTextarea',
  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const { constraints } = resolved

    // Props имеют приоритет над constraints
    const maxLength = componentProps.maxLength ?? constraints.string?.maxLength

    return (
      <FieldWrapper resolved={resolved} hasError={hasError} errorMessage={errorMessage} fullPath={fullPath}>
        <Textarea
          value={(field.state.value as string) ?? ''}
          onChange={(e) => field.handleChange((e.target as HTMLTextAreaElement).value)}
          onBlur={field.handleBlur}
          placeholder={resolved.placeholder}
          rows={componentProps.rows}
          autoresize={componentProps.autoresize}
          resize={componentProps.resize ?? 'vertical'}
          maxLength={maxLength}
          data-field-name={fullPath}
        />
      </FieldWrapper>
    )
  },
})

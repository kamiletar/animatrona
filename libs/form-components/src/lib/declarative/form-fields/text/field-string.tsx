'use client'

import { Input } from '@chakra-ui/react'
import type { ReactElement } from 'react'
import type { StringFieldProps } from '../../types'
import { createField, FieldWrapper } from '../base'

/**
 * Form.Field.String - String input field
 *
 * Renders a Chakra Input with automatic form integration and error display.
 *
 * Автоматически извлекает из Zod схемы:
 * - `type` из `z.string().email()` → type="email", `z.string().url()` → type="url"
 * - `maxLength` из `z.string().max(100)` → maxLength={100}
 * - `minLength` из `z.string().min(2)` → minLength={2}
 * - `pattern` из `z.string().regex(/.../)` → pattern="..."
 * - `helperText` автоматически генерируется из constraints ("Максимум 100 символов")
 *
 * Props всегда имеют приоритет над автоматическими значениями из схемы.
 *
 * @example
 * ```tsx
 * <Form.Field.String name="title" label="Title" required />
 * ```
 *
 * @example С автоматическими constraints из Zod
 * ```tsx
 * // В схеме: z.object({ email: z.string().email().max(255) })
 * <Form.Field.String name="email" />
 * // Автоматически: type="email", maxLength={255}
 * ```
 *
 * @example In primitive array (no name)
 * ```tsx
 * <Form.Group.List name="tags">
 *   <Form.Field.String placeholder="Tag" />
 * </Form.Group.List>
 * ```
 */
/**
 * Автоматический inputMode по типу поля для мобильных клавиатур
 */
function getInputModeFromType(type: string): StringFieldProps['inputMode'] {
  switch (type) {
    case 'email':
      return 'email'
    case 'tel':
      return 'tel'
    case 'url':
      return 'url'
    default:
      return 'text'
  }
}

export const FieldString = createField<StringFieldProps, string>({
  displayName: 'FieldString',
  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const { constraints } = resolved

    // Props имеют приоритет над constraints
    const type = componentProps.type ?? constraints.string?.inputType ?? 'text'
    const maxLength = componentProps.maxLength ?? constraints.string?.maxLength
    const minLength = componentProps.minLength ?? constraints.string?.minLength
    const pattern = componentProps.pattern ?? constraints.string?.pattern
    // inputMode: явный prop > авто из type
    const inputMode = componentProps.inputMode ?? getInputModeFromType(type)

    return (
      <FieldWrapper resolved={resolved} hasError={hasError} errorMessage={errorMessage} fullPath={fullPath}>
        <Input
          type={type}
          inputMode={inputMode}
          value={(field.state.value as string) ?? ''}
          onChange={(e) => field.handleChange((e.target as HTMLInputElement).value)}
          onBlur={field.handleBlur}
          placeholder={resolved.placeholder}
          maxLength={maxLength}
          minLength={minLength}
          pattern={pattern}
          autoComplete={componentProps.autoComplete}
          data-field-name={fullPath}
        />
      </FieldWrapper>
    )
  },
})

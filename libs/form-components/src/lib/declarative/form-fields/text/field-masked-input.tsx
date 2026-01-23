'use client'

import { Input } from '@chakra-ui/react'
import { useCallback, type ReactElement } from 'react'
import { withMask } from 'use-mask-input'
import type { MaskedInputFieldProps } from '../../types'
import { createField, FieldWrapper } from '../base'

/**
 * Состояние для маскированного поля
 */
interface MaskedInputFieldState {
  /** Ref callback для применения маски */
  maskRef: (element: HTMLInputElement | null) => void
}

/**
 * Form.Field.MaskedInput - Поле ввода с маской
 *
 * Рендерит input с маской используя библиотеку use-mask-input.
 *
 * Символы маски:
 * - 9: цифра
 * - a: буква
 * - *: буква или цифра
 *
 * @example Маска паспорта
 * ```tsx
 * <Form.Field.MaskedInput name="passport" label="Паспорт" mask="99 99 999999" />
 * ```
 *
 * @example Несколько масок (адаптируется к вводу)
 * ```tsx
 * <Form.Field.MaskedInput name="phone" mask={['9999-9999', '99999-9999']} />
 * ```
 *
 * @example С кастомным placeholder символом
 * ```tsx
 * <Form.Field.MaskedInput name="date" mask="99/99/9999" placeholderChar="#" />
 * ```
 */
export const FieldMaskedInput = createField<MaskedInputFieldProps, string, MaskedInputFieldState>({
  displayName: 'FieldMaskedInput',

  useFieldState: (props) => {
    const {
      mask,
      placeholderChar = '_',
      showMaskOnFocus = true,
      showMaskOnHover = false,
      clearIncomplete = false,
      autoUnmask = false,
    } = props

    // Создаём ref callback для применения маски
    const maskRef = useCallback(
      (element: HTMLInputElement | null) => {
        if (element && mask) {
          const maskCallback = withMask(mask, {
            placeholder: placeholderChar,
            showMaskOnFocus,
            showMaskOnHover,
            clearIncomplete,
            autoUnmask,
          })
          maskCallback(element)
        }
      },
      [mask, placeholderChar, showMaskOnFocus, showMaskOnHover, clearIncomplete, autoUnmask]
    )

    return { maskRef }
  },

  render: ({ field, fullPath, resolved, hasError, errorMessage, fieldState }): ReactElement => (
    <FieldWrapper resolved={resolved} hasError={hasError} errorMessage={errorMessage} fullPath={fullPath}>
      <Input
        ref={fieldState.maskRef}
        value={(field.state.value as string) ?? ''}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        placeholder={resolved.placeholder}
        data-field-name={fullPath}
      />
    </FieldWrapper>
  ),
})

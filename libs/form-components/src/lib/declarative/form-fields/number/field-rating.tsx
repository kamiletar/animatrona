'use client'

import { Field, HStack, RatingGroup } from '@chakra-ui/react'
import type React from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { BaseFieldProps } from '../../types'
import { createField, FieldError } from '../base'
import { FieldTooltip } from '../base/field-tooltip'

/**
 * Props для Rating поля
 */
export interface RatingFieldProps extends Omit<BaseFieldProps, 'placeholder'> {
  /** Количество элементов рейтинга (по умолчанию: 5) */
  count?: number
  /** Разрешить половинные значения (по умолчанию: false) */
  allowHalf?: boolean
  /** Размер: xs, sm, md, lg (по умолчанию: md) */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Цветовая палитра (по умолчанию: gray) */
  colorPalette?: 'gray' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'cyan' | 'purple' | 'pink'
  /** Кастомная иконка (по умолчанию: звезда) */
  icon?: ReactNode
  /** Callback при изменении значения */
  onValueChange?: (value: number) => void
}

/**
 * Form.Field.Rating - Поле ввода рейтинга со звёздами
 *
 * Рендерит Chakra RatingGroup с автоматической интеграцией с формой.
 * Значение формы хранится как число.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.Rating name="rating" label="Рейтинг" />
 * ```
 *
 * @example С кастомным количеством и цветом
 * ```tsx
 * <Form.Field.Rating
 *   name="quality"
 *   label="Качество"
 *   count={10}
 *   colorPalette="orange"
 * />
 * ```
 *
 * @example С половинными значениями
 * ```tsx
 * <Form.Field.Rating
 *   name="score"
 *   label="Оценка"
 *   allowHalf
 *   size="lg"
 * />
 * ```
 */
export const FieldRating = createField<RatingFieldProps, number>({
  displayName: 'FieldRating',

  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const { count = 5, allowHalf = false, size = 'md', colorPalette, icon, onValueChange } = componentProps

    const value = (field.state.value as number) ?? 0

    const handleValueChange = (details: { value: number }) => {
      field.handleChange(details.value)
      onValueChange?.(details.value)
    }

    return (
      <Field.Root
        invalid={hasError}
        required={resolved.required}
        disabled={resolved.disabled}
        readOnly={resolved.readOnly}
      >
        <RatingGroup.Root
          value={value}
          onValueChange={handleValueChange}
          count={count}
          allowHalf={allowHalf}
          size={size}
          colorPalette={colorPalette}
          disabled={resolved.disabled}
          readOnly={resolved.readOnly}
          data-field-name={fullPath}
        >
          {resolved.label && (
            <RatingGroup.Label>
              {resolved.tooltip ? (
                <HStack gap={1}>
                  <span>{resolved.label}</span>
                  <FieldTooltip {...resolved.tooltip} />
                </HStack>
              ) : (
                resolved.label
              )}
            </RatingGroup.Label>
          )}
          <RatingGroup.HiddenInput onBlur={field.handleBlur} />
          <RatingGroup.Control>
            {Array.from({ length: count }).map((_, index) => (
              <RatingGroup.Item key={index} index={index + 1}>
                <RatingGroup.ItemIndicator icon={icon as React.ReactElement | undefined} />
              </RatingGroup.Item>
            ))}
          </RatingGroup.Control>
        </RatingGroup.Root>
        <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
      </Field.Root>
    )
  },
})

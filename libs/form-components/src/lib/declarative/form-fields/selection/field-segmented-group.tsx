'use client'

import { Field, SegmentGroup } from '@chakra-ui/react'
import type { ReactElement } from 'react'
import type { BaseFieldProps, BaseOption, FieldSize } from '../../types'
import { createField, FieldError, FieldLabel } from '../base'

/**
 * Props для SegmentedGroup поля
 */
export interface SegmentedGroupFieldProps<T = string> extends Omit<BaseFieldProps, 'placeholder'> {
  /** Опции для сегментированного контрола */
  options: BaseOption<T>[]
  /** Размер (по умолчанию: md) */
  size?: FieldSize
  /** Ориентация (по умолчанию: horizontal) */
  orientation?: 'horizontal' | 'vertical'
  /** Цветовая палитра */
  colorPalette?: string
}

/**
 * Form.Field.SegmentedGroup - Сегментированный контрол для единичного выбора
 *
 * Рендерит сегментированный контрол для выбора одной опции из набора.
 * Похож на radio кнопки, но стилизован как соединённые сегменты.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.SegmentedGroup
 *   name="size"
 *   label="Размер"
 *   options={[
 *     { label: 'S', value: 'sm' },
 *     { label: 'M', value: 'md' },
 *     { label: 'L', value: 'lg' },
 *   ]}
 * />
 * ```
 *
 * @example Разные размеры
 * ```tsx
 * <Form.Field.SegmentedGroup
 *   name="billing"
 *   options={[
 *     { label: 'Месячная', value: 'monthly' },
 *     { label: 'Годовая', value: 'yearly' },
 *   ]}
 *   size="sm"
 * />
 * ```
 */
export const FieldSegmentedGroup = createField<SegmentedGroupFieldProps, string>({
  displayName: 'FieldSegmentedGroup',
  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => (
    <Field.Root
      invalid={hasError}
      required={resolved.required}
      disabled={resolved.disabled}
      readOnly={resolved.readOnly}
    >
      <FieldLabel label={resolved.label} tooltip={resolved.tooltip} required={resolved.required} />
      <SegmentGroup.Root
        value={(field.state.value as string) ?? ''}
        onValueChange={(details) => field.handleChange(details.value)}
        disabled={resolved.disabled}
        name={fullPath}
        size={componentProps.size ?? 'md'}
        orientation={componentProps.orientation ?? 'horizontal'}
        colorPalette={componentProps.colorPalette}
      >
        <SegmentGroup.Indicator />
        {componentProps.options.map((opt) => (
          <SegmentGroup.Item key={opt.value} value={opt.value} disabled={opt.disabled}>
            <SegmentGroup.ItemText>{opt.label}</SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        ))}
      </SegmentGroup.Root>
      <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
    </Field.Root>
  ),
})

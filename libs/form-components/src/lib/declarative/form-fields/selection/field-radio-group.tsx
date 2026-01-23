'use client'

import { Field, RadioGroup } from '@chakra-ui/react'
import type { ReactElement } from 'react'
import type { BaseFieldProps, BaseOption, FieldSize } from '../../types'
import { createField, FieldError, FieldLabel, getOptionLabel } from '../base'

/**
 * Props для RadioGroup поля
 */
export interface RadioGroupFieldProps<T = string> extends Omit<BaseFieldProps, 'placeholder'> {
  /** Опции для radio группы */
  options: BaseOption<T>[]
  /** Ориентация (по умолчанию: vertical) */
  orientation?: 'horizontal' | 'vertical'
  /** Размер */
  size?: FieldSize
  /** Визуальный вариант */
  variant?: 'outline' | 'subtle' | 'solid'
  /** Цветовая палитра */
  colorPalette?: string
}

/**
 * Form.Field.RadioGroup - Группа radio кнопок для единичного выбора
 *
 * Рендерит группу radio кнопок для взаимоисключающих опций.
 * Используй Select для длинных списков, RadioGroup для коротких (2-5 опций).
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.RadioGroup
 *   name="size"
 *   label="Размер"
 *   options={[
 *     { label: 'Маленький', value: 'sm' },
 *     { label: 'Средний', value: 'md' },
 *     { label: 'Большой', value: 'lg' },
 *   ]}
 * />
 * ```
 *
 * @example Горизонтальная раскладка
 * ```tsx
 * <Form.Field.RadioGroup
 *   name="priority"
 *   orientation="horizontal"
 *   options={[
 *     { label: 'Низкий', value: 'low' },
 *     { label: 'Средний', value: 'medium' },
 *     { label: 'Высокий', value: 'high' },
 *   ]}
 * />
 * ```
 */
export const FieldRadioGroup = createField<RadioGroupFieldProps, string>({
  displayName: 'FieldRadioGroup',
  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => (
    <Field.Root
      invalid={hasError}
      required={resolved.required}
      disabled={resolved.disabled}
      readOnly={resolved.readOnly}
    >
      <FieldLabel label={resolved.label} tooltip={resolved.tooltip} required={resolved.required} />
      <RadioGroup.Root
        value={(field.state.value as string) ?? undefined}
        onValueChange={(details) => field.handleChange(details.value)}
        orientation={componentProps.orientation ?? 'vertical'}
        size={componentProps.size ?? 'md'}
        variant={componentProps.variant ?? 'solid'}
        colorPalette={componentProps.colorPalette ?? 'brand'}
        disabled={resolved.disabled}
        readOnly={resolved.readOnly}
        data-field-name={fullPath}
      >
        {componentProps.options.map((opt) => (
          <RadioGroup.Item key={opt.value} value={opt.value} disabled={opt.disabled}>
            <RadioGroup.ItemHiddenInput onBlur={field.handleBlur} />
            <RadioGroup.ItemIndicator />
            <RadioGroup.ItemText>{getOptionLabel(opt)}</RadioGroup.ItemText>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
    </Field.Root>
  ),
})

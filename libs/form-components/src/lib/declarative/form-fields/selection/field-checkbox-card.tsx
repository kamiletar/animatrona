'use client'

import { CheckboxCard, CheckboxGroup, Fieldset, Flex } from '@chakra-ui/react'
import type { ReactElement } from 'react'
import type { BaseFieldProps, FieldSizeWithoutXs, FieldTooltipMeta, RichOption } from '../../types'
import { createField, SelectionFieldLabel } from '../base'

/**
 * Props для CheckboxCard поля
 */
export interface CheckboxCardFieldProps<T = string> extends Omit<BaseFieldProps, 'placeholder'> {
  /** Tooltip для label поля */
  tooltip?: FieldTooltipMeta
  /** Опции для карточек */
  options: RichOption<T>[]
  /** Размер (по умолчанию: md) */
  size?: FieldSizeWithoutXs
  /** Визуальный вариант (по умолчанию: outline) */
  variant?: 'surface' | 'subtle' | 'outline' | 'solid'
  /** Цветовая палитра */
  colorPalette?: string
  /** Выравнивание контента (по умолчанию: start) */
  align?: 'start' | 'end' | 'center'
  /** Ориентация (по умолчанию: horizontal) */
  orientation?: 'horizontal' | 'vertical'
  /** Отступ между карточками (по умолчанию: 2) */
  gap?: number | string
}

/**
 * Form.Field.CheckboxCard - Множественный выбор в виде карточек
 *
 * Рендерит группу checkbox карточек для выбора нескольких опций.
 * Каждая карточка может иметь label, описание и иконку.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.CheckboxCard
 *   name="features"
 *   label="Выберите функции"
 *   options={[
 *     { label: 'TypeScript', value: 'ts', description: 'Типизация' },
 *     { label: 'ESLint', value: 'eslint', description: 'Качество кода' },
 *     { label: 'Prettier', value: 'prettier', description: 'Форматирование' },
 *   ]}
 * />
 * ```
 *
 * @example С иконками
 * ```tsx
 * <Form.Field.CheckboxCard
 *   name="permissions"
 *   options={[
 *     { label: 'Админ', value: 'admin', icon: <ShieldIcon /> },
 *     { label: 'Пользователь', value: 'user', icon: <UserIcon /> },
 *   ]}
 *   align="center"
 * />
 * ```
 */
export const FieldCheckboxCard = createField<CheckboxCardFieldProps, string[]>({
  displayName: 'FieldCheckboxCard',
  render: ({ field, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    // Значение всегда массив для checkbox карточек
    const currentValue = field.state.value as string[] | undefined
    const valueArray: string[] = currentValue ?? []

    return (
      <Fieldset.Root invalid={hasError} disabled={resolved.disabled}>
        <CheckboxGroup
          value={valueArray}
          onValueChange={(value) => field.handleChange(value)}
          disabled={resolved.disabled}
          invalid={hasError}
        >
          {resolved.label && (
            <Fieldset.Legend mb={2}>
              <SelectionFieldLabel
                label={resolved.label}
                tooltip={resolved.tooltip}
                required={resolved.required}
              />
            </Fieldset.Legend>
          )}

          <Flex
            gap={componentProps.gap ?? 2}
            direction={(componentProps.orientation ?? 'horizontal') === 'vertical' ? 'column' : 'row'}
            wrap={(componentProps.orientation ?? 'horizontal') === 'horizontal' ? 'wrap' : undefined}
          >
            {componentProps.options.map((opt) => (
              <CheckboxCard.Root
                key={opt.value}
                value={opt.value}
                size={componentProps.size ?? 'md'}
                variant={componentProps.variant ?? 'outline'}
                colorPalette={componentProps.colorPalette}
                align={componentProps.align ?? 'start'}
                disabled={opt.disabled}
              >
                <CheckboxCard.HiddenInput />
                <CheckboxCard.Control>
                  <CheckboxCard.Content>
                    {opt.icon}
                    <CheckboxCard.Label>{opt.label}</CheckboxCard.Label>
                    {opt.description && <CheckboxCard.Description>{opt.description}</CheckboxCard.Description>}
                  </CheckboxCard.Content>
                  <CheckboxCard.Indicator />
                </CheckboxCard.Control>
              </CheckboxCard.Root>
            ))}
          </Flex>
        </CheckboxGroup>

        {hasError ? (
          <Fieldset.ErrorText>{errorMessage}</Fieldset.ErrorText>
        ) : (
          resolved.helperText && <Fieldset.HelperText>{resolved.helperText}</Fieldset.HelperText>
        )}
      </Fieldset.Root>
    )
  },
})

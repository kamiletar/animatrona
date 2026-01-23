'use client'

import { Field, RadioCard } from '@chakra-ui/react'
import { useCallback, type KeyboardEvent, type ReactElement } from 'react'
import type { BaseFieldProps, FieldSizeWithoutXs, FieldTooltipMeta, RichOption } from '../../types'
import { createField, FieldError, SelectionFieldLabel } from '../base'

/**
 * Props для RadioCard поля
 */
export interface RadioCardFieldProps<T = string> extends Omit<BaseFieldProps, 'placeholder'> {
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
  /** Включить улучшенную навигацию клавиатурой с циклом (по умолчанию: false) */
  keyboardNavigation?: boolean
}

/** Тип состояния для useFieldState */
interface RadioCardFieldState {
  enabledOptions: RichOption[]
  handleKeyDown: (
    e: KeyboardEvent<HTMLDivElement>,
    currentValue: string | undefined,
    handleChange: (value: string) => void
  ) => void
}

/**
 * Form.Field.RadioCard - Выбор одного варианта в виде карточек
 *
 * Рендерит группу radio карточек для выбора одной опции.
 * Каждая карточка может иметь label, описание и иконку.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.RadioCard
 *   name="plan"
 *   label="Выберите план"
 *   options={[
 *     { label: 'Бесплатный', value: 'free', description: 'Базовые функции' },
 *     { label: 'Про', value: 'pro', description: 'Все функции' },
 *     { label: 'Корпоративный', value: 'enterprise', description: 'Кастомизация' },
 *   ]}
 * />
 * ```
 *
 * @example С иконками
 * ```tsx
 * <Form.Field.RadioCard
 *   name="role"
 *   options={[
 *     { label: 'Админ', value: 'admin', icon: <ShieldIcon /> },
 *     { label: 'Пользователь', value: 'user', icon: <UserIcon /> },
 *   ]}
 *   align="center"
 * />
 * ```
 */
export const FieldRadioCard = createField<RadioCardFieldProps, string, RadioCardFieldState>({
  displayName: 'FieldRadioCard',
  useFieldState: (componentProps): RadioCardFieldState => {
    // Получаем только включённые опции для навигации клавиатурой
    const enabledOptions = componentProps.options.filter((opt) => !opt.disabled)

    // Обработка навигации клавиатурой с циклом
    const handleKeyDown = useCallback(
      (
        e: KeyboardEvent<HTMLDivElement>,
        currentValue: string | undefined,
        handleChange: (value: string) => void
      ): void => {
        if (!componentProps.keyboardNavigation || enabledOptions.length === 0) {
          return
        }

        const isHorizontal = (componentProps.orientation ?? 'horizontal') === 'horizontal'
        const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp'
        const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown'

        if (e.key !== prevKey && e.key !== nextKey) {
          return
        }

        e.preventDefault()

        const currentIndex = currentValue ? enabledOptions.findIndex((opt) => opt.value === currentValue) : -1

        let newIndex: number

        if (e.key === nextKey) {
          // Вперёд (цикл к первому если в конце)
          newIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % enabledOptions.length
        } else {
          // Назад (цикл к последнему если в начале)
          newIndex =
            currentIndex === -1
              ? enabledOptions.length - 1
              : (currentIndex - 1 + enabledOptions.length) % enabledOptions.length
        }

        handleChange(enabledOptions[newIndex].value)
      },
      [componentProps.keyboardNavigation, enabledOptions, componentProps.orientation]
    )

    return { enabledOptions, handleKeyDown }
  },
  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps, fieldState }): ReactElement => {
    const currentValue = field.state.value as string | undefined

    return (
      <Field.Root
        invalid={hasError}
        required={resolved.required}
        disabled={resolved.disabled}
        readOnly={resolved.readOnly}
      >
        <RadioCard.Root
          value={currentValue ?? ''}
          onValueChange={(details) => field.handleChange(details.value)}
          onKeyDown={
            componentProps.keyboardNavigation
              ? (e) => fieldState.handleKeyDown(e, currentValue, field.handleChange)
              : undefined
          }
          disabled={resolved.disabled}
          name={fullPath}
          size={componentProps.size ?? 'md'}
          variant={componentProps.variant ?? 'outline'}
          colorPalette={componentProps.colorPalette}
          align={componentProps.align ?? 'start'}
          orientation={componentProps.orientation ?? 'horizontal'}
          gap={componentProps.gap ?? 2}
        >
          {resolved.label && (
            <RadioCard.Label>
              <SelectionFieldLabel
                label={resolved.label}
                tooltip={resolved.tooltip}
                required={resolved.required}
              />
            </RadioCard.Label>
          )}

          {componentProps.options.map((opt) => (
            <RadioCard.Item key={opt.value} value={opt.value} disabled={opt.disabled}>
              <RadioCard.ItemHiddenInput />
              <RadioCard.ItemControl>
                <RadioCard.ItemContent>
                  {opt.icon}
                  <RadioCard.ItemText>{opt.label}</RadioCard.ItemText>
                  {opt.description && <RadioCard.ItemDescription>{opt.description}</RadioCard.ItemDescription>}
                </RadioCard.ItemContent>
                <RadioCard.ItemIndicator />
              </RadioCard.ItemControl>
            </RadioCard.Item>
          ))}
        </RadioCard.Root>

        <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
      </Field.Root>
    )
  },
})

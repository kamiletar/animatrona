'use client'

import { Field, For, HStack, Slider } from '@chakra-ui/react'
import type { ReactElement, ReactNode } from 'react'
import type { BaseFieldProps, FieldTooltipMeta } from '../../types'
import { createField, FieldError } from '../base'
import { FieldTooltip } from '../base/field-tooltip'

/**
 * Определение метки для слайдера
 */
export interface SliderMark {
  /** Значение на шкале */
  value: number
  /** Текст метки */
  label?: ReactNode
}

/**
 * Props для Slider поля
 */
export interface SliderFieldProps extends Omit<BaseFieldProps, 'placeholder'> {
  /** Tooltip для label поля */
  tooltip?: FieldTooltipMeta
  /** Минимальное значение (по умолчанию: 0) */
  min?: number
  /** Максимальное значение (по умолчанию: 100) */
  max?: number
  /** Шаг (по умолчанию: 1) */
  step?: number
  /** Показывать текущее значение рядом с label */
  showValue?: boolean
  /** Ориентация (по умолчанию: horizontal) */
  orientation?: 'horizontal' | 'vertical'
  /** Размер (по умолчанию: md) */
  size?: 'sm' | 'md' | 'lg'
  /** Вариант (по умолчанию: outline) */
  variant?: 'outline' | 'solid'
  /** Цветовая палитра */
  colorPalette?: 'gray' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'cyan' | 'purple' | 'pink'
  /** Метки на треке слайдера */
  marks?: (number | SliderMark)[]
  /** Начальная точка заливки (по умолчанию: start) */
  origin?: 'start' | 'center' | 'end'
  /** Callback при изменении значения */
  onValueChange?: (value: number) => void
  /** Callback при окончании перетаскивания */
  onValueChangeEnd?: (value: number) => void
}

/**
 * Form.Field.Slider - Поле слайдера
 *
 * Рендерит Chakra Slider с автоматической интеграцией с формой.
 * Значение формы хранится как число.
 *
 * Автоматически извлекает из Zod схемы:
 * - `min` из `z.number().min(1)` → min={1}
 * - `max` из `z.number().max(100)` → max={100}
 * - `step` из `z.number().int()` → step={1}, или `z.number().multipleOf(0.5)` → step={0.5}
 * - `helperText` автоматически генерируется из constraints ("От 1 до 100")
 *
 * Props всегда имеют приоритет над автоматическими значениями из схемы.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.Slider name="volume" label="Громкость" />
 * ```
 *
 * @example С автоматическими constraints из Zod
 * ```tsx
 * // В схеме: z.object({ rating: z.number().min(1).max(10) })
 * <Form.Field.Slider name="rating" label="Рейтинг" showValue />
 * // Автоматически: min={1} max={10} helperText="От 1 до 10"
 * ```
 *
 * @example С метками
 * ```tsx
 * <Form.Field.Slider
 *   name="rating"
 *   label="Рейтинг"
 *   min={0}
 *   max={100}
 *   marks={[0, 25, 50, 75, 100]}
 * />
 * ```
 */
export const FieldSlider = createField<SliderFieldProps, number>({
  displayName: 'FieldSlider',

  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const { constraints } = resolved

    // Props имеют приоритет над constraints, потом дефолты
    const min = componentProps.min ?? constraints.number?.min ?? 0
    const max = componentProps.max ?? constraints.number?.max ?? 100
    const step = componentProps.step ?? constraints.number?.step ?? 1

    const {
      showValue,
      orientation = 'horizontal',
      size = 'md',
      variant = 'outline',
      colorPalette,
      marks,
      origin,
      onValueChange,
      onValueChangeEnd,
    } = componentProps

    // Нормализация меток в массив объектов
    const normalizedMarks = marks?.map((mark) => (typeof mark === 'number' ? { value: mark, label: undefined } : mark))

    // Конвертация числа в массив для Slider
    const numValue = (field.state.value as number) ?? min
    const arrayValue = [numValue]

    const handleValueChange = (details: { value: number[] }) => {
      const newValue = details.value[0] ?? min
      field.handleChange(newValue)
      onValueChange?.(newValue)
    }

    const handleValueChangeEnd = (details: { value: number[] }) => {
      const newValue = details.value[0] ?? min
      onValueChangeEnd?.(newValue)
    }

    return (
      <Field.Root
        invalid={hasError}
        required={resolved.required}
        disabled={resolved.disabled}
        readOnly={resolved.readOnly}
      >
        <Slider.Root
          value={arrayValue}
          onValueChange={handleValueChange}
          onValueChangeEnd={handleValueChangeEnd}
          min={min}
          max={max}
          step={step}
          orientation={orientation}
          size={size}
          variant={variant}
          colorPalette={colorPalette}
          origin={origin}
          disabled={resolved.disabled}
          readOnly={resolved.readOnly}
          invalid={hasError}
          thumbAlignment="center"
          onBlur={field.handleBlur}
          data-field-name={fullPath}
        >
          {resolved.label && !showValue && (
            <Slider.Label>
              {resolved.tooltip ? (
                <HStack gap={1}>
                  <span>{resolved.label}</span>
                  <FieldTooltip {...resolved.tooltip} />
                </HStack>
              ) : (
                resolved.label
              )}
            </Slider.Label>
          )}
          {resolved.label && showValue && (
            <HStack justify="space-between">
              <Slider.Label>
                {resolved.tooltip ? (
                  <HStack gap={1}>
                    <span>{resolved.label}</span>
                    <FieldTooltip {...resolved.tooltip} />
                  </HStack>
                ) : (
                  resolved.label
                )}
              </Slider.Label>
              <Slider.ValueText />
            </HStack>
          )}
          <Slider.Control>
            <Slider.Track>
              <Slider.Range />
            </Slider.Track>
            <For each={arrayValue}>
              {(_, index) => (
                <Slider.Thumb key={index} index={index}>
                  <Slider.HiddenInput />
                </Slider.Thumb>
              )}
            </For>
            {normalizedMarks && normalizedMarks.length > 0 && (
              <Slider.MarkerGroup>
                {normalizedMarks.map((mark, index) => (
                  <Slider.Marker key={index} value={mark.value}>
                    <Slider.MarkerIndicator />
                    {mark.label}
                  </Slider.Marker>
                ))}
              </Slider.MarkerGroup>
            )}
          </Slider.Control>
        </Slider.Root>
        <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
      </Field.Root>
    )
  },
})

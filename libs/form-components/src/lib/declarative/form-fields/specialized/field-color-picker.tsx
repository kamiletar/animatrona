'use client'

import { ColorPicker, Field, HStack, parseColor, Portal } from '@chakra-ui/react'
import { type ReactElement, useMemo } from 'react'
import type { BaseFieldProps, FieldTooltipMeta } from '../../types'
import { createField, FieldError } from '../base'
import { FieldTooltip } from '../base/field-tooltip'

/**
 * Props для ColorPicker поля
 */
export interface ColorPickerFieldProps extends Omit<BaseFieldProps, 'placeholder'> {
  /** Tooltip для label поля */
  tooltip?: FieldTooltipMeta
  /** Палитра цветов для быстрого выбора */
  swatches?: string[]
  /** Размер (по умолчанию: md) */
  size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** Показывать area picker (насыщенность/яркость) (по умолчанию: true) */
  showArea?: boolean
  /** Показывать кнопку пипетки (по умолчанию: true) */
  showEyeDropper?: boolean
  /** Показывать слайдеры hue/alpha (по умолчанию: true) */
  showSliders?: boolean
  /** Показывать hex input (по умолчанию: true) */
  showInput?: boolean
}

/**
 * Палитра по умолчанию
 */
const defaultSwatches = [
  '#000000',
  '#4A5568',
  '#F56565',
  '#ED64A6',
  '#9F7AEA',
  '#6B46C1',
  '#4299E1',
  '#0BC5EA',
  '#38B2AC',
  '#48BB78',
  '#ECC94B',
  '#DD6B20',
]

/**
 * Form.Field.ColorPicker - Выбор цвета с пикером
 *
 * Рендерит color picker с опциональной палитрой, area picker,
 * слайдерами и hex input.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.ColorPicker
 *   name="color"
 *   label="Выберите цвет"
 * />
 * ```
 *
 * @example С кастомной палитрой
 * ```tsx
 * <Form.Field.ColorPicker
 *   name="brandColor"
 *   label="Цвет бренда"
 *   swatches={['#FF0000', '#00FF00', '#0000FF']}
 * />
 * ```
 *
 * @example Минимальный (только палитра)
 * ```tsx
 * <Form.Field.ColorPicker
 *   name="accent"
 *   showArea={false}
 *   showSliders={false}
 *   showInput={false}
 *   swatches={['#FF0000', '#00FF00', '#0000FF', '#FFFF00']}
 * />
 * ```
 */
export const FieldColorPicker = createField<ColorPickerFieldProps, string>({
  displayName: 'FieldColorPicker',

  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const {
      swatches = defaultSwatches,
      size = 'md',
      showArea = true,
      showEyeDropper = true,
      showSliders = true,
      showInput = true,
    } = componentProps

    const currentValue = (field.state.value as string) || '#000000'

    // Парсим цвет безопасно с useMemo для избежания ре-парсинга при каждом рендере
    const parsedColor = useMemo(() => {
      try {
        return parseColor(currentValue)
      } catch {
        return parseColor('#000000')
      }
    }, [currentValue])

    return (
      <Field.Root
        invalid={hasError}
        required={resolved.required}
        disabled={resolved.disabled}
        readOnly={resolved.readOnly}
      >
        <ColorPicker.Root
          value={parsedColor}
          onValueChange={(details) => {
            // Используем valueAsString который уже в правильном формате
            field.handleChange(details.valueAsString)
          }}
          disabled={resolved.disabled}
          readOnly={resolved.readOnly}
          size={size}
        >
          <ColorPicker.HiddenInput name={fullPath} />

          {resolved.label && (
            <ColorPicker.Label>
              {resolved.tooltip ? (
                <HStack gap={1}>
                  <span>{resolved.label}</span>
                  <FieldTooltip {...resolved.tooltip} />
                </HStack>
              ) : (
                resolved.label
              )}
              {resolved.required && <Field.RequiredIndicator />}
            </ColorPicker.Label>
          )}

          <ColorPicker.Control>
            {showInput && <ColorPicker.ChannelInput channel="hex" />}
            <ColorPicker.Trigger />
          </ColorPicker.Control>

          <Portal>
            <ColorPicker.Positioner>
              <ColorPicker.Content>
                {showArea && <ColorPicker.Area />}

                {(showEyeDropper || showSliders) && (
                  <HStack>
                    {showEyeDropper && <ColorPicker.EyeDropper size="xs" variant="outline" />}
                    {showSliders && <ColorPicker.Sliders />}
                  </HStack>
                )}

                {swatches.length > 0 && (
                  <ColorPicker.SwatchGroup>
                    {swatches.map((swatch) => (
                      <ColorPicker.SwatchTrigger key={swatch} value={swatch}>
                        <ColorPicker.Swatch value={swatch} boxSize="4.5" />
                      </ColorPicker.SwatchTrigger>
                    ))}
                  </ColorPicker.SwatchGroup>
                )}
              </ColorPicker.Content>
            </ColorPicker.Positioner>
          </Portal>
        </ColorPicker.Root>

        <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
      </Field.Root>
    )
  },
})

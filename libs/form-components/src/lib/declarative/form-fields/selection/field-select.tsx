'use client'

import { createListCollection, Field, Portal, Select } from '@chakra-ui/react'
import { useMemo, type ReactElement } from 'react'
import type { BaseFieldProps, BaseOption, FieldSize } from '../../types'
import { createField, FieldError, getOptionLabel, SelectionFieldLabel, type ResolvedFieldProps } from '../base'

/** Нормализованная опция (value всегда string для Chakra) */
interface NormalizedOption {
  label: React.ReactNode
  value: string
  disabled?: boolean
}

/**
 * Props для Select поля
 */
export interface SelectFieldProps extends BaseFieldProps {
  /** Опции для выбора (string или number значения). Если не указаны — берутся из schema meta */
  options?: BaseOption<string | number>[]
  /** Тип значения: 'string' (по умолчанию) или 'number' */
  valueType?: 'string' | 'number'
  /** Показывать кнопку очистки (автоопределение: true если optional, false если required) */
  clearable?: boolean
  /** Размер */
  size?: FieldSize
  /** Визуальный вариант */
  variant?: 'outline' | 'subtle'
}

/** Тип состояния для useFieldState */
interface SelectFieldState {
  collection: ReturnType<typeof createListCollection<NormalizedOption>>
  normalizedOptions: NormalizedOption[]
  resolvedClearable: boolean
}

/**
 * Form.Field.Select - Стилизованный Chakra Select dropdown
 *
 * Стилизованный select компонент с кастомизируемым внешним видом,
 * анимациями и расширенными функциями (поиск, очистка, кастомный рендеринг).
 *
 * Для простых случаев или лучшего мобильного UX используй Form.Field.NativeSelect.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.Select
 *   name="framework"
 *   label="Фреймворк"
 *   options={[
 *     { label: 'React', value: 'react' },
 *     { label: 'Vue', value: 'vue' },
 *     { label: 'Angular', value: 'angular', disabled: true },
 *   ]}
 *   clearable
 * />
 * ```
 */
export const FieldSelect = createField<SelectFieldProps, string | number, SelectFieldState>({
  displayName: 'FieldSelect',
  useFieldState: (
    componentProps: Omit<SelectFieldProps, keyof BaseFieldProps>,
    resolved: ResolvedFieldProps
  ): SelectFieldState => {
    // Опции: props имеют приоритет, fallback на schema meta
    const sourceOptions = componentProps.options ?? resolved.options ?? []

    // Нормализуем опции — value всегда string для Chakra
    const normalizedOptions: NormalizedOption[] = useMemo(
      () =>
        sourceOptions.map((opt) => ({
          label: opt.label,
          value: String(opt.value),
          disabled: opt.disabled,
        })),
      [sourceOptions]
    )

    // Создаём коллекцию из нормализованных опций
    const collection = useMemo(
      () =>
        createListCollection({
          items: normalizedOptions,
          itemToString: getOptionLabel,
          itemToValue: (item) => item.value,
        }),
      [normalizedOptions]
    )

    // Автоопределение clearable: показывать кнопку очистки если поле optional
    const resolvedClearable = componentProps.clearable ?? !resolved.required

    return { collection, normalizedOptions, resolvedClearable }
  },
  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps, fieldState }): ReactElement => {
    // Преобразуем текущее значение в строку для Chakra
    const currentValue = field.state.value
    const stringValue = currentValue !== null && currentValue !== undefined ? String(currentValue) : undefined

    return (
      <Field.Root invalid={hasError} required={resolved.required} disabled={resolved.disabled}>
        <Select.Root
          collection={fieldState.collection}
          size={componentProps.size ?? 'md'}
          variant={componentProps.variant ?? 'outline'}
          value={stringValue ? [stringValue] : []}
          onValueChange={(details) => {
            const newStringValue = details.value[0] as string | undefined
            // Преобразуем обратно в нужный тип
            if (componentProps.valueType === 'number') {
              field.handleChange(newStringValue ? Number(newStringValue) : 0)
            } else {
              field.handleChange(newStringValue ?? '')
            }
          }}
          onInteractOutside={() => field.handleBlur()}
          disabled={resolved.disabled}
          data-field-name={fullPath}
        >
          <Select.HiddenSelect />
          {resolved.label && (
            <Select.Label>
              <SelectionFieldLabel
                label={resolved.label}
                tooltip={resolved.tooltip}
                required={resolved.required}
              />
            </Select.Label>
          )}
          <Select.Control>
            <Select.Trigger>
              <Select.ValueText placeholder={resolved.placeholder} />
            </Select.Trigger>
            <Select.IndicatorGroup>
              {fieldState.resolvedClearable && <Select.ClearTrigger />}
              <Select.Indicator />
            </Select.IndicatorGroup>
          </Select.Control>
          <Portal>
            <Select.Positioner>
              <Select.Content>
                {fieldState.normalizedOptions.map((opt) => (
                  <Select.Item item={opt} key={opt.value}>
                    {getOptionLabel(opt)}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>
        <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
      </Field.Root>
    )
  },
})

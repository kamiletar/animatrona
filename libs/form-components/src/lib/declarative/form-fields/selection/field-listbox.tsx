'use client'

import { Field, Listbox } from '@chakra-ui/react'
import type { ReactElement } from 'react'
import type { BaseFieldProps, FieldSizeWithoutXs, GroupableOption } from '../../types'
import { createField, FieldError, getOptionLabel, SelectionFieldLabel, useGroupedOptions, type GroupedOptionsResult } from '../base'

/**
 * Props для Listbox поля
 */
export interface ListboxFieldProps<T = string> extends Omit<BaseFieldProps, 'placeholder'> {
  /** Опции для listbox */
  options: GroupableOption<T>[]
  /**
   * Режим выбора
   * - `single`: Выбор одного элемента (по умолчанию)
   * - `multiple`: Выбор нескольких элементов
   */
  selectionMode?: 'single' | 'multiple'
  /** Размер */
  size?: FieldSizeWithoutXs
  /** Визуальный вариант */
  variant?: 'subtle' | 'solid' | 'plain'
  /** Цветовая палитра */
  colorPalette?: string
  /** Ориентация элементов (по умолчанию: vertical) */
  orientation?: 'horizontal' | 'vertical'
  /** Максимальная высота для скролла */
  maxHeight?: string | number
}

/** Тип состояния для useFieldState */
type ListboxFieldState = GroupedOptionsResult

/**
 * Form.Field.Listbox - Список выбора с видимыми опциями
 *
 * В отличие от Select/Combobox которые используют dropdown, Listbox показывает
 * все опции прямо в форме. Хорошо подходит для коротких списков (2-8 элементов)
 * где все опции должны быть видны.
 *
 * @example Единичный выбор
 * ```tsx
 * <Form.Field.Listbox
 *   name="framework"
 *   label="Фреймворк"
 *   options={[
 *     { label: 'React', value: 'react' },
 *     { label: 'Vue', value: 'vue' },
 *     { label: 'Angular', value: 'angular' },
 *   ]}
 * />
 * ```
 *
 * @example Множественный выбор
 * ```tsx
 * <Form.Field.Listbox
 *   name="features"
 *   label="Функции"
 *   selectionMode="multiple"
 *   options={[
 *     { label: 'TypeScript', value: 'ts' },
 *     { label: 'Тестирование', value: 'test' },
 *     { label: 'Линтинг', value: 'lint' },
 *   ]}
 * />
 * ```
 *
 * @example С группами
 * ```tsx
 * <Form.Field.Listbox
 *   name="language"
 *   options={[
 *     { label: 'TypeScript', value: 'ts', group: 'Frontend' },
 *     { label: 'Python', value: 'py', group: 'Backend' },
 *   ]}
 * />
 * ```
 */
export const FieldListbox = createField<ListboxFieldProps, string | string[], ListboxFieldState>({
  displayName: 'FieldListbox',
  useFieldState: (componentProps): ListboxFieldState => {
    // Используем общий хук для группировки опций
    return useGroupedOptions(componentProps.options)
  },
  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps, fieldState }): ReactElement => {
    // Обработка single vs multiple значений
    const currentValue = field.state.value as string | string[] | undefined
    const valueArray: string[] = Array.isArray(currentValue) ? currentValue : currentValue ? [currentValue] : []
    const selectionMode = componentProps.selectionMode ?? 'single'

    return (
      <Field.Root
        invalid={hasError}
        required={resolved.required}
        disabled={resolved.disabled}
        readOnly={resolved.readOnly}
      >
        <Listbox.Root
          collection={fieldState.collection}
          selectionMode={selectionMode}
          orientation={componentProps.orientation ?? 'vertical'}
          variant={componentProps.variant ?? 'subtle'}
          colorPalette={componentProps.colorPalette}
          value={valueArray}
          onValueChange={(details) => {
            if (selectionMode === 'single') {
              // Single mode: сохраняем одно значение или пустую строку
              const newValue = details.value[0] as string | undefined
              field.handleChange(newValue ?? '')
            } else {
              // Multiple mode: сохраняем массив
              field.handleChange(details.value)
            }
          }}
          disabled={resolved.disabled}
          data-field-name={fullPath}
        >
          {resolved.label && (
            <Listbox.Label fontSize={componentProps.size ?? 'md'}>
              <SelectionFieldLabel
                label={resolved.label}
                tooltip={resolved.tooltip}
                required={resolved.required}
              />
            </Listbox.Label>
          )}

          <Listbox.Content maxH={componentProps.maxHeight}>
            {fieldState.groups
              ? /* Сгруппированные опции */
                Array.from(fieldState.groups.entries()).map(([groupName, groupOptions]) => (
                  <Listbox.ItemGroup key={groupName}>
                    {groupName && <Listbox.ItemGroupLabel>{groupName}</Listbox.ItemGroupLabel>}
                    {groupOptions.map((opt) => (
                      <Listbox.Item item={opt} key={opt.value}>
                        <Listbox.ItemText>{getOptionLabel(opt)}</Listbox.ItemText>
                        <Listbox.ItemIndicator />
                      </Listbox.Item>
                    ))}
                  </Listbox.ItemGroup>
                ))
              : /* Плоские опции */
                componentProps.options.map((opt) => (
                  <Listbox.Item item={opt} key={opt.value}>
                    <Listbox.ItemText>{getOptionLabel(opt)}</Listbox.ItemText>
                    <Listbox.ItemIndicator />
                  </Listbox.Item>
                ))}
          </Listbox.Content>
        </Listbox.Root>

        <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
      </Field.Root>
    )
  },
})

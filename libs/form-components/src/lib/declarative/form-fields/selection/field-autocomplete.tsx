'use client'

import { Combobox, createListCollection, Field, Portal, Spinner, useFilter } from '@chakra-ui/react'
import { useMemo, type ReactElement } from 'react'
import type { BaseFieldProps, FieldSize } from '../../types'
import { createField, FieldError, SelectionFieldLabel, useAsyncSearch, type AsyncQueryFn } from '../base'

/**
 * Props для Form.Field.Autocomplete
 */
export interface AutocompleteFieldProps<TData = unknown> extends BaseFieldProps {
  /**
   * Статические подсказки для автодополнения
   */
  suggestions?: string[]

  /**
   * Async функция запроса для загрузки подсказок
   * Должна возвращать { data, isLoading, error } аналогично TanStack Query
   *
   * @example
   * ```tsx
   * useQuery={(search) => useFindManyCity({
   *   where: { name: { contains: search, mode: 'insensitive' } },
   *   take: 10,
   * })}
   * ```
   */
  useQuery?: AsyncQueryFn<TData>

  /**
   * Получить label из элемента данных запроса
   * Обязательно при использовании useQuery
   */
  getLabel?: (item: TData) => string

  /**
   * Задержка debounce в миллисекундах
   * @default 300
   */
  debounce?: number

  /**
   * Минимум символов для показа подсказок
   * @default 1
   */
  minChars?: number

  /**
   * Размер компонента
   * @default 'md'
   */
  size?: FieldSize

  /**
   * Визуальный вариант
   * @default 'outline'
   */
  variant?: 'outline' | 'subtle' | 'flushed'

  /**
   * Сообщение при пустом результате
   * @default "Нет подсказок"
   */
  emptyMessage?: string

  /**
   * Сообщение при загрузке
   * @default "Загрузка..."
   */
  loadingMessage?: string
}

/**
 * Элемент подсказки
 */
interface AutocompleteItem {
  label: string
  value: string
}

/** Тип состояния для useFieldState */
interface AutocompleteFieldState {
  inputValue: string
  setInputValue: (value: string) => void
  isLoading: boolean
  suggestions: AutocompleteItem[]
  collection: ReturnType<typeof createListCollection<AutocompleteItem>>
}

/**
 * Form.Field.Autocomplete - Текстовый ввод с подсказками
 *
 * Упрощённая версия Combobox, всегда допускающая кастомные значения.
 * Идеально для названий городов, продуктов или любого свободного ввода с подсказками.
 *
 * @example Статические подсказки
 * ```tsx
 * <Form.Field.Autocomplete
 *   name="city"
 *   label="Город"
 *   suggestions={['Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск']}
 * />
 * ```
 *
 * @example Async подсказки с ZenStack
 * ```tsx
 * <Form.Field.Autocomplete
 *   name="product"
 *   label="Продукт"
 *   useQuery={(search) => useFindManyProduct({
 *     where: { name: { contains: search, mode: 'insensitive' } },
 *     take: 10,
 *   })}
 *   getLabel={(p) => p.name}
 *   debounce={300}
 *   minChars={2}
 * />
 * ```
 */
export const FieldAutocomplete = createField<AutocompleteFieldProps, string, AutocompleteFieldState>({
  displayName: 'FieldAutocomplete',
  useFieldState: (componentProps: Omit<AutocompleteFieldProps, keyof BaseFieldProps>): AutocompleteFieldState => {
    // Async поиск с debounce через общий хук
    const {
      inputValue,
      setInputValue,
      isLoading,
      data: queryData,
    } = useAsyncSearch({
      useQuery: componentProps.useQuery,
      debounce: componentProps.debounce ?? 300,
      minChars: componentProps.minChars ?? 1,
    })

    // Фильтр для статических подсказок
    const { contains } = useFilter({ sensitivity: 'base' })

    // Формирование списка подсказок
    const suggestions = useMemo((): AutocompleteItem[] => {
      if (componentProps.suggestions) {
        // Фильтрация статических подсказок по значению ввода
        const filtered = inputValue
          ? componentProps.suggestions.filter((s) => contains(s, inputValue))
          : componentProps.suggestions.slice(0, 10) // Первые 10 при пустом вводе
        return filtered.map((s) => ({ label: s, value: s }))
      }

      if (queryData && componentProps.getLabel) {
        const getLabel = componentProps.getLabel
        return (queryData as unknown[]).map((item) => {
          const itemLabel = getLabel(item)
          return { label: itemLabel, value: itemLabel }
        })
      }

      return []
    }, [componentProps.suggestions, queryData, componentProps.getLabel, inputValue, contains])

    // Создание коллекции
    const collection = useMemo(() => {
      return createListCollection({
        items: suggestions,
        itemToString: (item) => item.label,
        itemToValue: (item) => item.value,
      })
    }, [suggestions])

    return {
      inputValue,
      setInputValue,
      isLoading,
      suggestions,
      collection,
    }
  },
  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps, fieldState }): ReactElement => {
    const currentValue = (field.state.value as string) ?? ''
    const minChars = componentProps.minChars ?? 1

    return (
      <Field.Root
        invalid={hasError}
        required={resolved.required}
        disabled={resolved.disabled}
        readOnly={resolved.readOnly}
      >
        <Combobox.Root
          collection={fieldState.collection}
          size={componentProps.size ?? 'md'}
          variant={componentProps.variant ?? 'outline'}
          value={currentValue ? [currentValue] : []}
          inputValue={fieldState.inputValue}
          onInputValueChange={(details) => {
            fieldState.setInputValue(details.inputValue)
            // Всегда обновляем значение поля (поведение allowCustomValue)
            field.handleChange(details.inputValue)
          }}
          onValueChange={(details) => {
            const newValue = details.value[0] ?? ''
            fieldState.setInputValue(newValue)
            field.handleChange(newValue)
          }}
          onInteractOutside={() => field.handleBlur()}
          disabled={resolved.disabled}
          allowCustomValue
          openOnClick
          data-field-name={fullPath}
        >
          {resolved.label && (
            <Combobox.Label>
              <SelectionFieldLabel label={resolved.label} tooltip={resolved.tooltip} required={resolved.required} />
            </Combobox.Label>
          )}

          <Combobox.Control>
            <Combobox.Input placeholder={resolved.placeholder ?? 'Начните ввод...'} />
            <Combobox.IndicatorGroup>
              {fieldState.isLoading && <Spinner size="xs" />}
              <Combobox.Trigger />
            </Combobox.IndicatorGroup>
          </Combobox.Control>

          <Portal>
            <Combobox.Positioner>
              <Combobox.Content>
                {/* Состояние загрузки */}
                {fieldState.isLoading && fieldState.suggestions.length === 0 && (
                  <Combobox.Empty>{componentProps.loadingMessage ?? 'Загрузка...'}</Combobox.Empty>
                )}

                {/* Пустой результат */}
                {!fieldState.isLoading &&
                  fieldState.suggestions.length === 0 &&
                  fieldState.inputValue.length >= minChars && (
                    <Combobox.Empty>{componentProps.emptyMessage ?? 'Нет подсказок'}</Combobox.Empty>
                  )}

                {/* Подсказка о минимуме символов */}
                {!fieldState.isLoading &&
                  fieldState.suggestions.length === 0 &&
                  fieldState.inputValue.length < minChars &&
                  fieldState.inputValue.length > 0 && (
                    <Combobox.Empty>Введите минимум {minChars} символов</Combobox.Empty>
                  )}

                {/* Подсказки */}
                {fieldState.suggestions.map((item) => (
                  <Combobox.Item item={item} key={item.value}>
                    <Combobox.ItemText>{item.label}</Combobox.ItemText>
                    <Combobox.ItemIndicator />
                  </Combobox.Item>
                ))}
              </Combobox.Content>
            </Combobox.Positioner>
          </Portal>
        </Combobox.Root>

        <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
      </Field.Root>
    )
  },
})

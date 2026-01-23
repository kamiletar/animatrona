'use client'

import { Combobox, Field, Portal, Spinner, useFilter } from '@chakra-ui/react'
import { useMemo, type ReactElement, type ReactNode } from 'react'
import type { BaseFieldProps, FieldSize, GroupableOption } from '../../types'
import {
  createField,
  FieldError,
  getOptionLabel,
  SelectionFieldLabel,
  useAsyncSearch,
  useGroupedOptions,
  type AsyncQueryFn,
  type GroupedOptionsResult,
  type ResolvedFieldProps,
} from '../base'

/**
 * Props для Form.Field.Combobox
 */
export interface ComboboxFieldProps<T = string, TData = unknown> extends BaseFieldProps {
  /**
   * Статические опции (взаимоисключающе с useQuery)
   */
  options?: GroupableOption<T>[]

  /**
   * Async функция запроса для загрузки опций
   * Должна возвращать { data, isLoading, error } аналогично TanStack Query
   *
   * @example
   * ```tsx
   * useQuery={(search) => useFindManyUser({
   *   where: { name: { contains: search, mode: 'insensitive' } },
   *   take: 20,
   * })}
   * ```
   */
  useQuery?: AsyncQueryFn<TData>

  /**
   * Получить label из элемента данных
   * Обязательно при использовании useQuery
   */
  getLabel?: (item: TData) => ReactNode

  /**
   * Получить value из элемента данных
   * Обязательно при использовании useQuery
   */
  getValue?: (item: TData) => T

  /**
   * Получить ключ группы из элемента данных
   * Опционально, для группировки результатов
   */
  getGroup?: (item: TData) => string | undefined

  /**
   * Проверить, отключён ли элемент
   */
  getDisabled?: (item: TData) => boolean

  /**
   * Задержка debounce в миллисекундах
   * @default 300
   */
  debounce?: number

  /**
   * Минимум символов для запуска поиска
   * @default 1
   */
  minChars?: number

  /**
   * Показывать кнопку очистки
   * Автоопределяется из схемы если не указано
   */
  clearable?: boolean

  /**
   * Разрешить кастомные значения не из списка
   * @default false
   */
  allowCustomValue?: boolean

  /**
   * Размер компонента
   */
  size?: FieldSize

  /**
   * Визуальный вариант
   */
  variant?: 'outline' | 'subtle' | 'flushed'

  /**
   * Сообщение при пустом результате
   * @default "Ничего не найдено"
   */
  emptyMessage?: string

  /**
   * Сообщение при загрузке
   * @default "Загрузка..."
   */
  loadingMessage?: string
}

/** Тип состояния для useFieldState */
interface ComboboxFieldState extends GroupedOptionsResult {
  inputValue: string
  setInputValue: (value: string) => void
  isLoading: boolean
  options: GroupableOption[]
  resolvedClearable: boolean
}

/**
 * Form.Field.Combobox - Async поисковый select с debounce и группировкой
 *
 * Поддерживает как статические опции, так и async загрузку через TanStack Query хуки.
 *
 * @example Статические опции
 * ```tsx
 * <Form.Field.Combobox
 *   name="framework"
 *   label="Фреймворк"
 *   options={[
 *     { label: 'React', value: 'react' },
 *     { label: 'Vue', value: 'vue', group: 'Frontend' },
 *   ]}
 * />
 * ```
 *
 * @example Async с ZenStack хуками
 * ```tsx
 * <Form.Field.Combobox
 *   name="userId"
 *   label="Пользователь"
 *   useQuery={(search) => useFindManyUser({
 *     where: { name: { contains: search, mode: 'insensitive' } },
 *     take: 20,
 *   })}
 *   getLabel={(user) => user.name}
 *   getValue={(user) => user.id}
 *   getGroup={(user) => user.role}
 *   debounce={300}
 *   minChars={2}
 * />
 * ```
 */
export const FieldCombobox = createField<ComboboxFieldProps, string, ComboboxFieldState>({
  displayName: 'FieldCombobox',
  useFieldState: (
    componentProps: Omit<ComboboxFieldProps, keyof BaseFieldProps>,
    resolved: ResolvedFieldProps
  ): ComboboxFieldState => {
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

    // Фильтр для статических опций
    const { contains } = useFilter({ sensitivity: 'base' })

    // Формирование опций из статического или async источника
    const options = useMemo((): GroupableOption[] => {
      if (componentProps.options) {
        // Фильтрация статических опций по значению ввода
        if (!inputValue) {
          return componentProps.options
        }
        return componentProps.options.filter((opt) => {
          return contains(getOptionLabel(opt), inputValue)
        })
      }

      if (queryData && componentProps.getLabel && componentProps.getValue) {
        const getLabel = componentProps.getLabel
        const getValue = componentProps.getValue
        return (queryData as unknown[]).map((item) => ({
          label: getLabel(item),
          value: getValue(item),
          group: componentProps.getGroup?.(item),
          disabled: componentProps.getDisabled?.(item),
        }))
      }

      return []
    }, [
      componentProps.options,
      queryData,
      componentProps.getLabel,
      componentProps.getValue,
      componentProps.getGroup,
      componentProps.getDisabled,
      inputValue,
      contains,
    ])

    // Создание коллекции с группировкой через общий хук
    const { collection, groups } = useGroupedOptions(options)

    // Автоопределение clearable
    const resolvedClearable = componentProps.clearable ?? !resolved.required

    return {
      inputValue,
      setInputValue,
      isLoading,
      options,
      collection,
      groups,
      resolvedClearable,
    }
  },
  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps, fieldState }): ReactElement => {
    const currentValue = field.state.value as string | undefined
    const minChars = componentProps.minChars ?? 1

    return (
      <Field.Root invalid={hasError} required={resolved.required} disabled={resolved.disabled}>
        <Combobox.Root
          collection={fieldState.collection}
          size={componentProps.size ?? 'md'}
          variant={componentProps.variant ?? 'outline'}
          value={currentValue ? [currentValue] : []}
          inputValue={fieldState.inputValue}
          onInputValueChange={(details) => fieldState.setInputValue(details.inputValue)}
          onValueChange={(details) => {
            const newValue = details.value[0] as string | undefined
            field.handleChange(newValue ?? '')
          }}
          onInteractOutside={() => field.handleBlur()}
          disabled={resolved.disabled}
          allowCustomValue={componentProps.allowCustomValue ?? false}
          openOnClick
          data-field-name={fullPath}
        >
          {resolved.label && (
            <Combobox.Label>
              <SelectionFieldLabel label={resolved.label} tooltip={resolved.tooltip} required={resolved.required} />
            </Combobox.Label>
          )}

          <Combobox.Control>
            <Combobox.Input placeholder={resolved.placeholder ?? 'Поиск...'} />
            <Combobox.IndicatorGroup>
              {fieldState.isLoading && <Spinner size="xs" />}
              {fieldState.resolvedClearable && <Combobox.ClearTrigger />}
              <Combobox.Trigger />
            </Combobox.IndicatorGroup>
          </Combobox.Control>

          <Portal>
            <Combobox.Positioner>
              <Combobox.Content>
                {/* Состояние загрузки */}
                {fieldState.isLoading && fieldState.options.length === 0 && (
                  <Combobox.Empty>{componentProps.loadingMessage ?? 'Загрузка...'}</Combobox.Empty>
                )}

                {/* Пустой результат */}
                {!fieldState.isLoading &&
                  fieldState.options.length === 0 &&
                  fieldState.inputValue.length >= minChars && (
                    <Combobox.Empty>{componentProps.emptyMessage ?? 'Ничего не найдено'}</Combobox.Empty>
                  )}

                {/* Подсказка о минимуме символов */}
                {!fieldState.isLoading &&
                  fieldState.options.length === 0 &&
                  fieldState.inputValue.length < minChars &&
                  fieldState.inputValue.length > 0 && (
                    <Combobox.Empty>Введите минимум {minChars} символов</Combobox.Empty>
                  )}

                {/* Сгруппированные опции */}
                {fieldState.groups
                  ? Array.from(fieldState.groups.entries()).map(([groupName, groupOptions]) => (
                      <Combobox.ItemGroup key={groupName}>
                        {groupName && <Combobox.ItemGroupLabel>{groupName}</Combobox.ItemGroupLabel>}
                        {groupOptions.map((opt) => (
                          <Combobox.Item item={opt} key={opt.value}>
                            <Combobox.ItemText>{getOptionLabel(opt)}</Combobox.ItemText>
                            <Combobox.ItemIndicator />
                          </Combobox.Item>
                        ))}
                      </Combobox.ItemGroup>
                    ))
                  : /* Плоские опции */
                    fieldState.options.map((opt) => (
                      <Combobox.Item item={opt} key={opt.value}>
                        <Combobox.ItemText>{getOptionLabel(opt)}</Combobox.ItemText>
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

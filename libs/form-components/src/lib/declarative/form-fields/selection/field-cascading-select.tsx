'use client'

import { createListCollection, Field, Portal, Select, Spinner } from '@chakra-ui/react'
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useFormGroup } from '../../../form-group'
import { useDeclarativeForm } from '../../form-context'
import type { BaseFieldProps, BaseOption, FieldSize } from '../../types'
import { FieldError, getFieldErrors, getOptionLabel, SelectionFieldLabel, type ResolvedFieldProps } from '../base'
import { useResolvedFieldProps } from '../base/use-resolved-field-props'

/**
 * Результат загрузки опций
 */
export interface CascadingSelectLoadResult<T = string> {
  /** Загруженные опции */
  options: BaseOption<T>[]
}

/**
 * Props для CascadingSelect поля
 */
export interface CascadingSelectFieldProps<TParent = string, TValue = string> extends BaseFieldProps {
  /**
   * Имя родительского поля, от которого зависит этот select
   * @example "country" - загрузить города при изменении страны
   */
  dependsOn: string
  /**
   * Функция загрузки опций при изменении родительского поля
   * @param parentValue - Текущее значение родительского поля
   * @returns Promise с массивом опций или объект с опциями
   */
  loadOptions: (
    parentValue: TParent | undefined
  ) => Promise<BaseOption<TValue>[]> | Promise<CascadingSelectLoadResult<TValue>>
  /**
   * Начальные опции (показываются до выбора родительского значения)
   * @default []
   */
  initialOptions?: BaseOption<TValue>[]
  /**
   * Автоматически очищать значение при изменении родителя
   * @default true
   */
  clearOnParentChange?: boolean
  /**
   * Отключить поле пока родитель пустой
   * @default true
   */
  disableWhenParentEmpty?: boolean
  /**
   * Показывать кнопку очистки (автоопределение: true если optional, false если required)
   */
  clearable?: boolean
  /**
   * Размер компонента
   */
  size?: FieldSize
  /**
   * Визуальный вариант
   */
  variant?: 'outline' | 'subtle'
  /**
   * Placeholder для пустого родительского значения
   */
  placeholderWhenDisabled?: string
}

/**
 * Внутренний компонент для рендеринга Select с загруженными опциями
 */
interface CascadingSelectContentProps<TParent, TValue> {
  parentValue: TParent | undefined
  form: ReturnType<typeof useDeclarativeForm>['form']
  fullPath: string
  resolved: ResolvedFieldProps
  loadOptions: CascadingSelectFieldProps<TParent, TValue>['loadOptions']
  initialOptions: BaseOption<TValue>[]
  clearOnParentChange: boolean
  disableWhenParentEmpty: boolean
  clearable?: boolean
  size: FieldSize
  variant: 'outline' | 'subtle'
  placeholderWhenDisabled?: string
}

function CascadingSelectContent<TParent = string, TValue = string>({
  parentValue,
  form,
  fullPath,
  resolved,
  loadOptions,
  initialOptions,
  clearOnParentChange,
  disableWhenParentEmpty,
  clearable,
  size,
  variant,
  placeholderWhenDisabled,
}: CascadingSelectContentProps<TParent, TValue>): ReactElement {
  // Состояние опций и загрузки
  const [options, setOptions] = useState<BaseOption<TValue>[]>(initialOptions)
  const [isLoading, setIsLoading] = useState(false)

  // Ref для отслеживания предыдущего значения родителя
  const prevParentValueRef = useRef<TParent | undefined>(parentValue)

  // Ref для стабильной ссылки на loadOptions (избегаем бесконечных циклов при inline функциях)
  const loadOptionsRef = useRef(loadOptions)
  loadOptionsRef.current = loadOptions

  // Эффект для загрузки опций при изменении parentValue
  useEffect(() => {
    // Функция загрузки
    const doLoad = async () => {
      if (parentValue === undefined || parentValue === null || parentValue === '') {
        setOptions(initialOptions)
        return
      }

      setIsLoading(true)
      try {
        const result = await loadOptionsRef.current(parentValue)
        // Поддержка обоих форматов: массив или объект с options
        const newOptions = Array.isArray(result) ? result : result.options
        setOptions(newOptions)
      } catch (error) {
        console.error('Ошибка загрузки опций каскадного select:', error)
        setOptions([])
      } finally {
        setIsLoading(false)
      }
    }

    void doLoad()
  }, [parentValue, initialOptions])

  // Эффект для очистки значения при изменении родителя
  useEffect(() => {
    if (clearOnParentChange && prevParentValueRef.current !== parentValue) {
      // Очищаем значение поля если родитель изменился (не при первом рендере)
      if (prevParentValueRef.current !== undefined) {
        form.setFieldValue(fullPath, '' as unknown)
      }
      prevParentValueRef.current = parentValue
    }
  }, [parentValue, clearOnParentChange, form, fullPath])

  // Определяем, нужно ли отключить поле
  const isParentEmpty = parentValue === undefined || parentValue === null || parentValue === ''
  const isDisabled = resolved.disabled || (disableWhenParentEmpty && isParentEmpty)

  // Определяем placeholder
  const effectivePlaceholder = isParentEmpty && placeholderWhenDisabled ? placeholderWhenDisabled : resolved.placeholder

  // Автоопределение clearable
  const resolvedClearable = clearable ?? !resolved.required

  // Создаём коллекцию из опций
  const collection = useMemo(
    () =>
      createListCollection({
        items: options,
        itemToString: getOptionLabel,
        itemToValue: (item) => item.value as string,
      }),
    [options]
  )

  return (
    <form.Field name={fullPath}>
      {(field: {
        state: { value: unknown; meta: { errors?: unknown[] } }
        handleChange: (v: unknown) => void
        handleBlur: () => void
      }) => {
        const { hasError, errorMessage } = getFieldErrors(field)
        const currentValue = field.state.value as string | undefined

        return (
          <Field.Root invalid={hasError} required={resolved.required} disabled={isDisabled}>
            <Select.Root
              collection={collection}
              size={size}
              variant={variant}
              value={currentValue ? [currentValue] : []}
              onValueChange={(details) => {
                const newValue = details.value[0] as string | undefined
                field.handleChange(newValue ?? '')
              }}
              onInteractOutside={() => field.handleBlur()}
              disabled={isDisabled}
              data-field-name={fullPath}
            >
              <Select.HiddenSelect />
              {resolved.label && (
                <Select.Label>
                  <SelectionFieldLabel label={resolved.label} tooltip={resolved.tooltip} required={resolved.required} />
                </Select.Label>
              )}
              <Select.Control>
                <Select.Trigger>
                  <Select.ValueText placeholder={effectivePlaceholder} />
                </Select.Trigger>
                <Select.IndicatorGroup>
                  {isLoading && <Spinner size="xs" />}
                  {resolvedClearable && !isLoading && <Select.ClearTrigger />}
                  <Select.Indicator />
                </Select.IndicatorGroup>
              </Select.Control>
              <Portal>
                <Select.Positioner>
                  <Select.Content>
                    {options.map((opt) => (
                      <Select.Item item={opt} key={opt.value as string}>
                        {getOptionLabel(opt)}
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>
            <FieldError hasError={!!hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
          </Field.Root>
        )
      }}
    </form.Field>
  )
}

/**
 * Form.Field.CascadingSelect - Каскадный select с зависимостью от другого поля
 *
 * Загружает опции динамически на основе значения другого поля.
 * Полезен для связанных списков типа Страна → Город, Категория → Подкатегория.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.Select
 *   name="country"
 *   label="Страна"
 *   options={countries}
 * />
 * <Form.Field.CascadingSelect
 *   name="city"
 *   label="Город"
 *   dependsOn="country"
 *   loadOptions={async (countryCode) => {
 *     if (!countryCode) return []
 *     const cities = await fetchCities(countryCode)
 *     return cities.map(c => ({ label: c.name, value: c.id }))
 *   }}
 *   placeholderWhenDisabled="Сначала выберите страну"
 * />
 * ```
 *
 * @example Вложенные поля
 * ```tsx
 * <Form.Field.CascadingSelect
 *   name="address.region"
 *   label="Регион"
 *   dependsOn="address.country"
 *   loadOptions={loadRegions}
 * />
 * ```
 */
export function FieldCascadingSelect<TParent = string, TValue = string>(
  props: CascadingSelectFieldProps<TParent, TValue>
): ReactElement {
  const {
    name,
    dependsOn,
    loadOptions,
    initialOptions = [],
    clearOnParentChange = true,
    disableWhenParentEmpty = true,
    clearable,
    size = 'md',
    variant = 'outline',
    placeholderWhenDisabled,
    ...baseProps
  } = props

  const { form } = useDeclarativeForm()
  const parentGroup = useFormGroup()
  const { form: _formFromProps, fullPath, ...resolvedRest } = useResolvedFieldProps(name, baseProps)

  const resolved: ResolvedFieldProps = {
    label: resolvedRest.label,
    placeholder: resolvedRest.placeholder,
    helperText: resolvedRest.helperText,
    tooltip: resolvedRest.tooltip,
    required: resolvedRest.required,
    disabled: resolvedRest.disabled,
    readOnly: resolvedRest.readOnly,
    constraints: resolvedRest.constraints,
    options: resolvedRest.options,
  }

  // Строим полный путь к родительскому полю
  const fullDependsOnPath = parentGroup ? `${parentGroup.name}.${dependsOn}` : dependsOn

  // Создаём селектор для значения родительского поля (inline, как в FormWhen)
  const parentSelector = (state: { values: Record<string, unknown> }): TParent | undefined => {
    const parts = fullDependsOnPath.split('.')
    let value: unknown = state.values
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part]
      } else {
        value = undefined
        break
      }
    }
    return value as TParent | undefined
  }

  // Используем form.Subscribe для подписки на изменения родительского поля
  return (
    <form.Subscribe selector={parentSelector}>
      {(parentValue: TParent | undefined) => (
        <CascadingSelectContent
          parentValue={parentValue}
          form={form}
          fullPath={fullPath}
          resolved={resolved}
          loadOptions={loadOptions}
          initialOptions={initialOptions as BaseOption<TValue>[]}
          clearOnParentChange={clearOnParentChange}
          disableWhenParentEmpty={disableWhenParentEmpty}
          clearable={clearable}
          size={size}
          variant={variant}
          placeholderWhenDisabled={placeholderWhenDisabled}
        />
      )}
    </form.Subscribe>
  )
}

FieldCascadingSelect.displayName = 'FieldCascadingSelect'

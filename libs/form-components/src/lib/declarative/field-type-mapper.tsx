'use client'

import type { ReactElement, ReactNode } from 'react'
import type { ZodConstraints } from './schema-constraints'
import type { SchemaFieldInfo } from './schema-traversal'
import type { FieldComponentType } from './types/meta-types'

// Импорт всех Field компонентов
import { FieldEditable } from './form-fields/text/field-editable'
import { FieldPassword } from './form-fields/text/field-password'
import { FieldPasswordStrength } from './form-fields/text/field-password-strength'
import { FieldRichText } from './form-fields/text/field-rich-text'
import { FieldString } from './form-fields/text/field-string'
import { FieldTextarea } from './form-fields/text/field-textarea'

import { FieldCurrency } from './form-fields/number/field-currency'
import { FieldNumber } from './form-fields/number/field-number'
import { FieldNumberInput } from './form-fields/number/field-number-input'
import { FieldPercentage } from './form-fields/number/field-percentage'
import { FieldRating } from './form-fields/number/field-rating'
import { FieldSlider } from './form-fields/number/field-slider'

import { FieldDate } from './form-fields/datetime/field-date'
import { FieldDateRange } from './form-fields/datetime/field-date-range'
import { FieldDateTimePicker } from './form-fields/datetime/field-datetime-picker'
import { FieldDuration } from './form-fields/datetime/field-duration'
import { FieldSchedule } from './form-fields/datetime/field-schedule'
import { FieldTime } from './form-fields/datetime/field-time'

import { FieldCheckbox } from './form-fields/boolean/field-checkbox'
import { FieldSwitch } from './form-fields/boolean/field-switch'

import { FieldAutocomplete } from './form-fields/selection/field-autocomplete'
import { FieldCheckboxCard } from './form-fields/selection/field-checkbox-card'
import { FieldCombobox } from './form-fields/selection/field-combobox'
import { FieldListbox } from './form-fields/selection/field-listbox'
import { FieldNativeSelect } from './form-fields/selection/field-native-select'
import { FieldRadioCard } from './form-fields/selection/field-radio-card'
import { FieldRadioGroup } from './form-fields/selection/field-radio-group'
import { FieldSegmentedGroup } from './form-fields/selection/field-segmented-group'
import { FieldSelect } from './form-fields/selection/field-select'
import { FieldTags } from './form-fields/selection/field-tags'

import { FieldAddress } from './form-fields/specialized/field-address'
import { FieldColorPicker } from './form-fields/specialized/field-color-picker'
import { FieldFileUpload } from './form-fields/specialized/field-file-upload'
import { FieldOTPInput } from './form-fields/specialized/field-otp-input'
import { FieldPhone } from './form-fields/specialized/field-phone'
import { FieldPinInput } from './form-fields/specialized/field-pin-input'
import { FieldMaskedInput } from './form-fields/text/field-masked-input'

import { camelCaseToLabel } from './form-fields/auto/field-auto'
import { useRelationFieldContext, type RelationOption } from './relation-field-provider'

/**
 * Конфигурация relation в fieldProps
 */
export interface RelationFieldConfig {
  /** Имя модели (должно совпадать с model в RelationFieldProvider) */
  model: string
  /** Поле для отображения label */
  labelField: string
  /** Поле для значения (по умолчанию 'id') */
  valueField?: string
}

/**
 * Props для рендеринга поля
 */
export interface FieldRenderProps {
  /** Имя поля */
  name: string
  /** Label (если не указан, генерируется из name) */
  label?: ReactNode
  /** Placeholder */
  placeholder?: string
  /** Helper text */
  helperText?: ReactNode
  /** Обязательное поле */
  required?: boolean
  /** Отключено */
  disabled?: boolean
  /** Только для чтения */
  readOnly?: boolean
  /** Enum значения для select/radio */
  enumValues?: string[]
  /** Constraints из схемы */
  constraints?: ZodConstraints
  /** Дополнительные props из fieldProps */
  fieldProps?: Record<string, unknown>
  /**
   * Options из RelationFieldProvider (если поле имеет relation config)
   * Устанавливается автоматически через SchemaFieldWithRelations
   */
  relationOptions?: RelationOption[]
}

/**
 * Определить тип компонента на основе:
 * 1. Явного fieldType из meta (приоритет)
 * 2. Zod типа (fallback)
 */
export function resolveFieldType(field: SchemaFieldInfo): FieldComponentType {
  // Приоритет: явный fieldType из meta
  if (field.ui?.fieldType) {
    return field.ui.fieldType
  }

  // Fallback на Zod тип
  switch (field.zodType) {
    case 'string':
      // Проверить email/url через constraints
      if (field.constraints?.string?.inputType === 'email') {
        return 'string'
      }
      if (field.constraints?.string?.inputType === 'url') {
        return 'string'
      }
      // Проверить длинную строку → textarea
      if (field.constraints?.string?.maxLength && field.constraints.string.maxLength > 200) {
        return 'textarea'
      }
      return 'string'

    case 'number':
    case 'bigint':
    case 'int':
    case 'float':
      return 'number'

    case 'boolean':
      return 'checkbox'

    case 'date':
      return 'date'

    case 'enum':
    case 'literal':
      return 'nativeSelect'

    case 'array':
      // Примитивные массивы → tags
      if (field.element?.zodType === 'string') {
        return 'tags'
      }
      // Объектные массивы обрабатываются отдельно
      return 'string' // fallback

    default:
      return 'string'
  }
}

/**
 * Тип опции для компонентов выбора
 */
interface SelectOptionResolved {
  value: string
  label: string
  description?: string
}

/**
 * Тип опции для NativeSelect (использует title вместо label)
 */
interface NativeSelectOptionResolved {
  value: string
  title: string
  description?: string
}

/**
 * Получить options для поля выбора с учётом relationOptions
 * Приоритет: fieldProps.options > relationOptions > enumValues
 */
function resolveSelectOptions(
  fieldProps: Record<string, unknown>,
  relationOptions?: RelationOption[],
  enumValues?: string[]
): SelectOptionResolved[] | undefined {
  // 1. Явные options в fieldProps (высший приоритет)
  if (fieldProps.options && Array.isArray(fieldProps.options)) {
    return fieldProps.options as SelectOptionResolved[]
  }

  // 2. Options из RelationFieldProvider
  if (relationOptions && relationOptions.length > 0) {
    return relationOptions.map((opt) => ({
      value: opt.value,
      label: opt.label,
      description: opt.description,
    }))
  }

  // 3. Enum значения (fallback)
  if (enumValues && enumValues.length > 0) {
    return enumValues.map((v) => ({ label: camelCaseToLabel(v), value: v }))
  }

  return undefined
}

/**
 * Получить options для NativeSelect (использует title вместо label)
 */
function resolveNativeSelectOptions(
  fieldProps: Record<string, unknown>,
  relationOptions?: RelationOption[],
  enumValues?: string[]
): NativeSelectOptionResolved[] | undefined {
  // 1. Явные options в fieldProps (высший приоритет)
  if (fieldProps.options && Array.isArray(fieldProps.options)) {
    return fieldProps.options as NativeSelectOptionResolved[]
  }

  // 2. Options из RelationFieldProvider
  if (relationOptions && relationOptions.length > 0) {
    return relationOptions.map((opt) => ({
      value: opt.value,
      title: opt.label,
      description: opt.description,
    }))
  }

  // 3. Enum значения (fallback)
  if (enumValues && enumValues.length > 0) {
    return enumValues.map((v) => ({ title: camelCaseToLabel(v), value: v }))
  }

  return undefined
}

/**
 * Рендерить компонент поля по типу
 */
export function renderFieldByType(type: FieldComponentType, props: FieldRenderProps): ReactElement {
  const {
    name,
    label: labelProp,
    placeholder,
    helperText,
    required,
    disabled,
    readOnly,
    enumValues,
    constraints,
    fieldProps = {},
    relationOptions,
  } = props

  // Генерировать label если не указан
  const label = labelProp ?? camelCaseToLabel(name)

  // Базовые props для всех полей
  const baseProps = {
    name,
    label,
    placeholder,
    helperText,
    required,
    disabled,
    readOnly,
  }

  // Применить constraints к props
  const stringConstraints = constraints?.string || {}
  const numberConstraints = constraints?.number || {}

  // Предварительно вычислить options для полей выбора
  const selectOptions = resolveSelectOptions(fieldProps, relationOptions, enumValues)
  const nativeSelectOptions = resolveNativeSelectOptions(fieldProps, relationOptions, enumValues)

  switch (type) {
    // Текстовые поля
    case 'string':
      return (
        <FieldString
          key={name}
          {...baseProps}
          type={stringConstraints.inputType}
          maxLength={stringConstraints.maxLength}
          minLength={stringConstraints.minLength}
          pattern={stringConstraints.pattern}
          {...fieldProps}
        />
      )
    case 'textarea':
      return <FieldTextarea key={name} {...baseProps} maxLength={stringConstraints.maxLength} {...fieldProps} />
    case 'password':
      return <FieldPassword key={name} {...baseProps} {...fieldProps} />
    case 'passwordStrength':
      return <FieldPasswordStrength key={name} {...baseProps} {...fieldProps} />
    case 'editable':
      return <FieldEditable key={name} {...baseProps} {...fieldProps} />
    case 'richText':
      return <FieldRichText key={name} {...baseProps} {...fieldProps} />

    // Числовые поля
    case 'number':
      return (
        <FieldNumber
          key={name}
          {...baseProps}
          min={numberConstraints.min}
          max={numberConstraints.max}
          step={numberConstraints.step}
          {...fieldProps}
        />
      )
    case 'numberInput':
      return (
        <FieldNumberInput
          key={name}
          {...baseProps}
          min={numberConstraints.min}
          max={numberConstraints.max}
          step={numberConstraints.step}
          {...fieldProps}
        />
      )
    case 'slider':
      return (
        <FieldSlider
          key={name}
          {...baseProps}
          min={numberConstraints.min}
          max={numberConstraints.max}
          step={numberConstraints.step}
          {...fieldProps}
        />
      )
    case 'rating':
      return <FieldRating key={name} {...baseProps} {...fieldProps} />
    case 'currency':
      return <FieldCurrency key={name} {...baseProps} {...fieldProps} />
    case 'percentage':
      return <FieldPercentage key={name} {...baseProps} {...fieldProps} />

    // Дата и время
    case 'date':
      return (
        <FieldDate
          key={name}
          {...baseProps}
          min={constraints?.date?.min}
          max={constraints?.date?.max}
          {...fieldProps}
        />
      )
    case 'time':
      return <FieldTime key={name} {...baseProps} {...fieldProps} />
    case 'dateRange':
      return <FieldDateRange key={name} {...baseProps} {...fieldProps} />
    case 'dateTimePicker':
      return <FieldDateTimePicker key={name} {...baseProps} {...fieldProps} />
    case 'duration':
      return <FieldDuration key={name} {...baseProps} {...fieldProps} />
    case 'schedule':
      return <FieldSchedule key={name} {...baseProps} {...fieldProps} />

    // Булевые поля
    case 'checkbox':
      return <FieldCheckbox key={name} {...baseProps} {...fieldProps} />
    case 'switch':
      return <FieldSwitch key={name} {...baseProps} {...fieldProps} />

    // Выбор из списка
    // Options разрешаются с приоритетом: fieldProps.options > relationOptions > enumValues
    case 'select':
      return <FieldSelect key={name} {...baseProps} options={selectOptions ?? []} {...fieldProps} />
    case 'nativeSelect':
      return <FieldNativeSelect key={name} {...baseProps} options={nativeSelectOptions ?? []} {...fieldProps} />
    case 'combobox':
      return <FieldCombobox key={name} {...baseProps} {...fieldProps} />
    case 'autocomplete':
      return <FieldAutocomplete key={name} {...baseProps} {...fieldProps} />
    case 'listbox':
      return <FieldListbox key={name} {...baseProps} options={selectOptions ?? []} {...fieldProps} />
    case 'radioGroup':
      return <FieldRadioGroup key={name} {...baseProps} options={selectOptions ?? []} {...fieldProps} />
    case 'radioCard':
      return <FieldRadioCard key={name} {...baseProps} options={selectOptions ?? []} {...fieldProps} />
    case 'segmentedGroup':
      return <FieldSegmentedGroup key={name} {...baseProps} options={selectOptions ?? []} {...fieldProps} />
    case 'checkboxCard':
      return <FieldCheckboxCard key={name} {...baseProps} options={selectOptions ?? []} {...fieldProps} />
    case 'tags':
      return <FieldTags key={name} {...baseProps} {...fieldProps} />

    // Специализированные поля
    case 'phone':
      return <FieldPhone key={name} {...baseProps} {...fieldProps} />
    case 'address': {
      // FieldAddress требует token из fieldProps
      const token = fieldProps.token as string | undefined
      if (!token) {
        console.warn(`Form.Field.Address "${name}" requires token in fieldProps`)
      }
      return <FieldAddress key={name} {...baseProps} token={token ?? ''} {...fieldProps} />
    }
    case 'pinInput':
      return <FieldPinInput key={name} {...baseProps} {...fieldProps} />
    case 'otpInput':
      return <FieldOTPInput key={name} {...baseProps} {...fieldProps} />
    case 'colorPicker':
      return <FieldColorPicker key={name} {...baseProps} {...fieldProps} />
    case 'fileUpload': {
      // FieldFileUpload требует label и helperText как string
      const labelStr = typeof label === 'string' ? label : String(label ?? '')
      const helperStr = typeof helperText === 'string' ? helperText : undefined
      return (
        <FieldFileUpload
          key={name}
          {...baseProps}
          label={labelStr || undefined}
          helperText={helperStr}
          {...fieldProps}
        />
      )
    }
    case 'maskedInput':
      return <FieldMaskedInput key={name} {...baseProps} {...fieldProps} />

    default:
      // Fallback на string
      return <FieldString key={name} {...baseProps} {...fieldProps} />
  }
}

/**
 * Рендерить поле из SchemaFieldInfo
 * @param field - информация о поле из схемы
 * @param relationOptions - опции из RelationFieldProvider (если есть)
 */
export function renderSchemaField(field: SchemaFieldInfo, relationOptions?: RelationOption[]): ReactElement {
  const fieldType = resolveFieldType(field)

  return renderFieldByType(fieldType, {
    name: field.name,
    label: field.ui?.title,
    placeholder: field.ui?.placeholder,
    helperText: field.ui?.description,
    required: field.required,
    enumValues: field.enumValues,
    constraints: field.constraints,
    fieldProps: field.ui?.fieldProps,
    relationOptions,
  })
}

/**
 * Компонент для рендеринга поля с автозагрузкой relation options
 *
 * Использует RelationFieldProvider контекст для автоматической загрузки
 * options для полей с `relationMeta()`.
 *
 * @example
 * ```tsx
 * <RelationFieldProvider relations={[{ model: 'Category', useQuery: useFindManyCategory, labelField: 'name' }]}>
 *   <SchemaFieldWithRelations field={categoryField} />
 * </RelationFieldProvider>
 * ```
 */
export function SchemaFieldWithRelations({ field }: { field: SchemaFieldInfo }): ReactElement {
  const relationContext = useRelationFieldContext()

  // Проверяем есть ли relation config в fieldProps
  const relationConfig = field.ui?.fieldProps?.relation as RelationFieldConfig | undefined

  // Если есть relation config и есть контекст — получаем options
  let relationOptions: RelationOption[] | undefined
  if (relationConfig && relationContext) {
    const state = relationContext.getState(relationConfig.model)
    if (!state.isLoading && state.options.length > 0) {
      relationOptions = state.options
    }
  }

  return renderSchemaField(field, relationOptions)
}

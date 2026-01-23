'use client'

import type { ReactElement, ReactNode } from 'react'
import { ButtonSubmit } from '../form-buttons'
import {
  FieldAuto,
  FieldCheckbox,
  FieldCurrency,
  FieldDate,
  FieldNativeSelect,
  FieldNumber,
  FieldPassword,
  FieldPercentage,
  FieldPhone,
  FieldRating,
  FieldSelect,
  FieldSlider,
  FieldString,
  FieldSwitch,
  FieldTextarea,
  camelCaseToLabel,
} from '../form-fields'
import { Form } from '../form-root'
import type { FormMiddleware, ValidateOn } from '../types'
import type { BaseOption } from '../types/option-types'
import type { FieldSize } from '../types/size-types'

// =============================================================================
// Field Config Types
// =============================================================================

/**
 * Базовая конфигурация поля
 */
interface BaseFieldConfig {
  /** Имя поля (ключ в данных формы) */
  name: string
  /** Label поля (если не указан, генерируется из name) */
  label?: string
  /** Placeholder */
  placeholder?: string
  /** Подсказка под полем */
  helperText?: string
  /** Обязательное поле */
  required?: boolean
  /** Отключено */
  disabled?: boolean
  /** Размер */
  size?: FieldSize
}

/**
 * Конфигурация текстового поля
 */
interface StringFieldConfig extends BaseFieldConfig {
  type: 'string'
  /** Максимальная длина */
  maxLength?: number
}

/**
 * Конфигурация многострочного поля
 */
interface TextareaFieldConfig extends BaseFieldConfig {
  type: 'textarea'
  /** Количество строк */
  rows?: number
}

/**
 * Конфигурация числового поля
 */
interface NumberFieldConfig extends BaseFieldConfig {
  type: 'number'
  /** Минимальное значение */
  min?: number
  /** Максимальное значение */
  max?: number
  /** Шаг */
  step?: number
}

/**
 * Конфигурация валютного поля
 */
interface CurrencyFieldConfig extends BaseFieldConfig {
  type: 'currency'
  /** Код валюты (по умолчанию 'RUB') */
  currency?: string
}

/**
 * Конфигурация процентного поля
 */
interface PercentageFieldConfig extends BaseFieldConfig {
  type: 'percentage'
}

/**
 * Конфигурация слайдера
 */
interface SliderFieldConfig extends BaseFieldConfig {
  type: 'slider'
  min?: number
  max?: number
  step?: number
}

/**
 * Конфигурация рейтинга
 */
interface RatingFieldConfig extends BaseFieldConfig {
  type: 'rating'
  /** Максимальное значение (по умолчанию 5) */
  max?: number
}

/**
 * Конфигурация чекбокса
 */
interface CheckboxFieldConfig extends BaseFieldConfig {
  type: 'checkbox'
}

/**
 * Конфигурация switch
 */
interface SwitchFieldConfig extends BaseFieldConfig {
  type: 'switch'
}

/**
 * Конфигурация select
 */
interface SelectFieldConfig extends BaseFieldConfig {
  type: 'select'
  /** Опции для выбора */
  options: BaseOption[]
  /** Использовать NativeSelect */
  native?: boolean
}

/**
 * Конфигурация даты
 */
interface DateFieldConfig extends BaseFieldConfig {
  type: 'date'
}

/**
 * Конфигурация пароля
 */
interface PasswordFieldConfig extends BaseFieldConfig {
  type: 'password'
}

/**
 * Конфигурация телефона
 */
interface PhoneFieldConfig extends BaseFieldConfig {
  type: 'phone'
}

/**
 * Конфигурация auto-поля (тип определяется из схемы)
 */
interface AutoFieldConfig extends BaseFieldConfig {
  type: 'auto'
}

/**
 * Объединённый тип конфигурации поля
 */
export type FieldConfig =
  | StringFieldConfig
  | TextareaFieldConfig
  | NumberFieldConfig
  | CurrencyFieldConfig
  | PercentageFieldConfig
  | SliderFieldConfig
  | RatingFieldConfig
  | CheckboxFieldConfig
  | SwitchFieldConfig
  | SelectFieldConfig
  | DateFieldConfig
  | PasswordFieldConfig
  | PhoneFieldConfig
  | AutoFieldConfig

// =============================================================================
// Form Builder Config
// =============================================================================

/**
 * Секция формы для группировки полей
 */
export interface FormBuilderSection {
  /** Заголовок секции */
  title?: string
  /** Описание секции */
  description?: string
  /** Поля в секции */
  fields: FieldConfig[]
}

/**
 * Конфигурация формы для FormBuilder
 */
export interface FormBuilderConfig {
  /** Поля формы (простой список) */
  fields?: FieldConfig[]
  /** Секции формы (для группировки) */
  sections?: FormBuilderSection[]
}

// =============================================================================
// Form Builder Props
// =============================================================================

/**
 * Props для FormBuilder
 */
export interface FormBuilderProps<TData extends object> {
  /** Конфигурация формы */
  config: FormBuilderConfig
  /** Начальные значения */
  initialValue: TData
  /** Обработчик отправки */
  onSubmit: (data: TData) => void | Promise<void>
  /** Zod схема для валидации */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema?: any
  /** Режим валидации */
  validateOn?: ValidateOn | ValidateOn[]
  /** Middleware */
  middleware?: FormMiddleware<TData>
  /** Отключить все поля */
  disabled?: boolean
  /** Только для чтения */
  readOnly?: boolean
  /** Текст кнопки отправки */
  submitLabel?: string
  /** Дополнительный контент после полей */
  children?: ReactNode
}

// =============================================================================
// Field Renderer
// =============================================================================

/**
 * Извлекает базовые props из конфигурации
 */
function getBaseProps(config: FieldConfig) {
  return {
    placeholder: config.placeholder,
    helperText: config.helperText,
    required: config.required,
    disabled: config.disabled,
  }
}

/**
 * Рендерит поле по конфигурации
 */
function renderField(config: FieldConfig): ReactElement {
  const { name, label } = config
  const resolvedLabel = label ?? camelCaseToLabel(name)
  const baseProps = getBaseProps(config)

  switch (config.type) {
    case 'string':
      return <FieldString key={name} name={name} label={resolvedLabel} {...baseProps} />

    case 'textarea':
      return <FieldTextarea key={name} name={name} label={resolvedLabel} rows={config.rows} {...baseProps} />

    case 'number':
      return (
        <FieldNumber key={name} name={name} label={resolvedLabel} min={config.min} max={config.max} {...baseProps} />
      )

    case 'currency':
      return <FieldCurrency key={name} name={name} label={resolvedLabel} {...baseProps} />

    case 'percentage':
      return <FieldPercentage key={name} name={name} label={resolvedLabel} {...baseProps} />

    case 'slider':
      return (
        <FieldSlider
          key={name}
          name={name}
          label={resolvedLabel}
          min={config.min}
          max={config.max}
          step={config.step}
          {...baseProps}
        />
      )

    case 'rating':
      return <FieldRating key={name} name={name} label={resolvedLabel} {...baseProps} />

    case 'checkbox':
      return <FieldCheckbox key={name} name={name} label={resolvedLabel} {...baseProps} />

    case 'switch':
      return <FieldSwitch key={name} name={name} label={resolvedLabel} {...baseProps} />

    case 'select':
      if (config.native) {
        // NativeSelect использует title вместо label
        const nativeOptions = config.options.map((opt) => ({
          title: opt.label,
          value: opt.value,
        }))
        return <FieldNativeSelect key={name} name={name} label={resolvedLabel} options={nativeOptions} {...baseProps} />
      }
      return <FieldSelect key={name} name={name} label={resolvedLabel} options={config.options} {...baseProps} />

    case 'date':
      return <FieldDate key={name} name={name} label={resolvedLabel} {...baseProps} />

    case 'password':
      return <FieldPassword key={name} name={name} label={resolvedLabel} {...baseProps} />

    case 'phone':
      return <FieldPhone key={name} name={name} label={resolvedLabel} {...baseProps} />

    case 'auto':
      return <FieldAuto key={name} name={name} label={resolvedLabel} {...baseProps} />

    default:
      return <FieldString key={name} name={name} label={resolvedLabel} {...baseProps} />
  }
}

// =============================================================================
// Form Builder Component
// =============================================================================

/**
 * Form.Builder - Генерация формы из JSON конфигурации
 *
 * Позволяет создавать формы декларативно через объект конфигурации
 * вместо написания JSX.
 *
 * @example Простая форма
 * ```tsx
 * const config = {
 *   fields: [
 *     { type: 'string', name: 'firstName', label: 'Имя' },
 *     { type: 'string', name: 'lastName', label: 'Фамилия' },
 *     { type: 'string', name: 'email', label: 'Email', placeholder: 'email@example.com' },
 *     { type: 'number', name: 'age', label: 'Возраст', min: 0, max: 120 },
 *     { type: 'select', name: 'role', label: 'Роль', options: [
 *       { label: 'Пользователь', value: 'user' },
 *       { label: 'Администратор', value: 'admin' },
 *     ]},
 *   ]
 * }
 *
 * <Form.Builder
 *   config={config}
 *   initialValue={{ firstName: '', lastName: '', email: '', age: 18, role: 'user' }}
 *   onSubmit={handleSubmit}
 * />
 * ```
 *
 * @example С секциями
 * ```tsx
 * const config = {
 *   sections: [
 *     {
 *       title: 'Личные данные',
 *       fields: [
 *         { type: 'string', name: 'firstName' },
 *         { type: 'string', name: 'lastName' },
 *       ]
 *     },
 *     {
 *       title: 'Контакты',
 *       fields: [
 *         { type: 'string', name: 'email' },
 *         { type: 'phone', name: 'phone' },
 *       ]
 *     },
 *   ]
 * }
 *
 * <Form.Builder config={config} ... />
 * ```
 *
 * @example С auto-полями (тип определяется из Zod схемы)
 * ```tsx
 * const config = {
 *   fields: [
 *     { type: 'auto', name: 'firstName' },
 *     { type: 'auto', name: 'age' },
 *     { type: 'auto', name: 'isActive' },
 *   ]
 * }
 *
 * <Form.Builder config={config} schema={UserSchema} ... />
 * ```
 */
export function FormBuilder<TData extends object>({
  config,
  initialValue,
  onSubmit,
  schema,
  validateOn,
  middleware,
  disabled,
  readOnly,
  submitLabel = 'Сохранить',
  children,
}: FormBuilderProps<TData>): ReactElement {
  return (
    <Form
      initialValue={initialValue}
      onSubmit={onSubmit}
      schema={schema}
      validateOn={validateOn}
      middleware={middleware}
      disabled={disabled}
      readOnly={readOnly}
    >
      {/* Простой список полей */}
      {config.fields?.map((fieldConfig) => renderField(fieldConfig))}

      {/* Секции с полями */}
      {config.sections?.map((section, sectionIndex) => (
        <div key={sectionIndex}>
          {section.title && <h3>{section.title}</h3>}
          {section.description && <p>{section.description}</p>}
          {section.fields.map((fieldConfig) => renderField(fieldConfig))}
        </div>
      ))}

      {/* Дополнительный контент */}
      {children}

      {/* Кнопка отправки */}
      <ButtonSubmit>{submitLabel}</ButtonSubmit>
    </Form>
  )
}

FormBuilder.displayName = 'FormBuilder'

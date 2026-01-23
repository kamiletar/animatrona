'use client'

import type { ReactElement } from 'react'
import { useFormGroup } from '../../../form-group'
import { renderFieldByType } from '../../field-type-mapper'
import { useDeclarativeForm } from '../../form-context'
import { getZodConstraints } from '../../schema-constraints'
import type { BaseFieldProps } from '../../types'
import type { FieldUIMeta } from '../../types/meta-types'
import { FieldCheckbox } from '../boolean/field-checkbox'
import { FieldSwitch } from '../boolean/field-switch'
import { FieldDate } from '../datetime/field-date'
import { FieldNumber } from '../number/field-number'
import { FieldNativeSelect } from '../selection/field-native-select'
import { FieldString } from '../text/field-string'
import { FieldTextarea } from '../text/field-textarea'

/**
 * Конфигурация автоопределения типа поля
 */
export interface AutoFieldConfig {
  /**
   * Предпочитать Switch вместо Checkbox для boolean
   * @default false
   */
  booleanAsSwitch?: boolean
  /**
   * Использовать Textarea для длинных строк (на основе maxLength в схеме)
   * @default true
   */
  useTextareaForLongStrings?: boolean
  /**
   * Порог длины для использования Textarea
   * @default 200
   */
  textareaThreshold?: number
}

/**
 * Props для AutoField
 */
export interface AutoFieldProps extends BaseFieldProps {
  /** Конфигурация автоопределения */
  config?: AutoFieldConfig
}

/**
 * Извлечь Zod тип из схемы
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getZodType(schema: any): string | undefined {
  if (!schema?._zod?.def) {
    return undefined
  }

  const type = schema._zod.def.type

  // Развернуть wrapper-типы
  if (type === 'optional' || type === 'nullable' || type === 'default') {
    return getZodType(schema._zod.def.inner)
  }

  return type
}

/**
 * Получить enum значения из Zod схемы
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getEnumValues(schema: any): string[] | undefined {
  if (!schema?._zod?.def) {
    return undefined
  }

  const type = schema._zod.def.type

  // Развернуть wrapper-типы
  if (type === 'optional' || type === 'nullable' || type === 'default') {
    return getEnumValues(schema._zod.def.inner)
  }

  if (type === 'enum') {
    return schema._zod.def.values
  }

  if (type === 'literal') {
    const value = schema._zod.def.value
    return typeof value === 'string' ? [value] : undefined
  }

  return undefined
}

/**
 * Получить maxLength из Zod checks
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMaxLength(schema: any): number | undefined {
  if (!schema?._zod?.def?.checks) {
    return undefined
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxCheck = schema._zod.def.checks.find((c: any) => c.kind === 'max_length' || c.kind === 'max')
  return maxCheck?.value
}

/**
 * Получить UI meta из Zod схемы
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getUIMeta(schema: any): FieldUIMeta | undefined {
  if (!schema?.meta) {
    return undefined
  }

  try {
    const meta = schema.meta()
    return meta?.ui as FieldUIMeta | undefined
  } catch {
    return undefined
  }
}

/**
 * Навигировать к схеме по пути
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSchemaAtPath(schema: any, path: string): any {
  if (!schema || !path) {
    return schema
  }

  const parts = path.split('.')
  let current = schema

  for (const part of parts) {
    // Развернуть wrapper-типы
    while (current?._zod?.def?.type && ['optional', 'nullable', 'default'].includes(current._zod.def.type)) {
      current = current._zod.def.inner
    }

    if (!current) {
      return undefined
    }

    // Пропустить числовые индексы
    if (/^\d+$/.test(part)) {
      if (current._zod?.def?.type === 'array') {
        current = current._zod.def.element
      }
      continue
    }

    // Навигация в объект
    if (current._zod?.def?.type === 'object') {
      const shape = current._zod.def.shape
      if (shape && part in shape) {
        current = shape[part]
      } else {
        return undefined
      }
    } else {
      return undefined
    }
  }

  return current
}

/**
 * Преобразовать camelCase в читаемый label
 * @example "firstName" → "First Name"
 * @example "createdAt" → "Created At"
 */
export function camelCaseToLabel(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1') // Добавить пробел перед заглавными
    .replace(/^./, (s) => s.toUpperCase()) // Первую букву заглавной
    .trim()
}

/**
 * Form.Field.Auto - Автоопределение типа поля из Zod схемы
 *
 * Автоматически выбирает подходящий компонент поля на основе типа в Zod схеме:
 * - string → FieldString (или FieldTextarea для длинных строк)
 * - number/bigint/int/float → FieldNumber
 * - boolean → FieldCheckbox (или FieldSwitch)
 * - date → FieldDate
 * - enum → FieldNativeSelect
 *
 * Если label не указан, генерируется из имени поля (camelCase → "Readable Label").
 *
 * @example Базовое использование
 * ```tsx
 * const schema = z.object({
 *   firstName: z.string(),
 *   age: z.number(),
 *   isActive: z.boolean(),
 *   role: z.enum(['admin', 'user', 'guest']),
 *   createdAt: z.date(),
 * })
 *
 * <Form schema={schema} initialValue={...} onSubmit={...}>
 *   <Form.Field.Auto name="firstName" />  // → FieldString, label="First Name"
 *   <Form.Field.Auto name="age" />        // → FieldNumber, label="Age"
 *   <Form.Field.Auto name="isActive" />   // → FieldCheckbox, label="Is Active"
 *   <Form.Field.Auto name="role" />       // → FieldNativeSelect с опциями
 *   <Form.Field.Auto name="createdAt" />  // → FieldDate
 * </Form>
 * ```
 *
 * @example С конфигурацией
 * ```tsx
 * <Form.Field.Auto
 *   name="isActive"
 *   config={{ booleanAsSwitch: true }}
 * />
 * ```
 *
 * @example С явным fieldType в meta
 * ```tsx
 * const schema = z.object({
 *   bio: z.string().meta({ ui: { title: 'Биография', fieldType: 'richText' } }),
 * })
 *
 * <Form.Field.Auto name="bio" />  // → FieldRichText (из meta.fieldType)
 * ```
 */
export function FieldAuto({ name, config, ...baseProps }: AutoFieldProps): ReactElement {
  const { schema } = useDeclarativeForm()
  const parentGroup = useFormGroup()

  if (!name) {
    throw new Error('Form.Field.Auto requires a name prop')
  }

  // Построить полный путь
  const fullPath = parentGroup ? `${parentGroup.name}.${name}` : name

  // Получить схему поля
  const fieldSchema = getSchemaAtPath(schema, fullPath)
  const zodType = getZodType(fieldSchema)
  const enumValues = getEnumValues(fieldSchema)
  const maxLength = getMaxLength(fieldSchema)
  const uiMeta = getUIMeta(fieldSchema)

  // Авто-label если не указан
  const label = baseProps.label ?? uiMeta?.title ?? camelCaseToLabel(name)

  // Если указан явный fieldType в meta — используем renderFieldByType
  if (uiMeta?.fieldType) {
    const constraints = getZodConstraints(schema, fullPath)
    return renderFieldByType(uiMeta.fieldType, {
      name,
      label,
      placeholder: baseProps.placeholder ?? uiMeta.placeholder,
      helperText: baseProps.helperText ?? uiMeta.description,
      required: baseProps.required,
      disabled: baseProps.disabled,
      readOnly: baseProps.readOnly,
      enumValues,
      constraints,
      fieldProps: uiMeta.fieldProps,
    })
  }

  // Конфигурация с дефолтами
  const { booleanAsSwitch = false, useTextareaForLongStrings = true, textareaThreshold = 200 } = config ?? {}

  // Определить компонент по типу схемы (fallback)
  switch (zodType) {
    case 'string':
      // Проверить, нужен ли Textarea
      if (useTextareaForLongStrings && maxLength && maxLength > textareaThreshold) {
        return <FieldTextarea name={name} label={label} {...baseProps} />
      }
      return <FieldString name={name} label={label} {...baseProps} />

    case 'number':
    case 'bigint':
    case 'int':
    case 'float':
      return <FieldNumber name={name} label={label} {...baseProps} />

    case 'boolean':
      if (booleanAsSwitch) {
        return <FieldSwitch name={name} label={label} {...baseProps} />
      }
      return <FieldCheckbox name={name} label={label} {...baseProps} />

    case 'date':
      return <FieldDate name={name} label={label} {...baseProps} />

    case 'enum':
      if (enumValues) {
        // NativeSelectOption использует title вместо label
        const options = enumValues.map((value) => ({
          title: camelCaseToLabel(value),
          value,
        }))
        return <FieldNativeSelect name={name} label={label} options={options} {...baseProps} />
      }
      return <FieldString name={name} label={label} {...baseProps} />

    default:
      // Fallback на String
      return <FieldString name={name} label={label} {...baseProps} />
  }
}

FieldAuto.displayName = 'FieldAuto'

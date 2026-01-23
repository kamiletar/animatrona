'use client'

import type { FieldComponentType, FieldUIMeta } from './types/meta-types'

/**
 * Готовые пресеты для системных полей (id, createdAt, updatedAt)
 *
 * @example
 * ```ts
 * const UserFormSchema = withUIMeta(UserCreateInputSchema, {
 *   ...commonMeta,  // Добавит id, createdAt, updatedAt
 *   name: { title: 'Имя' },
 * })
 * ```
 */
export const commonMeta: Record<string, FieldUIMeta> = {
  id: {
    title: 'ID',
    fieldType: 'string',
    fieldProps: { disabled: true },
  },
  createdAt: {
    title: 'Создано',
    fieldType: 'date',
    fieldProps: { readOnly: true },
  },
  updatedAt: {
    title: 'Обновлено',
    fieldType: 'date',
    fieldProps: { readOnly: true },
  },
}

/**
 * Типы полей для выбора из списка (enum/select)
 */
export type SelectionFieldType = Extract<
  FieldComponentType,
  'select' | 'nativeSelect' | 'radioGroup' | 'radioCard' | 'segmentedGroup' | 'checkboxCard' | 'listbox'
>

/**
 * Хелпер для создания UI метаданных relation полей
 *
 * @example
 * ```ts
 * const OrderFormSchema = withUIMeta(OrderCreateInputSchema, {
 *   categoryId: relationMeta({
 *     title: 'Категория',
 *     model: 'Category',
 *     labelField: 'name',
 *   }),
 * })
 * ```
 *
 * @example С кастомным типом поля
 * ```ts
 * categoryId: relationMeta({
 *   title: 'Категория',
 *   model: 'Category',
 *   labelField: 'name',
 *   fieldType: 'combobox',
 * })
 * ```
 */
export function relationMeta(config: {
  /** Заголовок поля */
  title: string
  /** Имя связанной модели */
  model: string
  /** Поле для отображения label */
  labelField: string
  /** Поле для значения (по умолчанию 'id') */
  valueField?: string
  /** Тип компонента для отображения (по умолчанию 'select') */
  fieldType?: SelectionFieldType
  /** Дополнительные props */
  fieldProps?: Record<string, unknown>
}): FieldUIMeta {
  return {
    title: config.title,
    fieldType: config.fieldType ?? 'select',
    fieldProps: {
      relation: {
        model: config.model,
        labelField: config.labelField,
        valueField: config.valueField ?? 'id',
      },
      ...config.fieldProps,
    },
  }
}

/**
 * Хелпер для создания UI метаданных enum полей с кастомными метками
 *
 * @example Простое использование
 * ```ts
 * const UserFormSchema = withUIMeta(UserCreateInputSchema, {
 *   role: enumMeta({
 *     title: 'Роль',
 *     labels: {
 *       ADMIN: 'Администратор',
 *       MANAGER: 'Менеджер',
 *       USER: 'Пользователь',
 *       GUEST: 'Гость',
 *     },
 *   }),
 * })
 * ```
 *
 * @example С кастомным типом поля
 * ```ts
 * role: enumMeta({
 *   title: 'Роль',
 *   fieldType: 'radioCard',
 *   labels: { ADMIN: 'Администратор', USER: 'Пользователь' },
 * })
 * ```
 *
 * @example С описаниями для каждой опции
 * ```ts
 * priority: enumMeta({
 *   title: 'Приоритет',
 *   fieldType: 'radioCard',
 *   options: [
 *     { value: 'LOW', label: 'Низкий', description: 'Сделать когда-нибудь' },
 *     { value: 'HIGH', label: 'Высокий', description: 'Срочно!' },
 *   ],
 * })
 * ```
 */
export function enumMeta<T extends string>(
  config:
    | {
        /** Заголовок поля */
        title: string
        /** Тип компонента для отображения (по умолчанию nativeSelect) */
        fieldType?: SelectionFieldType
        /** Маппинг enum значений на русские метки */
        labels: Record<T, string>
        /** Описание поля */
        description?: string
        /** Дополнительные props */
        fieldProps?: Record<string, unknown>
      }
    | {
        /** Заголовок поля */
        title: string
        /** Тип компонента для отображения (по умолчанию nativeSelect) */
        fieldType?: SelectionFieldType
        /** Полные опции с value, label и опционально description */
        options: Array<{ value: T; label: string; description?: string }>
        /** Описание поля */
        description?: string
        /** Дополнительные props */
        fieldProps?: Record<string, unknown>
      }
): FieldUIMeta {
  // Определяем options из labels или напрямую
  let options: Array<{ value: string; label: string; description?: string }>

  if ('labels' in config) {
    options = Object.entries(config.labels).map(([value, label]) => ({
      value,
      label: label as string,
    }))
  } else {
    options = config.options
  }

  return {
    title: config.title,
    description: config.description,
    fieldType: config.fieldType ?? 'nativeSelect',
    fieldProps: {
      options,
      ...config.fieldProps,
    },
  }
}

/**
 * Хелпер для создания UI метаданных текстовых полей
 *
 * @example
 * ```ts
 * name: textMeta({ title: 'Имя', placeholder: 'Введите имя' })
 * bio: textMeta({ title: 'О себе', fieldType: 'richText' })
 * ```
 */
export function textMeta(config: {
  title: string
  placeholder?: string
  description?: string
  fieldType?: 'string' | 'textarea' | 'richText' | 'password' | 'passwordStrength' | 'editable'
  fieldProps?: Record<string, unknown>
}): FieldUIMeta {
  return {
    title: config.title,
    placeholder: config.placeholder,
    description: config.description,
    fieldType: config.fieldType ?? 'string',
    fieldProps: config.fieldProps,
  }
}

/**
 * Хелпер для создания UI метаданных числовых полей
 *
 * @example
 * ```ts
 * age: numberMeta({ title: 'Возраст', min: 0, max: 120 })
 * price: numberMeta({ title: 'Цена', fieldType: 'currency', currency: 'RUB' })
 * rating: numberMeta({ title: 'Рейтинг', fieldType: 'rating', count: 5 })
 * ```
 */
export function numberMeta(config: {
  title: string
  description?: string
  fieldType?: 'number' | 'numberInput' | 'slider' | 'rating' | 'currency' | 'percentage'
  min?: number
  max?: number
  step?: number
  currency?: string
  count?: number // для rating
  fieldProps?: Record<string, unknown>
}): FieldUIMeta {
  const { title, description, fieldType, min, max, step, currency, count, fieldProps = {} } = config

  return {
    title,
    description,
    fieldType: fieldType ?? 'number',
    fieldProps: {
      ...(min !== undefined && { min }),
      ...(max !== undefined && { max }),
      ...(step !== undefined && { step }),
      ...(currency && { currency }),
      ...(count !== undefined && { count }),
      ...fieldProps,
    },
  }
}

/**
 * Хелпер для создания UI метаданных булевых полей
 *
 * @example
 * ```ts
 * isActive: booleanMeta({ title: 'Активен', fieldType: 'switch' })
 * newsletter: booleanMeta({ title: 'Подписка', description: 'Получать новости' })
 * ```
 */
export function booleanMeta(config: {
  title: string
  description?: string
  fieldType?: 'checkbox' | 'switch'
  fieldProps?: Record<string, unknown>
}): FieldUIMeta {
  return {
    title: config.title,
    description: config.description,
    fieldType: config.fieldType ?? 'checkbox',
    fieldProps: config.fieldProps,
  }
}

/**
 * Хелпер для создания UI метаданных полей даты/времени
 *
 * @example
 * ```ts
 * birthDate: dateMeta({ title: 'Дата рождения' })
 * appointment: dateMeta({ title: 'Встреча', fieldType: 'dateTimePicker' })
 * duration: dateMeta({ title: 'Длительность', fieldType: 'duration', min: 15, max: 480 })
 * ```
 */
export function dateMeta(config: {
  title: string
  description?: string
  fieldType?: 'date' | 'time' | 'dateRange' | 'dateTimePicker' | 'duration' | 'schedule'
  min?: number | string | Date
  max?: number | string | Date
  fieldProps?: Record<string, unknown>
}): FieldUIMeta {
  const { title, description, fieldType, min, max, fieldProps = {} } = config

  return {
    title,
    description,
    fieldType: fieldType ?? 'date',
    fieldProps: {
      ...(min !== undefined && { min }),
      ...(max !== undefined && { max }),
      ...fieldProps,
    },
  }
}

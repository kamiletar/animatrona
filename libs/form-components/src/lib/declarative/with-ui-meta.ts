'use client'

import { z } from 'zod/v4'
import type { FieldUIMeta } from './types/meta-types'
import { unwrapSchema } from './zod-utils'

/**
 * Конфигурация UI метаданных для плоской схемы (только верхний уровень)
 */
export type UIMetaConfig<T extends z.ZodRawShape> = {
  [K in keyof T]?: FieldUIMeta
}

/** Мутабельный тип для создания новой shape */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MutableShape = { [key: string]: any }

/**
 * Конфигурация UI метаданных с поддержкой вложенных объектов
 * Для вложенных объектов используйте _meta для метаданных самой группы
 */
export type DeepUIMetaConfig<T extends z.ZodRawShape> = {
  [K in keyof T]?: FieldUIMeta | ({ _meta?: FieldUIMeta } & Record<string, FieldUIMeta | unknown>)
}

/**
 * Проверить, является ли схема ZodObject
 */
function isZodObject(schema: unknown): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (schema as any)?._zod?.def?.type === 'object'
}

/**
 * Проверить, содержит ли конфигурация вложенные настройки
 */
function hasNestedConfig(config: unknown): boolean {
  if (typeof config !== 'object' || config === null) {
    return false
  }

  // Если есть _meta — это точно вложенная конфигурация
  if ('_meta' in config) {
    return true
  }

  // Проверяем, есть ли вложенные объекты с title/fieldType
  // Исключаем стандартные поля FieldUIMeta
  const fieldUIMetaKeys = ['title', 'description', 'placeholder', 'tooltip', 'fieldType', 'fieldProps']

  for (const [key, value] of Object.entries(config)) {
    // Пропускаем стандартные поля FieldUIMeta
    if (fieldUIMetaKeys.includes(key)) {
      continue
    }

    // Если значение — объект с title/fieldType/description, это вложенная конфигурация
    if (typeof value === 'object' && value !== null) {
      if ('title' in value || 'fieldType' in value || 'description' in value) {
        return true
      }
    }
  }

  return false
}

/**
 * Обогатить ZenStack/Zod схему UI метаданными
 *
 * Добавляет .meta({ ui: {...} }) к полям схемы на основе конфигурации.
 * Работает только с верхним уровнем полей.
 *
 * @example Базовое использование
 * ```ts
 * import { ProductCreateInputSchema } from '@/generated/zod/objects/ProductCreateInput.schema'
 *
 * const ProductFormSchema = withUIMeta(ProductCreateInputSchema, {
 *   name: { title: 'Название', placeholder: 'Введите название' },
 *   price: { title: 'Цена', fieldType: 'currency', fieldProps: { currency: 'RUB' } },
 *   isActive: { title: 'Активен', fieldType: 'switch' },
 * })
 * ```
 *
 * @example С enum полями
 * ```ts
 * const UserFormSchema = withUIMeta(UserCreateInputSchema, {
 *   role: {
 *     title: 'Роль',
 *     fieldType: 'radioCard',
 *     fieldProps: {
 *       options: [
 *         { value: 'ADMIN', label: 'Администратор' },
 *         { value: 'USER', label: 'Пользователь' },
 *       ],
 *     },
 *   },
 * })
 * ```
 *
 * @param schema Zod object схема
 * @param config Конфигурация UI метаданных для полей
 * @returns Новая схема с добавленными метаданными
 */
export function withUIMeta<T extends z.ZodRawShape>(schema: z.ZodObject<T>, config: UIMetaConfig<T>): z.ZodObject<T> {
  const shape = schema.shape
  const newShape: MutableShape = {}

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const meta = config[key as keyof T]
    if (meta) {
      // Добавить .meta({ ui: {...} }) к полю
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newShape[key] = (fieldSchema as any).meta({ ui: meta })
    } else {
      newShape[key] = fieldSchema
    }
  }

  // Сохраняем strict/passthrough режим если был
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unknownKeys = (schema as any)._zod?.def?.unknownKeys
  if (unknownKeys === 'strict') {
    return z.object(newShape).strict() as z.ZodObject<T>
  }
  if (unknownKeys === 'passthrough') {
    return z.object(newShape).passthrough() as z.ZodObject<T>
  }

  return z.object(newShape) as z.ZodObject<T>
}

/**
 * Обогатить ZenStack/Zod схему UI метаданными с поддержкой вложенных объектов
 *
 * Расширенная версия withUIMeta, которая рекурсивно обрабатывает вложенные объекты.
 * Для метаданных вложенной группы используйте ключ `_meta`.
 *
 * @example С вложенными объектами
 * ```ts
 * const UserFormSchema = withUIMetaDeep(UserCreateInputSchema, {
 *   firstName: { title: 'Имя' },
 *   lastName: { title: 'Фамилия' },
 *   address: {
 *     _meta: { title: 'Адрес доставки' },  // meta для группы
 *     country: { title: 'Страна', fieldType: 'select' },
 *     city: { title: 'Город' },
 *     street: { title: 'Улица' },
 *   },
 * })
 * ```
 *
 * @example Глубокая вложенность
 * ```ts
 * const OrderFormSchema = withUIMetaDeep(OrderCreateInputSchema, {
 *   orderNumber: { title: 'Номер заказа' },
 *   user: {
 *     _meta: { title: 'Данные клиента' },
 *     firstName: { title: 'Имя' },
 *     address: {
 *       _meta: { title: 'Адрес' },
 *       city: { title: 'Город' },
 *     },
 *   },
 * })
 * ```
 *
 * @param schema Zod object схема
 * @param config Конфигурация UI метаданных (может быть вложенной)
 * @returns Новая схема с добавленными метаданными
 */
export function withUIMetaDeep<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  config: DeepUIMetaConfig<T>
): z.ZodObject<T> {
  const shape = schema.shape
  const newShape: MutableShape = {}

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const fieldConfig = config[key as keyof T]

    if (!fieldConfig) {
      newShape[key] = fieldSchema
      continue
    }

    // Получаем unwrapped схему для проверки типа
    const unwrapped = unwrapSchema(fieldSchema)

    // Проверяем, это вложенный объект или обычное поле
    if (isZodObject(unwrapped) && hasNestedConfig(fieldConfig)) {
      // Это вложенный объект с конфигурацией полей
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { _meta, ...nestedConfig } = fieldConfig as { _meta?: FieldUIMeta } & Record<string, any>

      // Рекурсивно обрабатываем вложенный объект
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let nestedSchema = withUIMetaDeep(unwrapped as any, nestedConfig)

      // Применяем _meta к самому полю (для label группы)
      if (_meta) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nestedSchema = (nestedSchema as any).meta({ ui: _meta })
      }

      // Восстанавливаем wrapper'ы (optional, nullable, default)
      newShape[key] = rewrapSchema(fieldSchema, nestedSchema)
    } else {
      // Обычное поле — просто добавляем meta
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newShape[key] = (fieldSchema as any).meta({ ui: fieldConfig as FieldUIMeta })
    }
  }

  // Сохраняем strict/passthrough режим если был
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unknownKeys = (schema as any)._zod?.def?.unknownKeys
  if (unknownKeys === 'strict') {
    return z.object(newShape).strict() as z.ZodObject<T>
  }
  if (unknownKeys === 'passthrough') {
    return z.object(newShape).passthrough() as z.ZodObject<T>
  }

  return z.object(newShape) as z.ZodObject<T>
}

/**
 * Восстановить wrapper'ы (optional, nullable, default) вокруг новой внутренней схемы
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rewrapSchema(original: any, newInner: any): any {
  if (!original?._zod?.def) {
    return newInner
  }

  const type = original._zod.def.type

  if (type === 'optional') {
    return rewrapSchema(original._zod.def.inner, newInner).optional()
  }
  if (type === 'nullable') {
    return rewrapSchema(original._zod.def.inner, newInner).nullable()
  }
  if (type === 'default') {
    const defaultValue = original._zod.def.defaultValue
    return rewrapSchema(original._zod.def.inner, newInner).default(defaultValue)
  }

  return newInner
}

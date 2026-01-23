/**
 * Утилиты для работы с Zod v4 схемами
 *
 * Общие функции для разворачивания обёрток схемы
 * (optional, nullable, default) и получения базовой схемы.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Результат разворачивания схемы с информацией об обязательности
 */
export interface UnwrapResult {
  /** Развёрнутая схема (без optional/nullable/default обёрток) */
  schema: any
  /** Является ли поле обязательным (false если было optional/nullable) */
  required: boolean
}

/**
 * Разворачивает обёртки optional/nullable/default и возвращает базовую схему
 *
 * Поддерживает как Zod v4 (inner), так и возможные различия в API.
 *
 * @example
 * ```ts
 * const innerSchema = unwrapSchema(z.string().optional())
 * // innerSchema будет z.string()
 * ```
 */
export function unwrapSchema(schema: any): any {
  if (!schema?._zod?.def) {
    return schema
  }

  const type = schema._zod.def.type

  // Разворачиваем wrapper-типы
  // Zod v4 использует inner или innerType в зависимости от версии
  if (type === 'optional' || type === 'nullable' || type === 'default') {
    const inner = schema._zod.def.inner ?? schema._zod.def.innerType
    if (inner) {
      return unwrapSchema(inner)
    }
  }

  return schema
}

/**
 * Разворачивает схему и возвращает информацию об обязательности поля
 *
 * В отличие от `unwrapSchema`, также отслеживает была ли схема optional/nullable.
 *
 * @example
 * ```ts
 * const { schema, required } = unwrapSchemaWithRequired(z.string().optional())
 * // schema = z.string()
 * // required = false
 * ```
 */
export function unwrapSchemaWithRequired(schema: any): UnwrapResult {
  if (!schema?._zod?.def) {
    return { schema, required: true }
  }

  const type = schema._zod.def.type

  // Разворачиваем обёртки, чтобы получить внутреннюю схему
  if (type === 'optional' || type === 'nullable') {
    const inner = schema._zod.def.inner ?? schema._zod.def.innerType
    if (inner) {
      const result = unwrapSchemaWithRequired(inner)
      return { schema: result.schema, required: false } // optional/nullable = НЕ обязательно
    }
  }

  if (type === 'default') {
    // default() делает поле необязательным для HTML формы — значение подставится автоматически
    const inner = schema._zod.def.inner ?? schema._zod.def.innerType
    if (inner) {
      const result = unwrapSchemaWithRequired(inner)
      return { schema: result.schema, required: false }
    }
  }

  return { schema, required: true }
}

/**
 * Получает тип Zod схемы
 */
export function getZodType(schema: any): string | undefined {
  return schema?._zod?.def?.type
}

/**
 * Проверяет, является ли схема optional
 */
export function isOptionalSchema(schema: any): boolean {
  const type = getZodType(schema)
  return type === 'optional' || type === 'nullable'
}

/**
 * Проверяет, имеет ли схема default значение
 */
export function hasDefaultValue(schema: any): boolean {
  return getZodType(schema) === 'default'
}

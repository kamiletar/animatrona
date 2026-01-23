'use client'

import { unwrapSchema } from './zod-utils'

/**
 * Извлечение constraints из Zod v4 схем для автоматической настройки полей форм
 *
 * Поддерживает:
 * - Строки: minLength, maxLength, email, url, regex
 * - Числа: min, max, step (int, multipleOf), positive/negative
 * - Даты: min, max
 * - Массивы: minItems, maxItems
 *
 * Структура Zod v4:
 * - Checks хранятся в `schema._zod.def.checks[]`
 * - Каждый check имеет `_zod.def` с типом и параметрами
 */

// =============================================================================
// Типы constraints
// =============================================================================

/** Constraints для строковых полей */
export interface ZodStringConstraints {
  minLength?: number
  maxLength?: number
  /** Автоматический input type на основе Zod checks (email, url) */
  inputType?: 'text' | 'email' | 'url' | 'tel'
  /** HTML5 pattern из regex */
  pattern?: string
}

/** Constraints для числовых полей */
export interface ZodNumberConstraints {
  min?: number
  max?: number
  step?: number
  isInteger?: boolean
}

/** Constraints для полей дат */
export interface ZodDateConstraints {
  /** Минимальная дата в формате YYYY-MM-DD */
  min?: string
  /** Максимальная дата в формате YYYY-MM-DD */
  max?: string
}

/** Constraints для массивов */
export interface ZodArrayConstraints {
  minItems?: number
  maxItems?: number
}

/** Результат извлечения constraints из схемы */
export interface ZodConstraints {
  string?: ZodStringConstraints
  number?: ZodNumberConstraints
  date?: ZodDateConstraints
  array?: ZodArrayConstraints
  /** Тип схемы для определения какие constraints применять */
  schemaType?: 'string' | 'number' | 'date' | 'array' | 'boolean' | 'enum' | 'unknown'
}

// =============================================================================
// Основная функция
// =============================================================================

/**
 * Извлекает constraints из Zod схемы по пути к полю
 *
 * @example
 * ```tsx
 * const schema = z.object({
 *   title: z.string().min(2).max(100),
 *   rating: z.number().min(1).max(10),
 *   birthday: z.date().min(new Date('1900-01-01')),
 *   tags: z.array(z.string()).max(5),
 * })
 *
 * getZodConstraints(schema, 'title')
 * // { schemaType: 'string', string: { minLength: 2, maxLength: 100 } }
 *
 * getZodConstraints(schema, 'rating')
 * // { schemaType: 'number', number: { min: 1, max: 10 } }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getZodConstraints(schema: any, path: string): ZodConstraints {
  if (!schema) {
    return { schemaType: 'unknown' }
  }

  const fieldSchema = getSchemaAtPath(schema, path)
  if (!fieldSchema) {
    return { schemaType: 'unknown' }
  }

  const def = fieldSchema._zod?.def
  if (!def) {
    return { schemaType: 'unknown' }
  }

  const type = def.type
  const checks = def.checks || []

  switch (type) {
    case 'string':
      return {
        schemaType: 'string',
        string: extractStringConstraints(checks),
      }

    case 'number':
      return {
        schemaType: 'number',
        number: extractNumberConstraints(checks),
      }

    case 'date':
      return {
        schemaType: 'date',
        date: extractDateConstraints(checks),
      }

    case 'array':
      return {
        schemaType: 'array',
        array: extractArrayConstraints(checks),
      }

    case 'boolean':
      return { schemaType: 'boolean' }

    case 'enum':
      return { schemaType: 'enum' }

    default:
      return { schemaType: 'unknown' }
  }
}

// =============================================================================
// Извлечение constraints по типам (Zod v4 структура)
// =============================================================================

/**
 * Тип обработчика для check
 * Получает объект constraints и checkDef, модифицирует constraints
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CheckHandler<T> = (constraints: T, checkDef: any) => void

/**
 * Общая функция извлечения constraints из Zod checks
 *
 * Паттерн handlers позволяет избежать дублирования логики итерации.
 * Каждый тип (string, number, date, array) определяет свои handlers.
 *
 * @param checks - Массив Zod checks из схемы
 * @param handlers - Объект с обработчиками для каждого типа check
 * @returns Объект constraints заполненный обработчиками
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractConstraints<T extends object>(checks: any[], handlers: Record<string, CheckHandler<T>>): T {
  const constraints = {} as T

  for (const check of checks) {
    const checkDef = check._zod?.def
    if (!checkDef) {
      continue
    }

    const handler = handlers[checkDef.check]
    if (handler) {
      handler(constraints, checkDef)
    }
  }

  return constraints
}

// =============================================================================
// Handlers для строковых constraints
// =============================================================================

const stringConstraintHandlers: Record<string, CheckHandler<ZodStringConstraints>> = {
  min_length: (c, def) => {
    c.minLength = def.minimum
  },
  max_length: (c, def) => {
    c.maxLength = def.maximum
  },
  length_equals: (c, def) => {
    // Точная длина = и min и max
    c.minLength = def.length
    c.maxLength = def.length
  },
  string_format: (c, def) => {
    // email(), url() и другие форматы
    if (def.format === 'email') {
      c.inputType = 'email'
    } else if (def.format === 'url') {
      c.inputType = 'url'
    } else if (def.format === 'regex' && def.pattern?.source) {
      c.pattern = def.pattern.source
    }
  },
}

/**
 * Извлекает constraints из строковых checks
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractStringConstraints(checks: any[]): ZodStringConstraints {
  return extractConstraints(checks, stringConstraintHandlers)
}

// =============================================================================
// Handlers для числовых constraints
// =============================================================================

const numberConstraintHandlers: Record<string, CheckHandler<ZodNumberConstraints>> = {
  greater_than: (c, def) => {
    // min() создаёт inclusive: true, gt() создаёт inclusive: false
    c.min = def.value
  },
  less_than: (c, def) => {
    // max() создаёт inclusive: true, lt() создаёт inclusive: false
    c.max = def.value
  },
  number_format: (c, def) => {
    // int() создаёт format: 'safeint'
    if (def.format === 'safeint') {
      c.isInteger = true
      c.step = 1
    }
  },
  multiple_of: (c, def) => {
    c.step = def.value
  },
}

/**
 * Извлекает constraints из числовых checks
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractNumberConstraints(checks: any[]): ZodNumberConstraints {
  return extractConstraints(checks, numberConstraintHandlers)
}

// =============================================================================
// Handlers для constraints дат
// =============================================================================

const dateConstraintHandlers: Record<string, CheckHandler<ZodDateConstraints>> = {
  greater_than: (c, def) => {
    // min() для дат
    if (def.value) {
      c.min = formatDateToISO(def.value)
    }
  },
  less_than: (c, def) => {
    // max() для дат
    if (def.value) {
      c.max = formatDateToISO(def.value)
    }
  },
}

/**
 * Извлекает constraints из checks дат
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDateConstraints(checks: any[]): ZodDateConstraints {
  return extractConstraints(checks, dateConstraintHandlers)
}

// =============================================================================
// Handlers для constraints массивов
// =============================================================================

const arrayConstraintHandlers: Record<string, CheckHandler<ZodArrayConstraints>> = {
  min_length: (c, def) => {
    c.minItems = def.minimum
  },
  max_length: (c, def) => {
    c.maxItems = def.maximum
  },
  length: (c, def) => {
    c.minItems = def.length
    c.maxItems = def.length
  },
}

/**
 * Извлекает constraints из checks массивов
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractArrayConstraints(checks: any[]): ZodArrayConstraints {
  return extractConstraints(checks, arrayConstraintHandlers)
}

// =============================================================================
// Вспомогательные функции
// =============================================================================

/**
 * Навигация к схеме по пути (переиспользуем логику из schema-meta.ts)
 * Поддерживает вложенные объекты, массивы, optional/nullable
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSchemaAtPath(schema: any, path: string): any {
  if (!schema || !path) {
    return schema
  }

  const parts = path.split('.')
  let current = schema

  for (const part of parts) {
    current = unwrapSchema(current)

    if (!current) {
      return undefined
    }

    // Пропускаем числовые индексы (для массивов используем element schema)
    if (/^\d+$/.test(part)) {
      if (current._zod?.def?.type === 'array') {
        current = current._zod.def.element
      }
      continue
    }

    // Навигация в shape объекта
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

  return unwrapSchema(current)
}

/**
 * Форматирует дату в строку YYYY-MM-DD для HTML input[type="date"]
 * Принимает Date, ISO string или timestamp
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDateToISO(value: any): string {
  let date: Date

  if (value instanceof Date) {
    date = value
  } else if (typeof value === 'string') {
    date = new Date(value)
  } else if (typeof value === 'number') {
    date = new Date(value)
  } else {
    return ''
  }

  if (isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

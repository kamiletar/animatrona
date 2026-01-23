'use client'

import type {
  ZodArrayConstraints,
  ZodConstraints,
  ZodDateConstraints,
  ZodNumberConstraints,
  ZodStringConstraints,
} from './schema-constraints'

/**
 * Генерирует человекочитаемую подсказку из constraints
 *
 * Используется для автоматического helperText, если он не задан явно.
 *
 * @example
 * ```tsx
 * // В компоненте поля
 * const { constraints } = useFieldConstraints(name)
 * const autoHint = generateConstraintHint(constraints)
 * const helperText = helperTextProp ?? autoHint
 *
 * // Примеры генерации:
 * // z.number().min(1).max(10) → "От 1 до 10"
 * // z.string().max(100) → "Максимум 100 символов"
 * // z.string().min(2).max(50) → "От 2 до 50 символов"
 * // z.array().max(5) → "Максимум 5 элементов"
 * ```
 */
export function generateConstraintHint(constraints: ZodConstraints | undefined): string | undefined {
  if (!constraints) {return undefined}

  switch (constraints.schemaType) {
    case 'string':
      return generateStringHint(constraints.string)
    case 'number':
      return generateNumberHint(constraints.number)
    case 'date':
      return generateDateHint(constraints.date)
    case 'array':
      return generateArrayHint(constraints.array)
    default:
      return undefined
  }
}

/**
 * Генерирует подсказку для строковых полей
 */
function generateStringHint(constraints: ZodStringConstraints | undefined): string | undefined {
  if (!constraints) {return undefined}

  const { minLength, maxLength, inputType } = constraints

  // Специальные типы (email, url) не требуют подсказок о длине
  if (inputType === 'email') {
    if (maxLength) {
      return `Максимум ${maxLength} символов`
    }
    return undefined
  }

  if (inputType === 'url') {
    if (maxLength) {
      return `Максимум ${maxLength} символов`
    }
    return undefined
  }

  // Обычные строки
  if (minLength !== undefined && maxLength !== undefined) {
    if (minLength === maxLength) {
      return `Ровно ${minLength} ${pluralize(minLength, 'символ', 'символа', 'символов')}`
    }
    return `От ${minLength} до ${maxLength} символов`
  }

  if (maxLength !== undefined) {
    return `Максимум ${maxLength} ${pluralize(maxLength, 'символ', 'символа', 'символов')}`
  }

  if (minLength !== undefined) {
    return `Минимум ${minLength} ${pluralize(minLength, 'символ', 'символа', 'символов')}`
  }

  return undefined
}

/**
 * Генерирует подсказку для числовых полей
 */
function generateNumberHint(constraints: ZodNumberConstraints | undefined): string | undefined {
  if (!constraints) {return undefined}

  const { min, max, isInteger } = constraints

  // Диапазон
  if (min !== undefined && max !== undefined) {
    const suffix = isInteger ? ' (целое)' : ''
    return `От ${formatNumber(min)} до ${formatNumber(max)}${suffix}`
  }

  if (max !== undefined) {
    const suffix = isInteger ? ' (целое)' : ''
    return `Максимум ${formatNumber(max)}${suffix}`
  }

  if (min !== undefined) {
    const suffix = isInteger ? ' (целое)' : ''
    return `Минимум ${formatNumber(min)}${suffix}`
  }

  if (isInteger) {
    return 'Целое число'
  }

  return undefined
}

/**
 * Генерирует подсказку для полей дат
 */
function generateDateHint(constraints: ZodDateConstraints | undefined): string | undefined {
  if (!constraints) {return undefined}

  const { min, max } = constraints

  if (min && max) {
    return `С ${formatDate(min)} по ${formatDate(max)}`
  }

  if (min) {
    return `Не ранее ${formatDate(min)}`
  }

  if (max) {
    return `Не позднее ${formatDate(max)}`
  }

  return undefined
}

/**
 * Генерирует подсказку для массивов
 */
function generateArrayHint(constraints: ZodArrayConstraints | undefined): string | undefined {
  if (!constraints) {return undefined}

  const { minItems, maxItems } = constraints

  if (minItems !== undefined && maxItems !== undefined) {
    if (minItems === maxItems) {
      return `Ровно ${minItems} ${pluralize(minItems, 'элемент', 'элемента', 'элементов')}`
    }
    return `От ${minItems} до ${maxItems} элементов`
  }

  if (maxItems !== undefined) {
    return `Максимум ${maxItems} ${pluralize(maxItems, 'элемент', 'элемента', 'элементов')}`
  }

  if (minItems !== undefined) {
    return `Минимум ${minItems} ${pluralize(minItems, 'элемент', 'элемента', 'элементов')}`
  }

  return undefined
}

// =============================================================================
// Вспомогательные функции форматирования
// =============================================================================

/**
 * Склонение слов по числительным (русский язык)
 * @param n - число
 * @param one - форма для 1 (символ)
 * @param few - форма для 2-4 (символа)
 * @param many - форма для 5+ (символов)
 */
function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n)
  const mod10 = abs % 10
  const mod100 = abs % 100

  if (mod100 >= 11 && mod100 <= 19) {
    return many
  }
  if (mod10 === 1) {
    return one
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return few
  }
  return many
}

/**
 * Форматирует число для отображения
 */
function formatNumber(n: number): string {
  // Целые числа без дробной части
  if (Number.isInteger(n)) {
    return n.toLocaleString('ru-RU')
  }
  // С дробной частью
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

/**
 * Форматирует дату YYYY-MM-DD в человекочитаемый формат
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

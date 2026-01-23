import { describe, expect, it } from 'vitest'
import { generateConstraintHint } from './constraint-hints'
import type { ZodConstraints } from './schema-constraints'

describe('generateConstraintHint', () => {
  describe('string constraints', () => {
    it('generates hint for maxLength only', () => {
      const constraints: ZodConstraints = {
        schemaType: 'string',
        string: { maxLength: 100 },
      }

      expect(generateConstraintHint(constraints)).toBe('Максимум 100 символов')
    })

    it('generates hint for minLength only', () => {
      const constraints: ZodConstraints = {
        schemaType: 'string',
        string: { minLength: 2 },
      }

      expect(generateConstraintHint(constraints)).toBe('Минимум 2 символа')
    })

    it('generates hint for min and max length range', () => {
      const constraints: ZodConstraints = {
        schemaType: 'string',
        string: { minLength: 2, maxLength: 100 },
      }

      expect(generateConstraintHint(constraints)).toBe('От 2 до 100 символов')
    })

    it('generates hint for exact length', () => {
      const constraints: ZodConstraints = {
        schemaType: 'string',
        string: { minLength: 6, maxLength: 6 },
      }

      expect(generateConstraintHint(constraints)).toBe('Ровно 6 символов')
    })

    it('handles correct pluralization for 1 symbol', () => {
      const constraints: ZodConstraints = {
        schemaType: 'string',
        string: { minLength: 1 },
      }

      expect(generateConstraintHint(constraints)).toBe('Минимум 1 символ')
    })

    it('handles correct pluralization for 2-4 symbols', () => {
      const constraints: ZodConstraints = {
        schemaType: 'string',
        string: { maxLength: 4 },
      }

      expect(generateConstraintHint(constraints)).toBe('Максимум 4 символа')
    })

    it('handles correct pluralization for 5+ symbols', () => {
      const constraints: ZodConstraints = {
        schemaType: 'string',
        string: { maxLength: 15 },
      }

      expect(generateConstraintHint(constraints)).toBe('Максимум 15 символов')
    })

    it('handles 11-19 special case', () => {
      const constraints: ZodConstraints = {
        schemaType: 'string',
        string: { maxLength: 11 },
      }

      expect(generateConstraintHint(constraints)).toBe('Максимум 11 символов')
    })

    it('returns undefined for email type without length', () => {
      const constraints: ZodConstraints = {
        schemaType: 'string',
        string: { inputType: 'email' },
      }

      expect(generateConstraintHint(constraints)).toBeUndefined()
    })

    it('shows maxLength for email type with length', () => {
      const constraints: ZodConstraints = {
        schemaType: 'string',
        string: { inputType: 'email', maxLength: 255 },
      }

      expect(generateConstraintHint(constraints)).toBe('Максимум 255 символов')
    })
  })

  describe('number constraints', () => {
    it('generates hint for min and max range', () => {
      const constraints: ZodConstraints = {
        schemaType: 'number',
        number: { min: 1, max: 10 },
      }

      expect(generateConstraintHint(constraints)).toBe('От 1 до 10')
    })

    it('generates hint for min only', () => {
      const constraints: ZodConstraints = {
        schemaType: 'number',
        number: { min: 0 },
      }

      expect(generateConstraintHint(constraints)).toBe('Минимум 0')
    })

    it('generates hint for max only', () => {
      const constraints: ZodConstraints = {
        schemaType: 'number',
        number: { max: 100 },
      }

      expect(generateConstraintHint(constraints)).toBe('Максимум 100')
    })

    it('adds integer suffix when isInteger is true', () => {
      const constraints: ZodConstraints = {
        schemaType: 'number',
        number: { min: 1, max: 100, isInteger: true },
      }

      expect(generateConstraintHint(constraints)).toBe('От 1 до 100 (целое)')
    })

    it('shows only integer hint when no min/max', () => {
      const constraints: ZodConstraints = {
        schemaType: 'number',
        number: { isInteger: true },
      }

      expect(generateConstraintHint(constraints)).toBe('Целое число')
    })

    it('formats large numbers with locale', () => {
      const constraints: ZodConstraints = {
        schemaType: 'number',
        number: { max: 1000000 },
      }

      // Зависит от локали, но должно содержать число
      expect(generateConstraintHint(constraints)).toContain('1')
    })

    it('formats decimal numbers', () => {
      const constraints: ZodConstraints = {
        schemaType: 'number',
        number: { min: 0.5, max: 1.5 },
      }

      const hint = generateConstraintHint(constraints)
      expect(hint).toContain('0,5')
      expect(hint).toContain('1,5')
    })
  })

  describe('date constraints', () => {
    it('generates hint for date range', () => {
      const constraints: ZodConstraints = {
        schemaType: 'date',
        date: { min: '2024-01-01', max: '2024-12-31' },
      }

      const hint = generateConstraintHint(constraints)
      expect(hint).toContain('2024')
    })

    it('generates hint for min date only', () => {
      const constraints: ZodConstraints = {
        schemaType: 'date',
        date: { min: '2024-01-01' },
      }

      const hint = generateConstraintHint(constraints)
      expect(hint).toContain('Не ранее')
    })

    it('generates hint for max date only', () => {
      const constraints: ZodConstraints = {
        schemaType: 'date',
        date: { max: '2024-12-31' },
      }

      const hint = generateConstraintHint(constraints)
      expect(hint).toContain('Не позднее')
    })
  })

  describe('array constraints', () => {
    it('generates hint for array range', () => {
      const constraints: ZodConstraints = {
        schemaType: 'array',
        array: { minItems: 1, maxItems: 10 },
      }

      expect(generateConstraintHint(constraints)).toBe('От 1 до 10 элементов')
    })

    it('generates hint for maxItems only', () => {
      const constraints: ZodConstraints = {
        schemaType: 'array',
        array: { maxItems: 5 },
      }

      expect(generateConstraintHint(constraints)).toBe('Максимум 5 элементов')
    })

    it('generates hint for minItems only', () => {
      const constraints: ZodConstraints = {
        schemaType: 'array',
        array: { minItems: 1 },
      }

      expect(generateConstraintHint(constraints)).toBe('Минимум 1 элемент')
    })

    it('generates hint for exact count', () => {
      const constraints: ZodConstraints = {
        schemaType: 'array',
        array: { minItems: 3, maxItems: 3 },
      }

      expect(generateConstraintHint(constraints)).toBe('Ровно 3 элемента')
    })

    it('handles correct pluralization for elements', () => {
      const constraints1: ZodConstraints = {
        schemaType: 'array',
        array: { maxItems: 1 },
      }
      expect(generateConstraintHint(constraints1)).toBe('Максимум 1 элемент')

      const constraints2: ZodConstraints = {
        schemaType: 'array',
        array: { maxItems: 2 },
      }
      expect(generateConstraintHint(constraints2)).toBe('Максимум 2 элемента')

      const constraints5: ZodConstraints = {
        schemaType: 'array',
        array: { maxItems: 5 },
      }
      expect(generateConstraintHint(constraints5)).toBe('Максимум 5 элементов')
    })
  })

  describe('edge cases', () => {
    it('returns undefined for undefined constraints', () => {
      expect(generateConstraintHint(undefined)).toBeUndefined()
    })

    it('returns undefined for unknown schema type', () => {
      const constraints: ZodConstraints = {
        schemaType: 'unknown',
      }

      expect(generateConstraintHint(constraints)).toBeUndefined()
    })

    it('returns undefined for boolean type', () => {
      const constraints: ZodConstraints = {
        schemaType: 'boolean',
      }

      expect(generateConstraintHint(constraints)).toBeUndefined()
    })

    it('returns undefined for enum type', () => {
      const constraints: ZodConstraints = {
        schemaType: 'enum',
      }

      expect(generateConstraintHint(constraints)).toBeUndefined()
    })

    it('returns undefined for empty string constraints', () => {
      const constraints: ZodConstraints = {
        schemaType: 'string',
        string: {},
      }

      expect(generateConstraintHint(constraints)).toBeUndefined()
    })

    it('returns undefined for empty number constraints', () => {
      const constraints: ZodConstraints = {
        schemaType: 'number',
        number: {},
      }

      expect(generateConstraintHint(constraints)).toBeUndefined()
    })
  })
})

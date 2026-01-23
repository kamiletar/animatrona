'use client'

import { useMemo } from 'react'
import { useFormGroup } from '../form-group'
import { useDeclarativeFormOptional } from './form-context'
import { getZodConstraints, type ZodConstraints } from './schema-constraints'

/**
 * Результат хука useFieldConstraints
 */
export interface UseFieldConstraintsResult {
  /** Извлечённые constraints из Zod схемы */
  constraints: ZodConstraints | undefined
  /** Полный путь к полю (с учётом вложенных групп) */
  fullPath: string | undefined
}

/**
 * Хук для извлечения constraints из Zod схемы для поля формы
 *
 * Автоматически учитывает вложенность Form.Group и возвращает constraints
 * на основе типа поля в схеме.
 *
 * @example
 * ```tsx
 * // В компоненте поля
 * function FieldNumber({ name, min: minProp, max: maxProp }) {
 *   const { constraints } = useFieldConstraints(name)
 *
 *   // Props имеют приоритет над constraints из схемы
 *   const min = minProp ?? constraints?.number?.min
 *   const max = maxProp ?? constraints?.number?.max
 *
 *   return <Input type="number" min={min} max={max} />
 * }
 *
 * // При использовании со схемой
 * const schema = z.object({
 *   rating: z.number().min(1).max(10),
 * })
 *
 * <Form schema={schema} initialValue={{ rating: 5 }}>
 *   <Form.Field.Number name="rating" />  // min=1, max=10 автоматически
 * </Form>
 * ```
 */
export function useFieldConstraints(name?: string): UseFieldConstraintsResult {
  const formContext = useDeclarativeFormOptional()
  const groupContext = useFormGroup()

  // Вычисляем полный путь с учётом вложенных групп
  const fullPath = useMemo(() => {
    if (!name && !groupContext?.name) {return undefined}
    if (!name) {return groupContext?.name}
    return groupContext?.name ? `${groupContext.name}.${name}` : name
  }, [name, groupContext?.name])

  // Извлекаем constraints из схемы
  const constraints = useMemo(() => {
    if (!formContext?.schema || !fullPath) {
      return undefined
    }
    return getZodConstraints(formContext.schema, fullPath)
  }, [formContext?.schema, fullPath])

  return { constraints, fullPath }
}

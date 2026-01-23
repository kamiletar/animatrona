'use client'

import type { FieldUIMeta } from './types'
import { unwrapSchemaWithRequired } from './zod-utils'

/**
 * Результат анализа схемы поля
 */
export interface FieldSchemaInfo {
  /** UI метаданные из .meta({ ui: {...} }) */
  ui?: FieldUIMeta
  /** Обязательно ли поле (не optional/nullable) */
  required: boolean
}

/**
 * Извлекает UI метаданные и статус обязательности из Zod схемы по пути поля
 *
 * Поддерживает вложенные пути вроде "info.base.rating" и пути массивов вроде "components.0.title"
 *
 * @example
 * ```tsx
 * const schema = z.object({
 *   title: z.string().meta({ ui: { title: 'Название' } }),  // обязательно
 *   subtitle: z.string().optional(),                         // необязательно
 * })
 *
 * getFieldMeta(schema, 'title')    // { ui: { title: 'Название' }, required: true }
 * getFieldMeta(schema, 'subtitle') // { ui: undefined, required: false }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getFieldMeta(schema: any, path: string): FieldSchemaInfo {
  if (!schema) {
    return { required: false }
  }

  const result = getSchemaAtPath(schema, path)
  if (!result.schema) {
    return { required: false }
  }

  // Zod v4: мета хранится в globalRegistry, доступ через метод .meta()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fieldSchema = result.schema as any
  const meta = typeof fieldSchema?.meta === 'function' ? fieldSchema.meta() : undefined

  return {
    ui: meta?.ui as FieldUIMeta | undefined,
    required: result.required,
  }
}

interface SchemaPathResult {
  /** Схема поля ДО финального unwrap (для извлечения мета) */
  schema: unknown
  /** Обязательность поля после анализа всей цепочки */
  required: boolean
}

/**
 * Разворачивает wrapper-типы схемы (effects, pipeline, transform) до базовой схемы
 * Сохраняет optional/nullable обёртки для корректного определения required
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrapToBaseSchema(schema: any): any {
  if (!schema?._zod?.def) {
    return schema
  }

  const type = schema._zod.def.type

  // Zod v4: effects (от superRefine, refine) имеют inner схему
  if (type === 'effects' || type === 'transform' || type === 'preprocess') {
    const inner = schema._zod.def.inner ?? schema._zod.def.schema
    if (inner) {
      return unwrapToBaseSchema(inner)
    }
  }

  // Zod v4: pipeline (от pipe) имеет in и out схемы
  if (type === 'pipeline') {
    const inner = schema._zod.def.in
    if (inner) {
      return unwrapToBaseSchema(inner)
    }
  }

  return schema
}

/**
 * Навигация к схеме по заданному пути
 * Обрабатывает объекты, массивы и обёртки optional/nullable/effects/pipeline
 * Возвращает и схему, и статус обязательности
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSchemaAtPath(schema: any, path: string): SchemaPathResult {
  if (!schema || !path) {
    return { schema, required: true }
  }

  const parts = path.split('.')
  let current = schema
  let isRequired = true

  for (const part of parts) {
    // Сначала разворачиваем effects/pipeline/transform до базовой схемы
    current = unwrapToBaseSchema(current)

    const unwrapped = unwrapSchemaWithRequired(current)
    current = unwrapped.schema
    // Отслеживаем, встретили ли optional/nullable
    if (!unwrapped.required) {
      isRequired = false
    }

    if (!current) {
      return { schema: undefined, required: false }
    }

    // Снова разворачиваем после unwrap (effects могут быть внутри optional)
    current = unwrapToBaseSchema(current)

    // Пропускаем числовые индексы (элементы массива используют схему элемента)
    if (/^\d+$/.test(part)) {
      // Для массивов получаем схему элемента
      if (current._zod?.def?.type === 'array') {
        current = current._zod.def.element
      }
      continue
    }

    // Переходим в shape объекта
    if (current._zod?.def?.type === 'object') {
      const shape = current._zod.def.shape
      if (shape && part in shape) {
        current = shape[part]
      } else {
        return { schema: undefined, required: false }
      }
    } else {
      return { schema: undefined, required: false }
    }
  }

  // Разворачиваем только effects/pipeline, сохраняя default/optional для мета
  current = unwrapToBaseSchema(current)

  // Определяем required на основе типа обёртки, но возвращаем схему ДО unwrap
  // чтобы можно было получить мета из .meta()
  const finalUnwrap = unwrapSchemaWithRequired(current)

  return {
    // Возвращаем схему ДО unwrap — на ней может быть мета (.default().meta())
    schema: current,
    required: isRequired && finalUnwrap.required,
  }
}

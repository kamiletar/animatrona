'use client'

import type { ZodConstraints } from './schema-constraints'
import { getZodConstraints } from './schema-constraints'
import type { FieldUIMeta } from './types/meta-types'
import { unwrapSchema } from './zod-utils'

/**
 * Информация о поле схемы для автогенерации форм
 */
export interface SchemaFieldInfo {
  /** Полный путь к полю (например, "user.address.city") */
  path: string
  /** Имя поля (последний сегмент пути) */
  name: string
  /** Zod тип: string, number, boolean, date, enum, object, array */
  zodType: string
  /** UI метаданные из .meta({ ui: {...} }) */
  ui?: FieldUIMeta
  /** Обязательное поле (не optional/nullable) */
  required: boolean
  /** Constraints (min, max, minLength, maxLength и т.д.) */
  constraints: ZodConstraints
  /** Вложенные поля для object */
  children?: SchemaFieldInfo[]
  /** Информация об элементе для array */
  element?: SchemaFieldInfo
  /** Enum значения для enum типа */
  enumValues?: string[]
}

/**
 * Получить Zod тип из схемы
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getZodType(schema: any): string {
  const unwrapped = unwrapSchema(schema)
  return unwrapped?._zod?.def?.type ?? 'unknown'
}

/**
 * Проверить, является ли поле обязательным (не optional/nullable)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isRequired(schema: any): boolean {
  if (!schema?._zod?.def) {
    return true
  }

  const type = schema._zod.def.type
  if (type === 'optional' || type === 'nullable') {
    return false
  }
  if (type === 'default') {
    // default всегда имеет значение, считаем не обязательным для UI
    return false
  }

  return true
}

/**
 * Получить UI метаданные из схемы
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
 * Получить enum значения из схемы
 * В Zod v4 используем schema.enum или schema.def.entries
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getEnumValues(schema: any): string[] | undefined {
  const unwrapped = unwrapSchema(schema)
  if (!unwrapped?._zod?.def) {
    return undefined
  }

  const type = unwrapped._zod.def.type

  if (type === 'enum') {
    // Zod v4: используем .enum для получения значений
    // schema.enum возвращает объект { value: "value", ... }
    if (unwrapped.enum && typeof unwrapped.enum === 'object') {
      return Object.values(unwrapped.enum) as string[]
    }
    // Fallback на внутреннюю структуру (для совместимости)
    if (unwrapped._zod.def.values) {
      return unwrapped._zod.def.values
    }
    // Zod v4 также имеет def.entries
    if (unwrapped._zod.def.entries) {
      return Object.values(unwrapped._zod.def.entries) as string[]
    }
    return undefined
  }

  if (type === 'literal') {
    const value = unwrapped._zod.def.value
    return typeof value === 'string' ? [value] : undefined
  }

  return undefined
}

// =============================================================================
// Защита от циклических ссылок
// =============================================================================

/** Максимальная глубина рекурсии для защиты от бесконечных циклов */
const MAX_TRAVERSAL_DEPTH = 20

/**
 * Контекст обхода схемы
 * Хранит посещённые схемы и текущую глубину для защиты от циклов
 */
interface TraversalContext {
  /** Set посещённых схем (для обнаружения циклов) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visited: WeakSet<any>
  /** Текущая глубина рекурсии */
  depth: number
}

/**
 * Создать новый контекст обхода
 */
function createTraversalContext(): TraversalContext {
  return {
    visited: new WeakSet(),
    depth: 0,
  }
}

/**
 * Проверить, можно ли продолжать обход
 * Возвращает false если схема уже посещена или достигнута максимальная глубина
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function canTraverse(schema: any, ctx: TraversalContext): boolean {
  // Проверка глубины
  if (ctx.depth >= MAX_TRAVERSAL_DEPTH) {
    console.warn(`schema-traversal: Maximum depth (${MAX_TRAVERSAL_DEPTH}) exceeded, stopping recursion`)
    return false
  }

  // Проверка циклической ссылки
  if (schema && typeof schema === 'object' && ctx.visited.has(schema)) {
    console.warn('schema-traversal: Circular reference detected, stopping recursion')
    return false
  }

  return true
}

/**
 * Отметить схему как посещённую
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function markVisited(schema: any, ctx: TraversalContext): void {
  if (schema && typeof schema === 'object') {
    ctx.visited.add(schema)
  }
}

// =============================================================================
// Функции обхода схемы
// =============================================================================

/**
 * Анализировать элемент массива
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyzeArrayElement(elementSchema: any, parentPath: string, ctx: TraversalContext): SchemaFieldInfo | undefined {
  if (!canTraverse(elementSchema, ctx)) {
    return undefined
  }
  markVisited(elementSchema, ctx)

  const unwrapped = unwrapSchema(elementSchema)
  const zodType = getZodType(unwrapped)
  // Для элементов массива путь — это путь родителя + [*]
  const path = `${parentPath}[*]`

  const fieldInfo: SchemaFieldInfo = {
    path,
    name: '*',
    zodType,
    ui: getUIMeta(elementSchema),
    required: isRequired(elementSchema),
    constraints: {}, // Constraints для элементов определяются отдельно
  }

  // Если элемент — объект, рекурсивно обходим его поля
  if (zodType === 'object' && unwrapped._zod?.def?.shape) {
    const children = traverseSchemaShape(unwrapped._zod.def.shape, path, { ...ctx, depth: ctx.depth + 1 })
    if (children.length > 0) {
      fieldInfo.children = children
    }
  }

  // Если элемент — enum
  if (zodType === 'enum' || zodType === 'literal') {
    fieldInfo.enumValues = getEnumValues(elementSchema)
  }

  return fieldInfo
}

/**
 * Обойти shape объекта и вернуть информацию о полях
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function traverseSchemaShape(shape: Record<string, any>, parentPath = '', ctx: TraversalContext = createTraversalContext()): SchemaFieldInfo[] {
  const fields: SchemaFieldInfo[] = []

  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    if (!canTraverse(fieldSchema, ctx)) {
      continue
    }
    markVisited(fieldSchema, ctx)

    const path = parentPath ? `${parentPath}.${fieldName}` : fieldName
    const unwrapped = unwrapSchema(fieldSchema)
    const zodType = getZodType(fieldSchema)

    const fieldInfo: SchemaFieldInfo = {
      path,
      name: fieldName,
      zodType,
      ui: getUIMeta(fieldSchema),
      required: isRequired(fieldSchema),
      constraints: getZodConstraints(fieldSchema, ''),
    }

    // Обработка вложенных объектов
    if (zodType === 'object' && unwrapped._zod?.def?.shape) {
      const children = traverseSchemaShape(unwrapped._zod.def.shape, path, { ...ctx, depth: ctx.depth + 1 })
      if (children.length > 0) {
        fieldInfo.children = children
      }
    }

    // Обработка массивов
    if (zodType === 'array' && unwrapped._zod?.def?.element) {
      const element = analyzeArrayElement(unwrapped._zod.def.element, path, { ...ctx, depth: ctx.depth + 1 })
      if (element) {
        fieldInfo.element = element
      }
    }

    // Обработка enum
    if (zodType === 'enum' || zodType === 'literal') {
      fieldInfo.enumValues = getEnumValues(fieldSchema)
    }

    fields.push(fieldInfo)
  }

  return fields
}

/**
 * Обойти Zod схему и вернуть информацию о всех полях
 *
 * @example
 * ```ts
 * const schema = z.object({
 *   firstName: z.string().meta({ ui: { title: 'Имя' } }),
 *   address: z.object({
 *     city: z.string(),
 *     zip: z.string(),
 *   }),
 *   tags: z.array(z.string()),
 * })
 *
 * const fields = traverseSchema(schema)
 * // [
 * //   { path: 'firstName', zodType: 'string', ui: { title: 'Имя' }, ... },
 * //   { path: 'address', zodType: 'object', children: [...] },
 * //   { path: 'tags', zodType: 'array', element: { zodType: 'string' } },
 * // ]
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function traverseSchema(schema: any): SchemaFieldInfo[] {
  if (!schema?._zod?.def) {
    return []
  }

  const unwrapped = unwrapSchema(schema)
  const type = unwrapped._zod?.def?.type

  // Поддерживаем только object на верхнем уровне
  if (type !== 'object' || !unwrapped._zod?.def?.shape) {
    return []
  }

  return traverseSchemaShape(unwrapped._zod.def.shape)
}

/**
 * Получить плоский список всех путей полей (для include/exclude фильтрации)
 */
export function getFieldPaths(fields: SchemaFieldInfo[], recursive = true): string[] {
  const paths: string[] = []

  for (const field of fields) {
    paths.push(field.path)

    if (recursive && field.children) {
      paths.push(...getFieldPaths(field.children, recursive))
    }
  }

  return paths
}

/**
 * Отфильтровать поля по include/exclude
 */
export function filterFields(
  fields: SchemaFieldInfo[],
  options: { include?: string[]; exclude?: string[] }
): SchemaFieldInfo[] {
  const { include, exclude } = options

  return fields.filter((field) => {
    // Проверяем по имени поля (name) для топ-левел фильтрации
    if (include && !include.includes(field.name)) {
      return false
    }
    if (exclude && exclude.includes(field.name)) {
      return false
    }
    return true
  })
}

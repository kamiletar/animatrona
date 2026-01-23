import type { FormFieldMeta, ZodConstraints } from './types.js'

/**
 * Имена props, которые являются Zod constraints (а не UI props)
 */
const ZOD_CONSTRAINT_NAMES = new Set([
  // Number
  'min',
  'max',
  'step',
  'positive',
  'negative',
  // String
  'minLength',
  'maxLength',
  'pattern',
  'email',
  'url',
  'uuid',
])

/**
 * Извлечь метку из комментария enum значения
 *
 * Поддерживает:
 * - `// Сладкое` (inline комментарий)
 * - `/// Сладкое` (doc комментарий)
 *
 * @param comments Массив комментариев из AST
 * @returns Извлечённая метка или undefined
 */
export function extractEnumLabel(comments: string[]): string | undefined {
  if (!comments || comments.length === 0) {
    return undefined
  }

  // Берём первый комментарий
  const comment = comments[0]?.trim()
  if (!comment) {
    return undefined
  }

  // Убираем префиксы /// или //
  const label = comment.replace(/^\/\/\/?/, '').trim()
  return label || undefined
}

/**
 * Преобразовать SCREAMING_CASE в Title Case
 *
 * @example
 * toTitleCase('SWEET') // 'Sweet'
 * toTitleCase('BANK_TRANSFER') // 'Bank Transfer'
 */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Парсить @form.* директивы из комментариев поля
 *
 * Поддерживаемые директивы:
 * - @form.title("...")
 * - @form.placeholder("...")
 * - @form.description("...")
 * - @form.fieldType("...")
 * - @form.props({...})
 * - @form.relation({...})
 * - @form.exclude
 *
 * @param comments Массив комментариев из AST
 * @returns Распарсенные метаданные формы
 */
export function parseFormMeta(comments: string[]): FormFieldMeta {
  const meta: FormFieldMeta = {}

  if (!comments || comments.length === 0) {
    return meta
  }

  // Объединяем все комментарии в одну строку для парсинга
  const allComments = comments.join('\n')

  // @form.title("...")
  const titleMatch = allComments.match(/@form\.title\("([^"]+)"\)/)
  if (titleMatch) {
    meta.title = titleMatch[1]
  }

  // @form.placeholder("...")
  const placeholderMatch = allComments.match(/@form\.placeholder\("([^"]+)"\)/)
  if (placeholderMatch) {
    meta.placeholder = placeholderMatch[1]
  }

  // @form.description("...")
  const descriptionMatch = allComments.match(/@form\.description\("([^"]+)"\)/)
  if (descriptionMatch) {
    meta.description = descriptionMatch[1]
  }

  // @form.fieldType("...")
  const fieldTypeMatch = allComments.match(/@form\.fieldType\("([^"]+)"\)/)
  if (fieldTypeMatch) {
    meta.fieldType = fieldTypeMatch[1]
  }

  // @form.props({...}) - JS object literal (не строгий JSON)
  // Разделяем на Zod constraints (min, max, etc.) и UI props (остальные)
  const propsMatch = allComments.match(/@form\.props\((\{[\s\S]*?\})\)/)
  if (propsMatch) {
    try {
      // Преобразуем JS object literal в валидный JSON:
      const jsonStr = propsMatch[1]
        .replace(/'/g, '"') // Одинарные кавычки → двойные
        .replace(/(\w+)\s*:/g, '"$1":') // key: → "key":
        .replace(/,\s*}/g, '}') // Убираем trailing comma
      const allProps = JSON.parse(jsonStr) as Record<string, unknown>

      // Разделяем на constraints и UI props
      const constraints: ZodConstraints = {}
      const uiProps: Record<string, unknown> = {}

      for (const [key, value] of Object.entries(allProps)) {
        if (ZOD_CONSTRAINT_NAMES.has(key)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(constraints as any)[key] = value
        } else {
          uiProps[key] = value
        }
      }

      if (Object.keys(constraints).length > 0) {
        meta.constraints = constraints
      }
      if (Object.keys(uiProps).length > 0) {
        meta.props = uiProps
      }
    } catch {
      // Игнорируем ошибки парсинга
    }
  }

  // @form.relation({...}) - JS object literal
  const relationMatch = allComments.match(/@form\.relation\((\{[\s\S]*?\})\)/)
  if (relationMatch) {
    try {
      const jsonStr = relationMatch[1]
        .replace(/'/g, '"')
        .replace(/(\w+)\s*:/g, '"$1":')
        .replace(/,\s*}/g, '}')
      meta.relation = JSON.parse(jsonStr)
    } catch {
      // Игнорируем ошибки парсинга
    }
  }

  // @form.exclude
  if (allComments.includes('@form.exclude')) {
    meta.exclude = true
  }

  return meta
}

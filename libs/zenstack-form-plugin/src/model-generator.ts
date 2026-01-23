import type { DataField, DataFieldAttribute, DataModel } from '@zenstackhq/language/ast'
import { parseFormMeta } from './parser.js'
import type { FormFieldMeta, I18nConfig, ModelFieldInfo, ModelInfo, ZodConstraints } from './types.js'

/**
 * Маппинг Prisma типов в Zod типы
 */
const PRISMA_TO_ZOD: Record<string, string> = {
  String: 'z.string()',
  Int: 'z.number().int()',
  Float: 'z.number()',
  Decimal: 'z.number()',
  BigInt: 'z.bigint()',
  Boolean: 'z.boolean()',
  DateTime: 'z.date()',
  Json: 'z.unknown()',
  Bytes: 'z.unknown()',
}

/**
 * Получить тип поля из AST
 *
 * ZenStack AST структура:
 * - Примитивы (String, Int, Float, etc.): field.type.type = "Int" (строка)
 * - Ссылки (enum, model): field.type.reference.ref.name = "RecipeType"
 */
function getFieldType(field: DataField): string {
  const typeRef = field.type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyType = typeRef as any

  // Для примитивов: anyType.type это строка ("String", "Int", "Float", etc.)
  if (typeof anyType?.type === 'string') {
    return anyType.type
  }

  // Для ссылочных типов (enum, model): anyType.reference?.ref?.name
  if (anyType?.reference?.ref?.name) {
    return anyType.reference.ref.name
  }

  // Fallback через $refText
  if (anyType?.type?.$refText) {
    return anyType.type.$refText
  }

  return 'String'
}

/**
 * Проверить, является ли тип enum
 */
function isEnumType(field: DataField, enumNames: Set<string>): boolean {
  const typeName = getFieldType(field)
  return enumNames.has(typeName)
}

/**
 * Проверить, является ли поле обязательным
 */
function isRequired(field: DataField): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !(field.type as any)?.optional
}

/**
 * Проверить, является ли поле массивом
 */
function isList(field: DataField): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(field.type as any)?.array
}

/**
 * Получить значение по умолчанию из атрибутов
 */
function getDefaultValue(field: DataField): unknown | undefined {
  const defaultAttr = field.attributes.find((attr: DataFieldAttribute) => attr.decl?.$refText === '@default')

  if (!defaultAttr || defaultAttr.args.length === 0) {
    return undefined
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arg = defaultAttr.args[0] as any

  if (arg?.value?.$type === 'BooleanLiteral') {
    return arg.value.value
  }
  if (arg?.value?.$type === 'NumberLiteral') {
    // Явно преобразуем в число, т.к. AST может хранить как строку
    return Number(arg.value.value)
  }
  if (arg?.value?.$type === 'StringLiteral') {
    return arg.value.value
  }

  return undefined
}

/**
 * Проверить, является ли тип ссылкой на модель (а не примитив или enum)
 */
function isModelReference(field: DataField, enumNames: Set<string>): boolean {
  const typeName = getFieldType(field)

  // Если это примитив Prisma — не модель
  if (PRISMA_TO_ZOD[typeName]) {
    return false
  }

  // Если это enum — не модель
  if (enumNames.has(typeName)) {
    return false
  }

  // Всё остальное — ссылка на модель
  return true
}

/**
 * Извлечь информацию о модели из AST
 */
export function extractModelInfo(model: DataModel, enumNames: Set<string>): ModelInfo {
  const fields: ModelFieldInfo[] = []
  const excludedFields: string[] = []

  // Системные поля, которые всегда исключаются
  const systemFields = ['id', 'createdAt', 'updatedAt']

  for (const field of model.fields) {
    const fieldType = getFieldType(field)
    const formMeta = parseFormMeta(field.comments)

    // Проверяем, нужно ли исключить поле
    const isSystemField = systemFields.includes(field.name)
    const isId = field.attributes.some((attr: DataFieldAttribute) => attr.decl?.$refText === 'id')
    const hasRelationAttr = field.attributes.some((attr: DataFieldAttribute) => attr.decl?.$refText === 'relation')
    const isModelRef = isModelReference(field, enumNames)

    // Исключаем: системные, id, relation поля, ссылки на модели
    // НО: если есть @form.relation — оставляем FK поле для select
    const hasFormRelation = !!formMeta.relation
    const shouldExclude =
      formMeta.exclude || isId || hasRelationAttr || (isModelRef && !hasFormRelation) || isSystemField

    if (shouldExclude) {
      excludedFields.push(field.name)
      continue
    }

    const fieldInfo: ModelFieldInfo = {
      name: field.name,
      type: fieldType,
      isRequired: isRequired(field),
      isList: isList(field),
      isEnum: isEnumType(field, enumNames),
      enumName: isEnumType(field, enumNames) ? fieldType : undefined,
      defaultValue: getDefaultValue(field),
      formMeta,
    }

    fields.push(fieldInfo)
  }

  return {
    name: model.name,
    fields,
    excludedFields,
  }
}

/**
 * Сгенерировать Zod constraints из @form.props
 */
function generateConstraints(constraints: ZodConstraints | undefined, prismaType: string): string {
  if (!constraints) {
    return ''
  }

  const parts: string[] = []
  const isNumber = ['Int', 'Float', 'Decimal', 'BigInt'].includes(prismaType)
  const isString = prismaType === 'String'

  if (isNumber) {
    if (constraints.min !== undefined) {
      parts.push(`.min(${constraints.min})`)
    }
    if (constraints.max !== undefined) {
      parts.push(`.max(${constraints.max})`)
    }
    if (constraints.step !== undefined) {
      parts.push(`.multipleOf(${constraints.step})`)
    }
    if (constraints.positive) {
      parts.push('.positive()')
    }
    if (constraints.negative) {
      parts.push('.negative()')
    }
  }

  if (isString) {
    if (constraints.minLength !== undefined) {
      parts.push(`.min(${constraints.minLength})`)
    }
    if (constraints.maxLength !== undefined) {
      parts.push(`.max(${constraints.maxLength})`)
    }
    if (constraints.pattern) {
      parts.push(`.regex(/${constraints.pattern}/)`)
    }
    if (constraints.email) {
      parts.push('.email()')
    }
    if (constraints.url) {
      parts.push('.url()')
    }
    if (constraints.uuid) {
      parts.push('.uuid()')
    }
  }

  return parts.join('')
}

/**
 * Сгенерировать Zod тип для поля
 */
function generateZodType(field: ModelFieldInfo, _enumNames: Set<string>): string {
  let zodType: string

  if (field.isEnum && field.enumName) {
    // Используем импортированную enum схему
    zodType = `${field.enumName}FormSchema`
  } else {
    // Маппим Prisma тип в Zod
    zodType = PRISMA_TO_ZOD[field.type] ?? 'z.string()'
  }

  // Применяем constraints из @form.props (min, max, etc.)
  const constraintsStr = generateConstraints(field.formMeta.constraints, field.type)
  if (constraintsStr) {
    zodType = `${zodType}${constraintsStr}`
  }

  // Массивы
  if (field.isList) {
    zodType = `z.array(${zodType})`
  }

  // Опциональные поля
  if (!field.isRequired) {
    zodType = `${zodType}.optional()`
  }

  // Значение по умолчанию
  if (field.defaultValue !== undefined) {
    let defaultStr: string
    if (typeof field.defaultValue === 'string') {
      defaultStr = `'${field.defaultValue}'`
    } else if (typeof field.defaultValue === 'boolean' || typeof field.defaultValue === 'number') {
      defaultStr = String(field.defaultValue)
    } else {
      defaultStr = JSON.stringify(field.defaultValue)
    }
    zodType = `${zodType}.default(${defaultStr})`
  }

  return zodType
}

/**
 * Параметры генерации UI meta
 */
interface GenerateUIMetaParams {
  formMeta: FormFieldMeta
  modelName: string
  fieldName: string
  i18nConfig: I18nConfig | null
}

/**
 * Сгенерировать UI meta объект для поля
 */
function generateUIMeta(params: GenerateUIMetaParams): string | null {
  const { formMeta, modelName, fieldName, i18nConfig } = params
  const parts: string[] = []

  if (formMeta.title) {
    parts.push(`title: '${formMeta.title}'`)
  }
  if (formMeta.placeholder) {
    parts.push(`placeholder: '${formMeta.placeholder}'`)
  }
  if (formMeta.description) {
    parts.push(`description: '${formMeta.description}'`)
  }
  if (formMeta.fieldType) {
    parts.push(`fieldType: '${formMeta.fieldType}'`)
  }
  if (formMeta.props) {
    parts.push(`fieldProps: ${JSON.stringify(formMeta.props)}`)
  }
  if (formMeta.relation) {
    parts.push(`fieldProps: { relation: ${JSON.stringify(formMeta.relation)} }`)
  }

  // Добавляем i18nKey если i18n включен
  if (i18nConfig?.enabled) {
    parts.push(`i18nKey: '${modelName}.${fieldName}'`)
  }

  if (parts.length === 0) {
    return null
  }

  return `{ ${parts.join(', ')} }`
}

/**
 * Сгенерировать код для модели
 */
export function generateModelCode(
  modelInfo: ModelInfo,
  enumNames: Set<string>,
  i18nConfig: I18nConfig | null = null
): string {
  const { name, fields, excludedFields } = modelInfo

  // Собираем импорты enum'ов
  const enumImports = new Set<string>()
  for (const field of fields) {
    if (field.isEnum && field.enumName) {
      enumImports.add(field.enumName)
    }
  }

  // Генерируем импорты
  const imports = [`import { z } from 'zod/v4'`]
  for (const enumName of enumImports) {
    imports.push(`import { ${enumName}FormSchema } from './enums/${enumName}.form'`)
  }

  // Генерируем поля схемы
  const schemaFields: string[] = []
  for (const field of fields) {
    const zodType = generateZodType(field, enumNames)
    const uiMeta = generateUIMeta({
      formMeta: field.formMeta,
      modelName: name,
      fieldName: field.name,
      i18nConfig,
    })

    if (uiMeta) {
      schemaFields.push(`  ${field.name}: ${zodType}\n    .meta({\n      ui: ${uiMeta}\n    })`)
    } else {
      schemaFields.push(`  ${field.name}: ${zodType}`)
    }
  }

  const excludedFieldsStr = excludedFields.map((f) => `'${f}'`).join(', ')

  return `// AUTO-GENERATED by @lena/zenstack-form-plugin
// DO NOT EDIT MANUALLY

${imports.join('\n')}

/**
 * Схема создания ${name} с UI метаданными
 */
export const ${name}CreateFormSchema = z.object({
${schemaFields.join(',\n')}
})

/**
 * Схема обновления ${name} (все поля опциональны)
 */
export const ${name}UpdateFormSchema = ${name}CreateFormSchema.partial()

/**
 * Поля, исключённые из форм
 */
export const ${name}ExcludedFields = [${excludedFieldsStr}] as const

/**
 * Типы
 */
export type ${name}CreateForm = z.infer<typeof ${name}CreateFormSchema>
export type ${name}UpdateForm = z.infer<typeof ${name}UpdateFormSchema>
`
}

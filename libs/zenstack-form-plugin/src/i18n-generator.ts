import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { EnumInfo, I18nConfig, I18nTranslations, ModelInfo, ValidationTranslations } from './types.js'

/**
 * Собрать переводы из моделей
 */
export function collectModelTranslations(models: ModelInfo[]): I18nTranslations['models'] {
  const translations: I18nTranslations['models'] = {}

  for (const model of models) {
    const modelTranslations: Record<string, Record<string, string>> = {}

    for (const field of model.fields) {
      const fieldTranslations: Record<string, string> = {}

      if (field.formMeta.title) {
        fieldTranslations.title = field.formMeta.title
      }
      if (field.formMeta.placeholder) {
        fieldTranslations.placeholder = field.formMeta.placeholder
      }
      if (field.formMeta.description) {
        fieldTranslations.description = field.formMeta.description
      }

      // Добавляем только если есть хотя бы одно значение
      if (Object.keys(fieldTranslations).length > 0) {
        modelTranslations[field.name] = fieldTranslations
      }
    }

    // Добавляем модель только если есть поля с переводами
    if (Object.keys(modelTranslations).length > 0) {
      translations[model.name] = modelTranslations
    }
  }

  return translations
}

/**
 * Собрать переводы из enum'ов
 */
export function collectEnumTranslations(enums: EnumInfo[]): I18nTranslations['enums'] {
  const translations: I18nTranslations['enums'] = {}

  for (const enumInfo of enums) {
    const enumTranslations: Record<string, Record<string, string>> = {}

    for (const value of enumInfo.values) {
      enumTranslations[value.name] = { label: value.label }
    }

    translations[enumInfo.name] = enumTranslations
  }

  return translations
}

/**
 * Генерация переводов для ошибок валидации Zod
 *
 * Структура ключей соответствует Zod v4 issue codes:
 * - validation.{code} — базовый ключ
 * - validation.{code}.{origin} — с указанием типа (string, number, array, date)
 *
 * Параметры интерполяции:
 * - {minimum}, {maximum} — для too_small/too_big
 * - {expected}, {received} — для invalid_type
 * - {options} — для invalid_enum_value
 * - {keys} — для unrecognized_keys
 */
export function generateValidationTranslations(locale: string): ValidationTranslations {
  const isRussian = locale === 'ru'

  return {
    // Обязательное поле (когда undefined/null передан)
    invalid_type: isRussian
      ? 'Ожидался тип {expected}, получен {received}'
      : 'Expected {expected}, received {received}',
    required: isRussian ? 'Обязательное поле' : 'Required field',

    // Слишком маленькое значение
    too_small: {
      string: isRussian ? 'Минимум {minimum} символов' : 'Minimum {minimum} characters',
      number: isRussian ? 'Минимум {minimum}' : 'Minimum {minimum}',
      array: isRussian ? 'Минимум {minimum} элементов' : 'Minimum {minimum} items',
      date: isRussian ? 'Дата должна быть не ранее {minimum}' : 'Date must be after {minimum}',
      set: isRussian ? 'Минимум {minimum} элементов' : 'Minimum {minimum} items',
      file: isRussian ? 'Минимальный размер файла {minimum}' : 'Minimum file size {minimum}',
    },

    // Слишком большое значение
    too_big: {
      string: isRussian ? 'Максимум {maximum} символов' : 'Maximum {maximum} characters',
      number: isRussian ? 'Максимум {maximum}' : 'Maximum {maximum}',
      array: isRussian ? 'Максимум {maximum} элементов' : 'Maximum {maximum} items',
      date: isRussian ? 'Дата должна быть не позднее {maximum}' : 'Date must be before {maximum}',
      set: isRussian ? 'Максимум {maximum} элементов' : 'Maximum {maximum} items',
      file: isRussian ? 'Максимальный размер файла {maximum}' : 'Maximum file size {maximum}',
    },

    // Невалидный формат строки (Zod v4: invalid_format, ранее invalid_string)
    invalid_format: {
      email: isRussian ? 'Некорректный email' : 'Invalid email address',
      url: isRussian ? 'Некорректный URL' : 'Invalid URL',
      uuid: isRussian ? 'Некорректный UUID' : 'Invalid UUID',
      cuid: isRussian ? 'Некорректный CUID' : 'Invalid CUID',
      regex: isRussian ? 'Не соответствует формату' : 'Does not match pattern',
      datetime: isRussian ? 'Некорректная дата/время' : 'Invalid datetime',
      date: isRussian ? 'Некорректная дата' : 'Invalid date',
      time: isRussian ? 'Некорректное время' : 'Invalid time',
      ip: isRussian ? 'Некорректный IP-адрес' : 'Invalid IP address',
      base64: isRussian ? 'Некорректный Base64' : 'Invalid Base64',
      json_string: isRussian ? 'Некорректный JSON' : 'Invalid JSON',
      emoji: isRussian ? 'Должен содержать эмодзи' : 'Must contain emoji',
      jwt: isRussian ? 'Некорректный JWT' : 'Invalid JWT',
      lowercase: isRussian ? 'Только строчные буквы' : 'Must be lowercase',
      uppercase: isRussian ? 'Только заглавные буквы' : 'Must be uppercase',
    },

    // Число не кратно
    not_multiple_of: isRussian ? 'Должно быть кратно {multipleOf}' : 'Must be multiple of {multipleOf}',

    // Неизвестные ключи в объекте
    unrecognized_keys: isRussian ? 'Неизвестные поля: {keys}' : 'Unknown fields: {keys}',

    // Невалидное значение (Zod v4: invalid_value, объединяет invalid_enum_value + invalid_literal)
    invalid_value: isRussian ? 'Недопустимое значение. Ожидается: {options}' : 'Invalid value. Expected: {options}',

    // Невалидный union
    invalid_union: isRussian ? 'Невалидные данные' : 'Invalid data',

    // Невалидный ключ (для z.record/z.map)
    invalid_key: isRussian ? 'Невалидный ключ' : 'Invalid key',

    // Невалидный элемент (для z.map/z.set)
    invalid_element: isRussian ? 'Невалидный элемент' : 'Invalid element',

    // Кастомная ошибка (.refine, .superRefine)
    custom: '{message}',
  }
}

/**
 * Прочитать существующий JSON файл переводов
 */
async function readExistingTranslations(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Глубокое слияние двух объектов
 * - Новые ключи добавляются с пустыми значениями
 * - Существующие переводы сохраняются
 * - Устаревшие ключи удаляются
 */
function mergeTranslations(
  source: Record<string, unknown>,
  existing: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Рекурсивное слияние для вложенных объектов
      const existingValue = existing[key]
      if (typeof existingValue === 'object' && existingValue !== null && !Array.isArray(existingValue)) {
        result[key] = mergeTranslations(value as Record<string, unknown>, existingValue as Record<string, unknown>)
      } else {
        // Новый вложенный объект — рекурсивно создаём с пустыми значениями
        result[key] = createEmptyTranslations(value as Record<string, unknown>)
      }
    } else if (typeof value === 'string') {
      // Для строковых значений: сохраняем существующий перевод или оставляем пустым
      const existingValue = existing[key]
      result[key] = typeof existingValue === 'string' && existingValue !== '' ? existingValue : ''
    }
  }

  return result
}

/**
 * Создать объект с пустыми значениями для переводов
 */
function createEmptyTranslations(source: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = createEmptyTranslations(value as Record<string, unknown>)
    } else if (typeof value === 'string') {
      result[key] = ''
    }
  }

  return result
}

/**
 * Рекурсивно собирает ключи из validation объекта
 */
function collectValidationKeys(obj: Record<string, unknown>, prefix: string): string[] {
  const keys: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = `${prefix}.${key}`
    if (typeof value === 'string') {
      keys.push(fullKey)
    } else if (typeof value === 'object' && value !== null) {
      keys.push(...collectValidationKeys(value as Record<string, unknown>, fullKey))
    }
  }

  return keys
}

/**
 * Собрать все ключи переводов для генерации типов
 */
function collectAllKeys(
  translations: I18nTranslations,
  validationTranslations: ValidationTranslations | null,
  prefix = ''
): string[] {
  const keys: string[] = []

  // Ключи моделей: Product.name.title, Product.name.placeholder, etc.
  for (const [modelName, fields] of Object.entries(translations.models)) {
    for (const [fieldName, props] of Object.entries(fields)) {
      for (const propName of Object.keys(props)) {
        keys.push(`${prefix}${modelName}.${fieldName}.${propName}`)
      }
    }
  }

  // Ключи enum'ов: RecipeType.SWEET.label, etc.
  for (const [enumName, values] of Object.entries(translations.enums)) {
    for (const [valueName, props] of Object.entries(values)) {
      for (const propName of Object.keys(props)) {
        keys.push(`${prefix}${enumName}.${valueName}.${propName}`)
      }
    }
  }

  // Ключи валидации: validation.too_small.string, validation.invalid_string.email, etc.
  if (validationTranslations) {
    keys.push(
      ...collectValidationKeys(validationTranslations as unknown as Record<string, unknown>, `${prefix}validation`)
    )
  }

  return keys.sort()
}

/**
 * Сгенерировать TypeScript файл с типами ключей
 */
function generateKeysTypeScript(keys: string[]): string {
  if (keys.length === 0) {
    return `// AUTO-GENERATED by @lena/zenstack-form-plugin
// DO NOT EDIT MANUALLY

/**
 * Все ключи переводов форм (пустой — нет переводов)
 */
export type FormI18nKey = never
`
  }

  const keyLiterals = keys.map((k) => `  | '${k}'`).join('\n')

  return `// AUTO-GENERATED by @lena/zenstack-form-plugin
// DO NOT EDIT MANUALLY

/**
 * Все ключи переводов форм
 *
 * Паттерн:
 * - {ModelName}.{fieldName}.{title|placeholder|description}
 * - {EnumName}.{VALUE}.{label}
 * - validation.{code} — ошибки валидации Zod
 * - validation.{code}.{origin} — ошибки с типом (string, number, array, date)
 */
export type FormI18nKey =
${keyLiterals}

/**
 * Количество ключей: ${keys.length}
 */
export const FORM_I18N_KEY_COUNT = ${keys.length}
`
}

/**
 * Записать файл, создав директории при необходимости
 */
async function writeFileWithDir(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content, 'utf-8')
}

/**
 * Главная функция генерации i18n файлов
 */
export async function generateI18nFiles(
  translations: I18nTranslations,
  config: I18nConfig,
  schemaDir: string
): Promise<void> {
  const outputDir = resolve(schemaDir, config.output)

  // Генерируем файлы для каждой локали
  for (const locale of config.locales) {
    const filePath = join(outputDir, `${locale}.json`)

    // Генерируем validation переводы для текущей локали
    const validationTranslations = generateValidationTranslations(locale)

    // Объединяем модели, enum'ы и validation в один объект для JSON
    const fullTranslations: Record<string, unknown> = {
      ...translations.models,
      ...translations.enums,
      validation: validationTranslations,
    }

    if (locale === config.defaultLocale) {
      // Для дефолтной локали — полная перезапись
      await writeFileWithDir(filePath, JSON.stringify(fullTranslations, null, 2) + '\n')
    } else {
      // Для остальных локалей — merge стратегия
      const existing = await readExistingTranslations(filePath)
      const merged = existing
        ? mergeTranslations(fullTranslations, existing as Record<string, unknown>)
        : createEmptyTranslations(fullTranslations)

      await writeFileWithDir(filePath, JSON.stringify(merged, null, 2) + '\n')
    }
  }

  // Генерируем TypeScript файл с типами ключей (используем русские переводы для ключей)
  const validationForKeys = generateValidationTranslations(config.defaultLocale)
  const allKeys = collectAllKeys(translations, validationForKeys)
  const keysCode = generateKeysTypeScript(allKeys)
  await writeFileWithDir(join(outputDir, 'keys.ts'), keysCode)

  // eslint-disable-next-line no-console
  console.log(
    `[zenstack-form-plugin] Generated i18n files: ${config.locales.length} locale(s), ${allKeys.length} key(s)`
  )
}

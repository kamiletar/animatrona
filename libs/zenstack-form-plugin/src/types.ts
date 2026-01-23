/**
 * Zod constraints, извлечённые из @form.props
 * Эти значения станут методами Zod схемы (.min(), .max(), etc.)
 */
export interface ZodConstraints {
  // Number constraints
  min?: number
  max?: number
  step?: number // → .multipleOf()
  positive?: boolean
  negative?: boolean
  // String constraints
  minLength?: number
  maxLength?: number
  pattern?: string // → .regex()
  email?: boolean
  url?: boolean
  uuid?: boolean
}

/**
 * Метаданные поля формы, извлечённые из @form.* директив
 */
export interface FormFieldMeta {
  /** Заголовок поля */
  title?: string
  /** Placeholder */
  placeholder?: string
  /** Описание/подсказка */
  description?: string
  /** Тип UI компонента */
  fieldType?: string
  /** Zod constraints (min, max, minLength, etc.) — станут методами схемы */
  constraints?: ZodConstraints
  /** UI props (остальные — передаются в fieldProps) */
  props?: Record<string, unknown>
  /** Конфигурация relation */
  relation?: { model?: string; labelField: string }
  /** Исключить поле из формы */
  exclude?: boolean
}

/**
 * Информация об enum значении с меткой
 */
export interface EnumValueInfo {
  /** Имя значения (SWEET, SALTY, etc.) */
  name: string
  /** Человекочитаемая метка */
  label: string
}

/**
 * Информация об enum
 */
export interface EnumInfo {
  /** Имя enum */
  name: string
  /** Значения с метками */
  values: EnumValueInfo[]
}

/**
 * Информация о поле модели
 */
export interface ModelFieldInfo {
  /** Имя поля */
  name: string
  /** Prisma тип */
  type: string
  /** Является ли обязательным */
  isRequired: boolean
  /** Является ли массивом */
  isList: boolean
  /** Является ли enum */
  isEnum: boolean
  /** Имя enum (если isEnum) */
  enumName?: string
  /** Значение по умолчанию */
  defaultValue?: unknown
  /** Метаданные формы */
  formMeta: FormFieldMeta
}

/**
 * Информация о модели
 */
export interface ModelInfo {
  /** Имя модели */
  name: string
  /** Поля модели */
  fields: ModelFieldInfo[]
  /** Исключённые поля */
  excludedFields: string[]
}

/**
 * Опции генерации
 */
export interface GeneratorOptions {
  /** Путь вывода */
  output: string
  /** Путь к схеме */
  schemaPath: string
}

/**
 * Конфигурация i18n
 */
export interface I18nConfig {
  /** Включен ли i18n режим */
  enabled: boolean
  /** Путь вывода файлов переводов (относительно schema.zmodel) */
  output: string
  /** Локаль по умолчанию (из неё берутся значения) */
  defaultLocale: string
  /** Список всех локалей */
  locales: string[]
}

/**
 * Собранные данные переводов для генерации
 */
export interface I18nTranslations {
  /** Переводы моделей: { ModelName: { fieldName: { title: '...', placeholder: '...' } } } */
  models: Record<string, Record<string, Record<string, string>>>
  /** Переводы enum'ов: { EnumName: { VALUE: { label: '...' } } } */
  enums: Record<string, Record<string, Record<string, string>>>
}

/**
 * Структура переводов для ошибок валидации Zod
 *
 * Ключи соответствуют Zod v4 issue codes.
 * Параметры интерполяции: {minimum}, {maximum}, {expected}, {received}, {options}, {keys}, {message}
 */
export interface ValidationTranslations {
  /** invalid_type — неверный тип данных */
  invalid_type: string
  /** required — обязательное поле */
  required: string
  /** too_small — значение меньше минимума */
  too_small: {
    string: string
    number: string
    array: string
    date: string
    set: string
    file: string
  }
  /** too_big — значение больше максимума */
  too_big: {
    string: string
    number: string
    array: string
    date: string
    set: string
    file: string
  }
  /** invalid_format — невалидный формат строки (Zod v4, ранее invalid_string) */
  invalid_format: {
    email: string
    url: string
    uuid: string
    cuid: string
    regex: string
    datetime: string
    date: string
    time: string
    ip: string
    base64: string
    json_string: string
    emoji: string
    jwt: string
    lowercase: string
    uppercase: string
  }
  /** not_multiple_of — число не кратно */
  not_multiple_of: string
  /** unrecognized_keys — неизвестные ключи */
  unrecognized_keys: string
  /** invalid_value — невалидное значение (Zod v4, объединяет invalid_enum_value + invalid_literal) */
  invalid_value: string
  /** invalid_union — невалидный union */
  invalid_union: string
  /** invalid_key — невалидный ключ */
  invalid_key: string
  /** invalid_element — невалидный элемент */
  invalid_element: string
  /** custom — кастомная ошибка */
  custom: string
}

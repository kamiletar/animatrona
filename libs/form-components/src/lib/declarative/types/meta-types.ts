'use client'

/**
 * Tooltip metadata for field hints
 * Displayed as a help icon (?) next to the label with popover on hover
 */
export interface FieldTooltipMeta {
  /** Заголовок подсказки */
  title?: string
  /** Основной текст подсказки (обязательный) */
  description: string
  /** Пример хорошего заполнения */
  example?: string
  /** Влияние на результат (например, "Больше категорий = больше учеников") */
  impact?: string
}

/**
 * Все доступные типы полей для указания в fieldType
 * Используется для явного указания типа поля в Zod .meta({ ui: { fieldType: '...' } })
 */
export type FieldComponentType =
  // Текстовые поля
  | 'string'
  | 'textarea'
  | 'password'
  | 'passwordStrength'
  | 'editable'
  | 'richText'
  // Числовые поля
  | 'number'
  | 'numberInput'
  | 'slider'
  | 'rating'
  | 'currency'
  | 'percentage'
  // Дата и время
  | 'date'
  | 'time'
  | 'dateRange'
  | 'dateTimePicker'
  | 'duration'
  | 'schedule'
  // Булевые поля
  | 'checkbox'
  | 'switch'
  // Выбор из списка
  | 'select'
  | 'nativeSelect'
  | 'combobox'
  | 'autocomplete'
  | 'listbox'
  | 'radioGroup'
  | 'radioCard'
  | 'segmentedGroup'
  | 'checkboxCard'
  | 'tags'
  // Специализированные поля
  | 'phone'
  | 'address'
  | 'pinInput'
  | 'otpInput'
  | 'colorPicker'
  | 'fileUpload'
  | 'maskedInput'

/**
 * Опция для select/enum полей с поддержкой i18n
 */
export interface FieldOptionMeta {
  /** Значение опции */
  value: string | number
  /** Отображаемый текст (fallback если нет перевода) */
  label: string
  /** Опция отключена */
  disabled?: boolean
  /** Ключ i18n для перевода label (например: 'Category.ELECTRONICS') */
  i18nKey?: string
}

/**
 * UI metadata from Zod schema .meta()
 */
export interface FieldUIMeta {
  title?: string
  description?: string
  placeholder?: string
  /** Tooltip для подсказки рядом с label */
  tooltip?: FieldTooltipMeta
  /**
   * Явное указание типа компонента поля
   * Имеет приоритет над автоопределением из Zod типа
   * @example fieldType: 'richText' для редактора вместо обычного string
   */
  fieldType?: FieldComponentType
  /**
   * Дополнительные props для специфичного типа поля
   * @example { countries: ['RU', 'US'] } для phone
   */
  fieldProps?: Record<string, unknown>
  /**
   * Опции для select/enum полей (генерируется из @form.* директив)
   * Поддерживает i18n через i18nKey в каждой опции
   */
  options?: FieldOptionMeta[]
  /**
   * Ключ i18n для перевода UI текстов
   * Генерируется плагином zenstack-form-plugin при i18n: true
   *
   * Формат: "ModelName.fieldName"
   * Полные ключи: "ModelName.fieldName.title", "ModelName.fieldName.placeholder", etc.
   *
   * @example i18nKey: 'Product.name' → переводы в Product.name.title, Product.name.placeholder
   */
  i18nKey?: string
}

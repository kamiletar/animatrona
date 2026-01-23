'use client'

import type { ReactNode } from 'react'
import type { FieldTooltipMeta } from './meta-types'

/**
 * Базовые пропсы для всех Field компонентов
 */
export interface BaseFieldProps {
  /** Имя поля (опционально для примитивных массивов) */
  name?: string
  /** Метка поля (может быть строкой или ReactNode для сложных меток со ссылками) */
  label?: ReactNode
  /** Текст-заполнитель */
  placeholder?: string
  /** Вспомогательный текст под полем (может быть строкой или ReactNode) */
  helperText?: ReactNode
  /** Обязательное ли поле */
  required?: boolean
  /** Отключено ли поле */
  disabled?: boolean
  /** Режим только для чтения */
  readOnly?: boolean
  /** Tooltip для подсказки рядом с label (переопределяет значение из schema) */
  tooltip?: FieldTooltipMeta
}

// ============================================================================
// Текстовые поля
// ============================================================================

/**
 * Пропсы для строкового поля
 */
export interface StringFieldProps extends BaseFieldProps {
  /** Тип input (text, email, password и т.д.). Автоматически из z.string().email()/url() */
  type?: 'text' | 'email' | 'password' | 'url' | 'tel'
  /** Максимальная длина. Автоматически из z.string().max() */
  maxLength?: number
  /** Минимальная длина. Автоматически из z.string().min() */
  minLength?: number
  /** HTML pattern для валидации. Автоматически из z.string().regex() */
  pattern?: string
  /** HTML атрибут autocomplete */
  autoComplete?: string
  /** HTML атрибут inputMode для мобильной клавиатуры. Автоматически из type. */
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
}

/**
 * Пропсы для многострочного поля
 */
export interface TextareaFieldProps extends BaseFieldProps {
  /** Количество видимых строк */
  rows?: number
  /** Включить авторазмер */
  autoresize?: boolean
  /** Поведение изменения размера */
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
  /** Максимальная длина */
  maxLength?: number
}

/**
 * Пропсы для поля пароля
 */
export interface PasswordFieldProps extends BaseFieldProps {
  /** Максимальная длина */
  maxLength?: number
  /** Видимость по умолчанию */
  defaultVisible?: boolean
  /** HTML атрибут autocomplete */
  autoComplete?: string
}

/**
 * Требование к сложности пароля
 */
export type PasswordRequirement = 'minLength:8' | 'uppercase' | 'lowercase' | 'number' | 'special'

/**
 * Пропсы для поля пароля с индикатором сложности
 */
export interface PasswordStrengthFieldProps extends BaseFieldProps {
  /** Требования к паролю */
  requirements?: PasswordRequirement[]
  /** Показывать чек-лист требований */
  showRequirements?: boolean
  /** Видимость по умолчанию */
  defaultVisible?: boolean
}

// ============================================================================
// Числовые поля
// ============================================================================

/**
 * Пропсы для числового поля (базовые)
 */
export interface NumberFieldProps extends BaseFieldProps {
  /** Минимальное значение */
  min?: number
  /** Максимальное значение */
  max?: number
  /** Шаг изменения */
  step?: number
}

/**
 * Опции Intl.NumberFormat для форматирования
 */
export interface NumberInputFormatOptions {
  /** Стиль форматирования */
  style?: 'decimal' | 'currency' | 'percent' | 'unit'
  /** Код валюты (например, 'RUB', 'USD', 'EUR') */
  currency?: string
  /** Стиль отображения валюты */
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name'
  /** Тип единицы измерения (например, 'inch', 'kilogram') */
  unit?: string
  /** Стиль отображения единицы измерения */
  unitDisplay?: 'short' | 'long' | 'narrow'
  /** Минимум дробных цифр */
  minimumFractionDigits?: number
  /** Максимум дробных цифр */
  maximumFractionDigits?: number
}

/**
 * Пропсы для NumberInput поля с расширенными опциями
 */
export interface NumberInputFieldProps extends NumberFieldProps {
  /** Опции Intl.NumberFormat для форматирования отображения */
  formatOptions?: NumberInputFormatOptions
  /** Разрешить изменение колёсиком мыши */
  allowMouseWheel?: boolean
  /** Ограничивать значение min/max при потере фокуса */
  clampValueOnBlur?: boolean
  /** Изменять значение при удержании кнопки */
  spinOnPress?: boolean
  /** Размер */
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

/**
 * Пропсы для поля валюты
 */
export interface CurrencyFieldProps extends BaseFieldProps {
  /** Код валюты (по умолчанию: 'RUB') */
  currency?: string
  /** Стиль отображения валюты (по умолчанию: 'symbol') */
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name'
  /** Количество десятичных знаков (по умолчанию: 2) */
  decimalScale?: number
  /** Минимальное значение */
  min?: number
  /** Максимальное значение */
  max?: number
  /** Шаг изменения (по умолчанию: 0.01) */
  step?: number
  /** Размер */
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

/**
 * Пропсы для поля процентов
 */
export interface PercentageFieldProps extends BaseFieldProps {
  /** Минимальное значение (по умолчанию: 0) */
  min?: number
  /** Максимальное значение (по умолчанию: 100) */
  max?: number
  /** Шаг изменения (по умолчанию: 1) */
  step?: number
  /** Количество десятичных знаков (по умолчанию: 0) */
  decimalScale?: number
  /** Размер */
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

// ============================================================================
// Поля даты и времени
// ============================================================================

/**
 * Пропсы для поля даты
 */
export interface DateFieldProps extends BaseFieldProps {
  /** Минимальная дата (формат YYYY-MM-DD) */
  min?: string
  /** Максимальная дата (формат YYYY-MM-DD) */
  max?: string
}

/**
 * Пропсы для поля времени
 */
export interface TimeFieldProps extends BaseFieldProps {
  /** Минимальное время (формат HH:MM) */
  min?: string
  /** Максимальное время (формат HH:MM) */
  max?: string
  /** Шаг в секундах */
  step?: number
}

/**
 * Пропсы для поля длительности
 */
export interface DurationFieldProps extends BaseFieldProps {
  /** Формат: 'HH:MM' или 'minutes' (по умолчанию: 'HH:MM') */
  format?: 'HH:MM' | 'minutes'
  /** Минимальная длительность в минутах */
  min?: number
  /** Максимальная длительность в минутах */
  max?: number
  /** Шаг в минутах (по умолчанию: 15) */
  step?: number
}

/**
 * Пропсы для поля выбора даты и времени
 */
export interface DateTimePickerFieldProps extends BaseFieldProps {
  /** Минимальные дата и время */
  minDateTime?: Date | string
  /** Максимальные дата и время */
  maxDateTime?: Date | string
  /** Шаг времени в минутах (по умолчанию: 15) */
  timeStep?: number
}

// ============================================================================
// Логические поля
// ============================================================================

/**
 * Пропсы для чекбокса
 */
export interface CheckboxFieldProps extends Omit<BaseFieldProps, 'placeholder'> {
  /** Цветовая палитра (по умолчанию: brand) */
  colorPalette?: string
  /** Размер чекбокса (sm, md, lg) */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Пропсы для переключателя
 */
export interface SwitchFieldProps extends Omit<BaseFieldProps, 'placeholder'> {
  /** Цветовая палитра (по умолчанию: brand) */
  colorPalette?: string
  /** Размер переключателя (xs, sm, md, lg) */
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

// ============================================================================
// Поля с маской / телефон
// ============================================================================

/**
 * Пропсы для поля с маской ввода
 */
export interface MaskedInputFieldProps extends BaseFieldProps {
  /** Шаблон маски (например, '99 99 999999' для паспорта) */
  mask?: string | string[]
  /** Символ-заполнитель для незаполненных позиций (по умолчанию: '_') */
  placeholderChar?: string
  /** Показывать маску при фокусе */
  showMaskOnFocus?: boolean
  /** Показывать маску при наведении */
  showMaskOnHover?: boolean
  /** Очищать неполный ввод при потере фокуса */
  clearIncomplete?: boolean
  /** Возвращать значение без маски (без символов маски) */
  autoUnmask?: boolean
}

/**
 * Коды стран для поля телефона
 */
export type PhoneCountry = 'RU' | 'US' | 'UK' | 'DE' | 'FR' | 'IT' | 'ES' | 'CN' | 'JP' | 'KR' | 'BY' | 'KZ' | 'UA'

/**
 * Пропсы для поля телефона
 */
export interface PhoneFieldProps extends BaseFieldProps {
  /** Код страны для формата телефона (по умолчанию: 'RU') */
  country?: PhoneCountry
  /** Показывать флаг страны эмодзи */
  showFlag?: boolean
  /** Возвращать значение без маски (без символов маски) */
  autoUnmask?: boolean
}

// ============================================================================
// Поля адреса
// ============================================================================

/**
 * Структура подсказки DaData
 */
export interface DaDataSuggestion {
  value: string
  unrestricted_value: string
  data: {
    postal_code?: string
    country?: string
    country_iso_code?: string
    region?: string
    region_type?: string
    city?: string
    city_type?: string
    street?: string
    street_type?: string
    house?: string
    house_type?: string
    flat?: string
    flat_type?: string
    geo_lat?: string
    geo_lon?: string
  }
}

/**
 * Структура значения адреса
 */
export interface AddressValue {
  /** Полная строка адреса */
  value: string
  /** Разобранные компоненты адреса */
  data?: DaDataSuggestion['data']
}

/**
 * Пропсы для поля адреса
 */
export interface AddressFieldProps extends BaseFieldProps {
  /** Токен API DaData */
  token: string
  /** Минимум символов перед поиском (по умолчанию: 3) */
  minChars?: number
  /** Задержка debounce в мс (по умолчанию: 300) */
  debounceMs?: number
  /** Ограничить конкретными локациями (например, регион, город) */
  locations?: Array<{ region?: string; city?: string }>
  /** Возвращать только строковое значение (по умолчанию: false возвращает AddressValue) */
  valueOnly?: boolean
}

// ============================================================================
// Поля OTP/PIN
// ============================================================================

/**
 * Пропсы для поля OTP
 */
export interface OTPInputFieldProps extends BaseFieldProps {
  /** Количество полей ввода (по умолчанию: 6) */
  length?: number
  /** Таймаут повторной отправки в секундах (по умолчанию: 60) */
  resendTimeout?: number
  /** Колбэк при нажатии "отправить повторно" */
  onResend?: () => void | Promise<void>
  /** Авто-отправка при заполнении */
  autoSubmit?: boolean
  /** Тип ввода: numeric, alphanumeric, alphabetic */
  type?: 'numeric' | 'alphanumeric' | 'alphabetic'
  /** Маскировать ввод */
  mask?: boolean
}

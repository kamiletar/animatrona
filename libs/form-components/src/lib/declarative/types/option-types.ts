'use client'

import type { ReactNode } from 'react'

/**
 * Базовая опция для selection компонентов
 *
 * Используется в: Select, RadioGroup, SegmentedGroup, NativeSelect
 *
 * @template T - Тип значения (по умолчанию string)
 */
export interface BaseOption<T = string> {
  /** Отображаемый текст опции */
  label: ReactNode
  /** Значение опции */
  value: T
  /** Опция отключена */
  disabled?: boolean
}

/**
 * Опция с поддержкой группировки
 *
 * Используется в: Listbox, Combobox
 *
 * @template T - Тип значения (по умолчанию string)
 */
export interface GroupableOption<T = string> extends BaseOption<T> {
  /** Ключ группы для группировки опций */
  group?: string
}

/**
 * Расширенная опция с описанием и иконкой
 *
 * Используется в: RadioCard, CheckboxCard
 *
 * @template T - Тип значения (по умолчанию string)
 */
export interface RichOption<T = string> extends BaseOption<T> {
  /** Описание опции */
  description?: ReactNode
  /** Иконка опции */
  icon?: ReactNode
}

// =============================================================================
// Type aliases для совместимости (deprecated, используй базовые типы)
// =============================================================================

/**
 * @deprecated Используй BaseOption
 */
export type SelectOption<T = string> = BaseOption<T>

/**
 * @deprecated Используй BaseOption
 */
export type RadioOption<T = string> = BaseOption<T>

/**
 * @deprecated Используй BaseOption
 */
export type SegmentedGroupOption<T = string> = BaseOption<T>

/**
 * @deprecated Используй GroupableOption
 */
export type ListboxOption<T = string> = GroupableOption<T>

/**
 * @deprecated Используй GroupableOption
 */
export type ComboboxOption<T = string> = GroupableOption<T>

/**
 * @deprecated Используй RichOption
 */
export type RadioCardOption<T = string> = RichOption<T>

/**
 * @deprecated Используй RichOption
 */
export type CheckboxCardOption<T = string> = RichOption<T>

/**
 * Опция для NativeSelect (использует title вместо label)
 *
 * @template T - Тип значения (по умолчанию string)
 */
export interface NativeSelectOption<T = string> {
  /** Отображаемый текст опции */
  title: ReactNode
  /** Значение опции */
  value: T
}

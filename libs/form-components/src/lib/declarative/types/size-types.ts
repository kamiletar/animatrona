'use client'

/**
 * Стандартный размер поля (xs, sm, md, lg)
 *
 * Используется в большинстве компонентов:
 * Select, Combobox, Autocomplete, RadioGroup, SegmentedGroup,
 * Rating, Tags, DateRange
 */
export type FieldSize = 'xs' | 'sm' | 'md' | 'lg'

/**
 * Размер поля без xs (sm, md, lg)
 *
 * Используется в компонентах, не поддерживающих xs:
 * RadioCard, CheckboxCard, Listbox, Slider
 */
export type FieldSizeWithoutXs = 'sm' | 'md' | 'lg'

/**
 * Расширенный размер поля (2xs до 2xl)
 *
 * Используется в компонентах с полным набором размеров:
 * PinInput, ColorPicker
 */
export type FieldSizeExtended = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

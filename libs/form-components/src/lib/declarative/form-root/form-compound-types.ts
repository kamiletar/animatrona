'use client'

import type { ReactElement, ReactNode } from 'react'
import type { OfflineIndicatorProps, SyncStatusProps } from '../../offline'
import type { AutoFieldsProps } from '../form-auto-fields'
import type {
  AutocompleteFieldProps,
  CheckboxCardFieldProps,
  ColorPickerFieldProps,
  ComboboxFieldProps,
  DateRangeFieldProps,
  EditableFieldProps,
  FileUploadFieldProps,
  ListboxFieldProps,
  NativeSelectFieldProps,
  PinInputFieldProps,
  RadioCardFieldProps,
  RadioGroupFieldProps,
  RatingFieldProps,
  RichTextFieldProps,
  ScheduleFieldProps,
  SegmentedGroupFieldProps,
  SelectFieldProps,
  SliderFieldProps,
  TagsFieldProps,
} from '../form-fields'
import type { FormFromSchemaProps } from '../form-from-schema'
import type {
  FormStepsCompletedContentProps,
  FormStepsIndicatorProps,
  FormStepsNavigationProps,
  FormStepsProps,
  FormStepsStepProps,
} from '../form-steps'
import type {
  CheckboxFieldProps,
  DateFieldProps,
  FormPropsWithApi,
  NumberFieldProps,
  NumberInputFieldProps,
  PasswordFieldProps,
  StringFieldProps,
  SubmitButtonProps,
  SwitchFieldProps,
  TextareaFieldProps,
  TimeFieldProps,
} from '../types'

/**
 * Типы компонентов для кнопок Form.Group.List
 * (Add, Remove, DragHandle)
 */
export interface ListButtonComponents {
  /** Добавить новый элемент в массив */
  Add: (props: { children?: ReactNode; defaultValue?: unknown }) => ReactElement
  /** Удалить текущий элемент из массива */
  Remove: (props: { children?: ReactNode }) => ReactElement
  /** Ручка для drag-and-drop сортировки */
  DragHandle: (props: { children?: ReactNode }) => ReactElement
}

/**
 * Compound component для работы с массивами (Form.Group.List)
 */
export interface FormGroupListComponent {
  (props: {
    name: string
    children: ReactNode
    emptyContent?: ReactNode
    wrapper?: (props: { children: ReactNode }) => ReactNode
  }): ReactElement
  Button: ListButtonComponents
}

/**
 * Compound component для группировки полей (Form.Group)
 */
export interface FormGroupComponent {
  (props: { name: string; children: ReactNode }): ReactElement
  List: FormGroupListComponent
}

/**
 * Типы всех Field компонентов (Form.Field.*)
 */
export interface FormFieldComponents {
  // Текстовые поля
  String: (props: StringFieldProps) => ReactElement
  Textarea: (props: TextareaFieldProps) => ReactElement
  Password: (props: PasswordFieldProps) => ReactElement
  PasswordStrength: (props: {
    name?: string
    label?: string
    requirements?: string[]
    showRequirements?: boolean
  }) => ReactElement
  Editable: (props: EditableFieldProps) => ReactElement
  RichText: (props: RichTextFieldProps) => ReactElement
  MaskedInput: (props: { name?: string; label?: string; mask: string; placeholder?: string }) => ReactElement

  // Числовые поля
  Number: (props: NumberFieldProps) => ReactElement
  NumberInput: (props: NumberInputFieldProps) => ReactElement
  Slider: (props: SliderFieldProps) => ReactElement
  Rating: (props: RatingFieldProps) => ReactElement
  Currency: (props: { name?: string; label?: string; currency?: string; decimalScale?: number }) => ReactElement
  Percentage: (props: { name?: string; label?: string; min?: number; max?: number }) => ReactElement

  // Дата и время
  Date: (props: DateFieldProps) => ReactElement
  Time: (props: TimeFieldProps) => ReactElement
  DateRange: (props: DateRangeFieldProps) => ReactElement
  DateTimePicker: (props: { name?: string; label?: string; minDateTime?: Date; maxDateTime?: Date }) => ReactElement
  Duration: (props: { name?: string; label?: string; format?: string; min?: number; max?: number }) => ReactElement
  Schedule: (props: ScheduleFieldProps) => ReactElement

  // Выбор из списка
  Select: (props: SelectFieldProps) => ReactElement
  NativeSelect: <T extends string = string>(props: NativeSelectFieldProps<T>) => ReactElement
  Combobox: <T extends string = string, TData = unknown>(props: ComboboxFieldProps<T, TData>) => ReactElement
  Listbox: <T extends string = string>(props: ListboxFieldProps<T>) => ReactElement
  RadioGroup: <T extends string = string>(props: RadioGroupFieldProps<T>) => ReactElement
  RadioCard: <T extends string = string>(props: RadioCardFieldProps<T>) => ReactElement
  SegmentedGroup: <T extends string = string>(props: SegmentedGroupFieldProps<T>) => ReactElement
  Autocomplete: <TData = unknown>(props: AutocompleteFieldProps<TData>) => ReactElement
  CascadingSelect: (props: {
    name?: string
    label?: string
    dependsOn: string
    loadOptions: (parentValue: unknown) => Promise<unknown[]>
  }) => ReactElement
  Tags: (props: TagsFieldProps) => ReactElement

  // Чекбоксы и переключатели
  Checkbox: (props: CheckboxFieldProps) => ReactElement
  CheckboxCard: <T extends string = string>(props: CheckboxCardFieldProps<T>) => ReactElement
  Switch: (props: SwitchFieldProps) => ReactElement

  // Специализированные
  ColorPicker: (props: ColorPickerFieldProps) => ReactElement
  PinInput: (props: PinInputFieldProps) => ReactElement
  OTPInput: (props: {
    name?: string
    label?: string
    length?: number
    resendTimeout?: number
    onResend?: () => void
    autoSubmit?: boolean
  }) => ReactElement
  FileUpload: (props: FileUploadFieldProps) => ReactElement
  Phone: (props: { name?: string; label?: string; country?: string; showFlag?: boolean }) => ReactElement
  Address: (props: { name?: string; label?: string; provider?: string; apiKey?: string }) => ReactElement
  Auto: (props: { name: string; label?: string }) => ReactElement
}

/**
 * Типы кнопок формы (Form.Button.*)
 */
export interface FormButtonComponents {
  /** Кнопка отправки формы */
  Submit: (props: SubmitButtonProps) => ReactElement
  /** Кнопка сброса формы к начальным значениям */
  Reset: (props: { children?: ReactNode; colorPalette?: string; variant?: string }) => ReactElement
}

/**
 * Compound component для шагов формы (Form.Steps)
 */
export interface FormStepsComponent {
  (props: FormStepsProps): ReactElement
  /** Отдельный шаг формы */
  Step: (props: FormStepsStepProps) => ReactElement
  /** Индикатор текущего шага */
  Indicator: (props: FormStepsIndicatorProps) => ReactElement
  /** Кнопки навигации между шагами */
  Navigation: (props: FormStepsNavigationProps) => ReactElement
  /** Контент после завершения всех шагов */
  CompletedContent: (props: FormStepsCompletedContentProps) => ReactElement
}

/**
 * Главный compound component Form со всеми подкомпонентами
 */
export interface FormComponent {
  /** Корневой компонент формы */
  <TData extends object>(props: FormPropsWithApi<TData>): ReactElement

  /** Группировка полей (namespace) */
  Group: FormGroupComponent

  /** Компоненты полей */
  Field: FormFieldComponents

  /** Кнопки формы */
  Button: FormButtonComponents

  /** Отображение всех ошибок формы */
  Errors: (props: { title?: ReactNode }) => ReactElement | null

  /** Защита от потери несохранённых данных */
  DirtyGuard: (props: { message?: string; enabled?: boolean; onBlock?: () => boolean | void }) => ReactElement | null

  /** Условный рендеринг на основе значения поля */
  When: <TValue = unknown>(props: {
    field: string
    is?: TValue
    isNot?: TValue
    in?: TValue[]
    notIn?: TValue[]
    condition?: (value: TValue) => boolean
    children: ReactNode
    fallback?: ReactNode
  }) => ReactNode

  /** Компоненты для мульти-шаговых форм */
  Steps: FormStepsComponent

  /** Индикатор оффлайн-режима */
  OfflineIndicator: (props: OfflineIndicatorProps) => ReactElement | null

  /** Статус синхронизации оффлайн-данных */
  SyncStatus: (props: SyncStatusProps) => ReactElement | null

  /** Генерация формы из JSON-конфига */
  Builder: (props: { config: unknown; children?: ReactNode }) => ReactElement

  /** Автоматическая генерация полей из Zod схемы */
  AutoFields: (props: AutoFieldsProps) => ReactElement

  /** Полностью автоматическая форма из Zod схемы */
  FromSchema: <TData extends object>(props: FormFromSchemaProps<TData>) => ReactElement
}

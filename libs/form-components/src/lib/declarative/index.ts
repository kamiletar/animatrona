'use client'

import { FormOfflineIndicator, FormSyncStatus } from '../offline'
import { DirtyGuard } from './dirty-guard'
import { FormAutoFields } from './form-auto-fields'
import { FormBuilder } from './form-builder'
import { ButtonReset, ButtonSubmit } from './form-buttons'
import { FormErrors } from './form-errors'
import {
  FieldAddress,
  FieldAuto,
  FieldAutocomplete,
  FieldCascadingSelect,
  FieldCheckbox,
  FieldCheckboxCard,
  FieldCity,
  FieldColorPicker,
  FieldCombobox,
  FieldCurrency,
  FieldDate,
  FieldDateRange,
  FieldDateTimePicker,
  FieldDuration,
  FieldEditable,
  FieldFileUpload,
  FieldListbox,
  FieldMaskedInput,
  FieldNativeSelect,
  FieldNumber,
  FieldNumberInput,
  FieldOTPInput,
  FieldPassword,
  FieldPasswordStrength,
  FieldPercentage,
  FieldPhone,
  FieldPinInput,
  FieldRadioCard,
  FieldRadioGroup,
  FieldRating,
  FieldRichText,
  FieldSchedule,
  FieldSegmentedGroup,
  FieldSelect,
  FieldSlider,
  FieldString,
  FieldSwitch,
  FieldTags,
  FieldTextarea,
  FieldTime,
} from './form-fields'
import { FormFromSchema } from './form-from-schema'
import { FormGroupDeclarative } from './form-group/form-group-declarative'
import { ListButtonAdd, ListButtonRemove } from './form-group/form-group-list-buttons'
import { FormGroupListDeclarative } from './form-group/form-group-list-declarative'
import { DragHandle } from './form-group/form-group-list-sortable'
import { Form as FormRoot } from './form-root'
import {
  FormSteps as FormStepsRoot,
  FormStepsCompletedContent,
  FormStepsIndicator,
  FormStepsNavigation,
  FormStepsStep,
} from './form-steps'
import { FormWhen } from './form-when'

// List buttons compound component
const ListButton = {
  Add: ListButtonAdd,
  Remove: ListButtonRemove,
  DragHandle: DragHandle,
}

// FormGroupList with Button subcomponent
const FormGroupList = Object.assign(FormGroupListDeclarative, {
  Button: ListButton,
})

// Build compound component
const FormGroup = Object.assign(FormGroupDeclarative, {
  List: FormGroupList,
})

const FormField = {
  // Auto field (DX improvement)
  Auto: FieldAuto,
  // Text fields
  String: FieldString,
  Textarea: FieldTextarea,
  Password: FieldPassword,
  PasswordStrength: FieldPasswordStrength,
  MaskedInput: FieldMaskedInput,
  Editable: FieldEditable,
  RichText: FieldRichText,
  // Number fields
  Number: FieldNumber,
  NumberInput: FieldNumberInput,
  Currency: FieldCurrency,
  Percentage: FieldPercentage,
  Slider: FieldSlider,
  Rating: FieldRating,
  // Date/Time fields
  Date: FieldDate,
  DateRange: FieldDateRange,
  DateTimePicker: FieldDateTimePicker,
  Time: FieldTime,
  Duration: FieldDuration,
  Schedule: FieldSchedule,
  // Boolean fields
  Checkbox: FieldCheckbox,
  CheckboxCard: FieldCheckboxCard,
  Switch: FieldSwitch,
  // Selection fields
  Select: FieldSelect,
  NativeSelect: FieldNativeSelect,
  CascadingSelect: FieldCascadingSelect,
  Combobox: FieldCombobox,
  Autocomplete: FieldAutocomplete,
  Listbox: FieldListbox,
  RadioGroup: FieldRadioGroup,
  RadioCard: FieldRadioCard,
  SegmentedGroup: FieldSegmentedGroup,
  Tags: FieldTags,
  // Specialized fields
  Phone: FieldPhone,
  Address: FieldAddress,
  City: FieldCity,
  PinInput: FieldPinInput,
  OTPInput: FieldOTPInput,
  ColorPicker: FieldColorPicker,
  FileUpload: FieldFileUpload,
}

const FormButton = {
  Submit: ButtonSubmit,
  Reset: ButtonReset,
}

// Form.Steps compound component
const FormSteps = Object.assign(FormStepsRoot, {
  Step: FormStepsStep,
  Indicator: FormStepsIndicator,
  Navigation: FormStepsNavigation,
  CompletedContent: FormStepsCompletedContent,
})

/**
 * Declarative Form compound component
 *
 * Provides a minimal-boilerplate API for building forms with automatic
 * field path resolution, array iteration, and Chakra UI integration.
 *
 * @example
 * ```tsx
 * <Form initialValue={{ title: '', portions: 1 }} onSubmit={handleSubmit}>
 *   <Form.Field.String name="title" label="Title" />
 *   <Form.Field.Number name="portions" label="Portions" />
 *   <Form.Button.Submit>Save</Form.Button.Submit>
 * </Form>
 * ```
 *
 * @example With nested groups and arrays
 * ```tsx
 * <Form initialValue={recipe} onSubmit={handleSubmit}>
 *   <Form.Group.List name="components">
 *     <Form.Field.String name="title" />
 *     <Form.Field.Number name="weightGrams" />
 *   </Form.Group.List>
 *   <Form.Group name="info">
 *     <Form.Group name="base">
 *       <Form.Field.Number name="rating" />
 *     </Form.Group>
 *   </Form.Group>
 *   <Form.Button.Submit />
 * </Form>
 * ```
 */
import type { FormComponent } from './form-root'

export const Form = Object.assign(FormRoot, {
  Group: FormGroup,
  Field: FormField,
  Button: FormButton,
  Errors: FormErrors,
  DirtyGuard: DirtyGuard,
  When: FormWhen,
  Steps: FormSteps,
  Builder: FormBuilder,
  // Schema-based generation
  AutoFields: FormAutoFields,
  FromSchema: FormFromSchema,
  // Offline support
  OfflineIndicator: FormOfflineIndicator,
  SyncStatus: FormSyncStatus,
}) as unknown as FormComponent

// Export types
export type {
  AddressFieldProps,
  AddressValue,
  BaseFieldProps,
  CheckboxFieldProps,
  CurrencyFieldProps,
  DaDataSuggestion,
  DateFieldProps,
  DateTimePickerFieldProps,
  DeclarativeFormContextValue,
  DurationFieldProps,
  FieldTooltipMeta,
  FieldUIMeta,
  FormApiConfig,
  FormApiResult,
  FormApiState,
  FormGroupDeclarativeProps,
  FormGroupListContextValue,
  FormGroupListDeclarativeProps,
  FormGroupListItemContextValue,
  FormGroupListWrapperProps,
  FormOfflineState,
  FormProps,
  FormPropsWithApi,
  MaskedInputFieldProps,
  NumberFieldProps,
  NumberInputFieldProps,
  NumberInputFormatOptions,
  OTPInputFieldProps,
  PasswordFieldProps,
  PasswordRequirement,
  PasswordStrengthFieldProps,
  PercentageFieldProps,
  PhoneCountry,
  PhoneFieldProps,
  StringFieldProps,
  SubmitButtonProps,
  SwitchFieldProps,
  TextareaFieldProps,
  TimeFieldProps,
  UseCreateHook,
  UseQueryHook,
  UseUpdateHook,
} from './types'

// Export context hooks
export { DeclarativeFormContext, useDeclarativeForm, useDeclarativeFormOptional } from './form-context'
export {
  FormGroupListContext,
  FormGroupListItemContext,
  useFormGroupListContext,
  useFormGroupListItemContext,
} from './form-group/form-group-list-context'

// Export individual components for extension
export { ButtonReset, ButtonSubmit, type ResetButtonProps } from './form-buttons'
export { FormErrors } from './form-errors'
export {
  type AutocompleteFieldProps,
  type AutoFieldConfig,
  type AutoFieldProps,
  camelCaseToLabel,
  type CascadingSelectFieldProps,
  type CascadingSelectLoadResult,
  type CheckboxCardFieldProps,
  type CheckboxCardOption,
  type CityFieldProps,
  type ColorPickerFieldProps,
  type ComboboxFieldProps,
  type ComboboxOption,
  type DateRangeFieldProps,
  type DateRangePreset,
  type DateRangeValue,
  type DayOfWeek,
  type DaySchedule,
  type EditableFieldProps,
  FieldAddress,
  FieldAuto,
  FieldAutocomplete,
  FieldCascadingSelect,
  FieldCheckbox,
  FieldCheckboxCard,
  FieldCity,
  FieldColorPicker,
  FieldCombobox,
  FieldCurrency,
  FieldDate,
  FieldDateRange,
  FieldDateTimePicker,
  FieldDuration,
  FieldEditable,
  FieldFileUpload,
  FieldListbox,
  FieldMaskedInput,
  FieldNativeSelect,
  FieldNumber,
  FieldNumberInput,
  FieldOTPInput,
  FieldPassword,
  FieldPasswordStrength,
  FieldPercentage,
  FieldPhone,
  FieldPinInput,
  FieldRadioCard,
  FieldRadioGroup,
  FieldRating,
  FieldRichText,
  FieldSchedule,
  FieldSegmentedGroup,
  FieldSelect,
  FieldSlider,
  FieldString,
  FieldSwitch,
  FieldTags,
  FieldTextarea,
  FieldTime,
  type FileUploadFieldProps,
  type ListboxFieldProps,
  type ListboxOption,
  type NativeSelectFieldProps,
  type NativeSelectOption,
  type PinInputFieldProps,
  type RadioCardFieldProps,
  type RadioCardOption,
  type RadioGroupFieldProps,
  type RadioOption,
  type RatingFieldProps,
  type RichTextFieldProps,
  type ScheduleFieldProps,
  type SegmentedGroupFieldProps,
  type SegmentedGroupOption,
  type SelectFieldProps,
  type SelectOption,
  type SliderFieldProps,
  type SliderMark,
  type TagsFieldProps,
  type TimeSlot,
  type ToolbarButton,
  useDeclarativeField,
  type WeeklySchedule,
} from './form-fields'
export { FormGroupDeclarative } from './form-group/form-group-declarative'
export { ListButtonAdd, ListButtonRemove } from './form-group/form-group-list-buttons'
export { FormGroupListDeclarative } from './form-group/form-group-list-declarative'
export {
  DragHandle,
  SortableItem,
  SortableWrapper,
  useSortableItemContext,
} from './form-group/form-group-list-sortable'

// Factory for app-specific forms
export { createForm, type ExtendedForm } from './create-form'

// Lazy component helpers (для ленивой загрузки компонентов форм)
export { createLazyComponent, createLazyComponents, type LazyComponentImport } from './lazy-component'

// API integration hook
export { useFormApi } from './use-form-api'

// Persistence hook and types
export { type FormPersistenceConfig, type FormPersistenceResult, useFormPersistence } from './form-persistence'

// DirtyGuard component
export { DirtyGuard, type DirtyGuardProps } from './dirty-guard'

// Conditional rendering
export { FormWhen, type FormWhenProps } from './form-when'

// Multi-step forms
export {
  FormSteps as FormStepsRoot,
  FormStepsCompletedContent,
  type FormStepsCompletedContentProps,
  FormStepsContext,
  type FormStepsContextValue,
  FormStepsIndicator,
  type FormStepsIndicatorProps,
  FormStepsNavigation,
  type FormStepsNavigationProps,
  type FormStepsProps,
  FormStepsStep,
  type FormStepsStepProps,
  type StepInfo,
  useFormStepsContext,
} from './form-steps'

// Field actions hook
export { type FieldActionsResult, useFieldActions } from './use-field-actions'

// Field UI components
export { FieldLabel, type FieldLabelProps } from './form-fields/base/field-label'
export { FieldTooltip, type FieldTooltipProps } from './form-fields/base/field-tooltip'

// Form Builder (JSON-based form generation)
export {
  type FieldConfig,
  FormBuilder,
  type FormBuilderConfig,
  type FormBuilderProps,
  type FormBuilderSection,
} from './form-builder'

// Schema constraints (auto-extraction from Zod)
export {
  getZodConstraints,
  type ZodArrayConstraints,
  type ZodConstraints,
  type ZodDateConstraints,
  type ZodNumberConstraints,
  type ZodStringConstraints,
} from './schema-constraints'

// Field constraints hook
export { useFieldConstraints, type UseFieldConstraintsResult } from './use-field-constraints'

// Constraint hints (auto-generated helperText)
export { generateConstraintHint } from './constraint-hints'

// Schema traversal (for form generation from Zod schema)
export { filterFields, getFieldPaths, type SchemaFieldInfo, traverseSchema } from './schema-traversal'

// Field type mapper (for mapping field types to components)
export {
  type FieldRenderProps,
  type RelationFieldConfig,
  renderFieldByType,
  renderSchemaField,
  resolveFieldType,
  SchemaFieldWithRelations,
} from './field-type-mapper'

// Auto-generated fields from schema
export { type AutoFieldsProps, FormAutoFields } from './form-auto-fields'

// Complete form from schema
export { FormFromSchema, type FormFromSchemaProps } from './form-from-schema'

// FieldComponentType for schema metadata
export type { FieldComponentType } from './types/meta-types'

// withUIMeta - enrich Zod schemas with UI metadata (ZenStack integration)
export { type DeepUIMetaConfig, type UIMetaConfig, withUIMeta, withUIMetaDeep } from './with-ui-meta'

// Common meta helpers (for use with withUIMeta)
export {
  booleanMeta,
  commonMeta,
  dateMeta,
  enumMeta,
  numberMeta,
  relationMeta,
  type SelectionFieldType,
  textMeta,
} from './common-meta'

// Relation field provider (auto-loading relation options)
export {
  type QueryHookResult,
  type RelationConfig,
  type RelationFieldContextValue,
  RelationFieldProvider,
  type RelationOption,
  type RelationState,
  useRelationFieldContext,
  useRelationOptions,
  withRelations,
} from './relation-field-provider'

// Async search hook (for Combobox, Autocomplete)
export {
  type AsyncQueryFn,
  type AsyncQueryResult,
  useAsyncSearch,
  type UseAsyncSearchOptions,
  type UseAsyncSearchResult,
  useDebounce,
} from './form-fields/base'

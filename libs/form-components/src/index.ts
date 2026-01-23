// Хук формы и контексты
export {
  fieldContext,
  formContext,
  useFieldContext,
  useFormContext,
  useTypedFormContext,
  useTypedFormSubscribe,
} from './lib/context'
export { useAppForm, withForm } from './lib/form-hook'

// Базовые компоненты форм (для именования/группировки)
export { FormField, useFormField, type FormFieldContextValue, type FormFieldProps } from './lib/form-field'
export { FormGroup, useFormGroup, type FormGroupContextValue, type FormGroupProps } from './lib/form-group'

// Компоненты с интеграцией TanStack Form
export {
  TanStackFormField,
  useTanStackFormField,
  type TanStackFormFieldContextValue,
  type TanStackFormFieldProps,
} from './lib/tanstack-form-field'

// Компоненты с интеграцией Chakra UI
export { ChakraFormField, type ChakraFormFieldProps } from './lib/chakra-form-field'

// Компоненты для массивов полей
export {
  FormGroupList,
  FormGroupListItem,
  useFormGroupList,
  useFormGroupListItem,
  type FormGroupListContextValue,
  type FormGroupListItemContextValue,
  type FormGroupListItemProps,
  type FormGroupListProps,
} from './lib/form-group-list'

// Типы
export type { BaseFieldProps, DeepKeys, DeepValue, FieldApi, FormApi } from './lib/types'

// Декларативное API форм
export {
  ButtonSubmit,
  DeclarativeFormContext,
  FieldCombobox,
  FieldListbox,
  FieldNumber,
  FieldSegmentedGroup,
  FieldSelect,
  FieldString,
  Form,
  FormGroupDeclarative,
  FormGroupListDeclarative,
  // Провайдер для полей связей
  RelationFieldProvider,
  booleanMeta,
  commonMeta,
  createForm,
  dateMeta,
  enumMeta,
  numberMeta,
  // Хелперы для метаданных
  relationMeta,
  textMeta,
  useDeclarativeField,
  useDeclarativeForm,
  useDeclarativeFormOptional,
  useRelationFieldContext,
  useRelationOptions,
  withRelations,
  // Обогащение схемы UI метаданными
  withUIMeta,
  withUIMetaDeep,
} from './lib/declarative'

export type {
  ComboboxFieldProps,
  ComboboxOption,
  DeclarativeFormContextValue,
  DeepUIMetaConfig,
  ExtendedForm,
  FieldTooltipMeta,
  FieldUIMeta,
  FormApiConfig,
  FormApiResult,
  FormApiState,
  FormGroupDeclarativeProps,
  FormGroupListDeclarativeProps,
  FormProps,
  FormPropsWithApi,
  ListboxFieldProps,
  ListboxOption,
  NumberFieldProps,
  // Типы провайдера связей
  QueryHookResult,
  RelationConfig,
  RelationFieldConfig,
  RelationFieldContextValue,
  RelationOption,
  RelationState,
  SegmentedGroupFieldProps,
  SegmentedGroupOption,
  SelectFieldProps,
  SelectOption,
  SelectionFieldType,
  StringFieldProps,
  SubmitButtonProps,
  UIMetaConfig,
  UseCreateHook,
  UseQueryHook,
  UseUpdateHook,
} from './lib/declarative'

export { useFieldActions, useFormApi, useFormStepsContext, type FieldActionsResult } from './lib/declarative'

// Хуки для async поиска (Combobox, Autocomplete)
export { useAsyncSearch, useDebounce } from './lib/declarative'
export type { AsyncQueryFn, AsyncQueryResult, UseAsyncSearchOptions, UseAsyncSearchResult } from './lib/declarative'

// UI компоненты полей
export { FieldLabel, FieldTooltip, type FieldLabelProps, type FieldTooltipProps } from './lib/declarative'

// Утилиты контекста
export {
  createNamedGroupContext,
  createSafeContext,
  type NamedGroupContextValue,
  type SafeContextResult,
} from './lib/contexts'

// Оффлайн поддержка
export { FormOfflineIndicator, FormSyncStatus, useOfflineForm, useOfflineStatus, useSyncQueue } from './lib/offline'

export type {
  FormOfflineConfig,
  OfflineIndicatorProps,
  OfflineSubmitResult,
  SyncAction,
  SyncActionType,
  SyncStatusProps,
  UseOfflineFormOptions,
  UseOfflineFormResult,
  UseSyncQueueResult,
} from './lib/offline'

// i18n поддержка
export { FormI18nProvider, getLocalizedValue, useFormI18n, useLocalizedOptions } from './lib/i18n'

export type { LocalizableOption, TranslateFunction, TranslateParams } from './lib/i18n'

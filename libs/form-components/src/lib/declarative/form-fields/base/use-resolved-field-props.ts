'use client'

import type { ReactNode } from 'react'
import { getLocalizedValue, useFormI18n, useLocalizedOptions } from '../../../i18n'
import { generateConstraintHint } from '../../constraint-hints'
import type { ZodConstraints } from '../../schema-constraints'
import type { BaseFieldProps, FieldOptionMeta, FieldTooltipMeta } from '../../types'
import { useDeclarativeField } from './base-field'

/**
 * Резолвит все props поля с учётом схемы и form-level настроек
 *
 * Приоритет:
 * 1. Props компонента (высший)
 * 2. Zod schema meta (ui: { title, placeholder, description, tooltip })
 * 3. Автоматически сгенерированная подсказка из constraints (если helperText не задан)
 * 4. Form-level настройки (disabled, readOnly)
 *
 * @example
 * ```tsx
 * function FieldString({ name, label, placeholder, helperText, required, disabled, readOnly, tooltip }: StringFieldProps) {
 *   const {
 *     form, fullPath,
 *     label: resolvedLabel,
 *     placeholder: resolvedPlaceholder,
 *     helperText: resolvedHelperText,
 *     required: resolvedRequired,
 *     disabled: resolvedDisabled,
 *     readOnly: resolvedReadOnly,
 *     tooltip: resolvedTooltip,
 *     constraints,
 *   } = useResolvedFieldProps(name, { label, placeholder, helperText, required, disabled, readOnly, tooltip })
 *   // ...
 * }
 * ```
 */
export function useResolvedFieldProps(
  name: string | undefined,
  props: BaseFieldProps
): {
  form: ReturnType<typeof useDeclarativeField>['form']
  fullPath: string
  label: ReactNode
  placeholder: string | undefined
  helperText: ReactNode
  tooltip: FieldTooltipMeta | undefined
  required: boolean | undefined
  disabled: boolean | undefined
  readOnly: boolean | undefined
  /** Автоматические constraints из Zod схемы (min, max, minLength, maxLength и т.д.) */
  constraints: ZodConstraints
  /** Опции для select полей (из meta.options с i18n переводами) */
  options: FieldOptionMeta[] | undefined
} {
  const {
    form,
    fullPath,
    meta,
    required: schemaRequired,
    formDisabled,
    formReadOnly,
    constraints,
  } = useDeclarativeField(name)

  // Получаем контекст i18n (может быть null)
  const i18n = useFormI18n()
  const i18nKey = meta?.i18nKey

  // Резолвим переведённые значения
  // Приоритет: props > i18n перевод > meta fallback
  const resolvedTitle = getLocalizedValue(i18n, i18nKey, 'title', meta?.title)
  const resolvedPlaceholder = getLocalizedValue(i18n, i18nKey, 'placeholder', meta?.placeholder)
  const resolvedDescription = getLocalizedValue(i18n, i18nKey, 'description', meta?.description)

  // Автоматическая подсказка из constraints (если helperText не задан явно)
  // Приоритет: props.helperText > i18n description > meta.description > auto-generated hint
  const autoHint = generateConstraintHint(constraints)
  const helperText = props.helperText ?? resolvedDescription ?? autoHint

  // Локализуем опции из meta (для select/enum полей)
  const localizedOptions = useLocalizedOptions(meta?.options)

  return {
    form,
    fullPath,
    // Props override i18n override schema meta
    label: props.label ?? resolvedTitle,
    placeholder: props.placeholder ?? resolvedPlaceholder,
    helperText,
    // Tooltip from props or schema meta
    tooltip: (props.tooltip ?? meta?.tooltip) as FieldTooltipMeta | undefined,
    // Required from schema or prop
    required: props.required ?? schemaRequired,
    // Form-level + local props (local wins)
    disabled: props.disabled ?? formDisabled,
    readOnly: props.readOnly ?? formReadOnly,
    // Constraints для дополнительной настройки компонентов
    constraints,
    // Options с i18n переводами
    options: localizedOptions,
  }
}

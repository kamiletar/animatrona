'use client'

import { Field, HStack } from '@chakra-ui/react'
import type { ReactElement, ReactNode } from 'react'
import type { FieldTooltipMeta } from '../../types'
import { FieldTooltip } from './field-tooltip'

/**
 * Props для SelectionFieldLabel
 */
export interface SelectionFieldLabelProps {
  /** Текст label */
  label: ReactNode
  /** Данные для tooltip подсказки */
  tooltip?: FieldTooltipMeta
  /** Показывать индикатор обязательного поля */
  required?: boolean
}

/**
 * Унифицированный label для selection полей (Select, Combobox, Listbox, Autocomplete).
 * Избегает дублирования паттерна HStack + FieldTooltip в 12+ файлах.
 *
 * @example
 * ```tsx
 * <Select.Label>
 *   <SelectionFieldLabel
 *     label={resolved.label}
 *     tooltip={resolved.tooltip}
 *     required={resolved.required}
 *   />
 * </Select.Label>
 * ```
 */
export function SelectionFieldLabel({ label, tooltip, required }: SelectionFieldLabelProps): ReactElement {
  return (
    <>
      {tooltip ? (
        <HStack gap={1}>
          <span>{label}</span>
          <FieldTooltip {...tooltip} />
        </HStack>
      ) : (
        label
      )}
      {required && <Field.RequiredIndicator />}
    </>
  )
}

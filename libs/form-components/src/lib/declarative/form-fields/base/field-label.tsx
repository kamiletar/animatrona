'use client'

import { Field, HStack } from '@chakra-ui/react'
import type { ReactElement, ReactNode } from 'react'
import type { FieldTooltipMeta } from '../../types'
import { FieldTooltip } from './field-tooltip'

export interface FieldLabelProps {
  /** Текст label (может быть ReactNode для сложных labels с ссылками) */
  label?: ReactNode
  /** Tooltip для подсказки рядом с label */
  tooltip?: FieldTooltipMeta
  /** Показать индикатор обязательного поля */
  required?: boolean
}

/**
 * Компонент label для полей формы с поддержкой tooltip.
 *
 * Если tooltip передан, рендерит HStack с label и иконкой подсказки.
 * Иначе рендерит простой Field.Label.
 *
 * @example
 * ```tsx
 * // Простой label
 * <FieldLabel label="Название" required />
 *
 * // Label с tooltip
 * <FieldLabel
 *   label="Марка автомобиля"
 *   tooltip={{ description: 'Укажите марку', example: 'Hyundai' }}
 *   required
 * />
 * ```
 */
export function FieldLabel({ label, tooltip, required }: FieldLabelProps): ReactElement | null {
  if (!label) {
    return null
  }

  return (
    <Field.Label>
      {tooltip ? (
        <HStack gap={1}>
          <span>{label}</span>
          <FieldTooltip {...tooltip} />
        </HStack>
      ) : (
        label
      )}
      {required && <Field.RequiredIndicator />}
    </Field.Label>
  )
}

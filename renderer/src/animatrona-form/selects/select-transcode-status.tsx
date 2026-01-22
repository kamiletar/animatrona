'use client'

import type { TranscodeStatus } from '@/generated/prisma'
import { FieldSelect, type SelectOption } from '@lena/form-components'
import type { ReactElement } from 'react'
import { transcodeStatusLabels } from '../labels'

interface Props {
  name?: string
  label?: string
  placeholder?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  /** Показать опцию "Все статусы" */
  showAll?: boolean
}

const allStatuses: TranscodeStatus[] = ['QUEUED', 'PROCESSING', 'COMPLETED', 'SKIPPED', 'ERROR']

/**
 * Select для статуса транскодирования
 */
export function SelectTranscodeStatus({ name, showAll, ...props }: Props): ReactElement {
  const options: SelectOption<TranscodeStatus | ''>[] = [
    ...(showAll ? [{ label: 'Все статусы', value: '' as TranscodeStatus }] : []),
    ...allStatuses.map((value) => ({
      label: transcodeStatusLabels[value],
      value,
    })),
  ]

  return <FieldSelect name={name} options={options} {...props} />
}

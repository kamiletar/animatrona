'use client'

import type { VideoKind } from '@/generated/prisma'
import { FieldSelect, type SelectOption } from '@lena/form-components'
import type { ReactElement } from 'react'
import { videoKindLabels } from '../labels'

interface Props {
  name?: string
  label?: string
  placeholder?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  /** Показать опцию "Все типы" */
  showAll?: boolean
}

const allKinds: VideoKind[] = ['OP', 'ED', 'PV', 'CM', 'CLIP', 'EPISODE_PREVIEW', 'OTHER']

/**
 * Select для типа видео (OP/ED/трейлер/клип)
 */
export function SelectVideoKind({ name, showAll, ...props }: Props): ReactElement {
  const options: SelectOption<VideoKind | ''>[] = [
    ...(showAll ? [{ label: 'Все типы', value: '' as VideoKind }] : []),
    ...allKinds.map((value) => ({
      label: videoKindLabels[value],
      value,
    })),
  ]

  return <FieldSelect name={name} options={options} {...props} />
}

'use client'

import type { ChapterType } from '@/generated/prisma'
import { FieldSelect, type SelectOption } from '@lena/form-components'
import type { ReactElement } from 'react'
import { chapterTypeLabels } from '../labels'

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

const allTypes: ChapterType[] = ['CHAPTER', 'OP', 'ED', 'RECAP', 'PREVIEW']

/**
 * Select для типа главы
 */
export function SelectChapterType({ name, showAll, ...props }: Props): ReactElement {
  const options: SelectOption<ChapterType | ''>[] = [
    ...(showAll ? [{ label: 'Все типы', value: '' as ChapterType }] : []),
    ...allTypes.map((value) => ({
      label: chapterTypeLabels[value],
      value,
    })),
  ]

  return <FieldSelect name={name} options={options} {...props} />
}

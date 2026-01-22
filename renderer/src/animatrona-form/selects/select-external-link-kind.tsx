'use client'

import type { ExternalLinkKind } from '@/generated/prisma'
import { FieldSelect, type SelectOption } from '@lena/form-components'
import type { ReactElement } from 'react'
import { externalLinkKindLabels } from '../labels'

interface Props {
  name?: string
  label?: string
  placeholder?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  /** Показать опцию "Все сервисы" */
  showAll?: boolean
}

const allKinds: ExternalLinkKind[] = [
  'MYANIMELIST',
  'ANIDB',
  'ANILIST',
  'WIKIPEDIA',
  'OFFICIAL_SITE',
  'TWITTER',
  'WORLDART',
  'KINOPOISK',
  'ANIME_NEWS_NETWORK',
  'OTHER',
]

/**
 * Select для типа внешней ссылки (MAL, AniDB, Wikipedia и т.д.)
 */
export function SelectExternalLinkKind({ name, showAll, ...props }: Props): ReactElement {
  const options: SelectOption<ExternalLinkKind | ''>[] = [
    ...(showAll ? [{ label: 'Все сервисы', value: '' as ExternalLinkKind }] : []),
    ...allKinds.map((value) => ({
      label: externalLinkKindLabels[value],
      value,
    })),
  ]

  return <FieldSelect name={name} options={options} {...props} />
}

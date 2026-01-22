'use client'

import type { PersonRole } from '@/generated/prisma'
import { FieldSelect, type SelectOption } from '@lena/form-components'
import type { ReactElement } from 'react'
import { personRoleLabels } from '../labels'

interface Props {
  name?: string
  label?: string
  placeholder?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  /** Показать опцию "Все роли" */
  showAll?: boolean
}

const allRoles: PersonRole[] = [
  'DIRECTOR',
  'WRITER',
  'ORIGINAL_CREATOR',
  'CHARACTER_DESIGN',
  'MUSIC',
  'PRODUCER',
  'ANIMATION_DIRECTOR',
  'KEY_ANIMATOR',
  'ART_DIRECTOR',
  'SOUND_DIRECTOR',
  'OTHER',
]

/**
 * Select для роли персоны (режиссёр, сценарист, аниматор и т.д.)
 */
export function SelectPersonRole({ name, showAll, ...props }: Props): ReactElement {
  const options: SelectOption<PersonRole | ''>[] = [
    ...(showAll ? [{ label: 'Все роли', value: '' as PersonRole }] : []),
    ...allRoles.map((value) => ({
      label: personRoleLabels[value],
      value,
    })),
  ]

  return <FieldSelect name={name} options={options} {...props} />
}

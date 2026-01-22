'use client'

import { FieldSegmentedGroup, type SegmentedGroupOption } from '@lena/form-components'
import type { ReactElement } from 'react'
import { presetLabels } from '../labels'

interface Props {
  name?: string
  label?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
}

/** Все доступные пресеты NVENC */
const allPresets = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] as const
export type Preset = (typeof allPresets)[number]

/**
 * Segmented control для выбора пресета кодирования NVENC
 *
 * p1 = Максимальное качество (медленно)
 * p7 = Максимальная скорость (быстро)
 */
export function SegmentedPreset({ name, ...props }: Props): ReactElement {
  const options: SegmentedGroupOption<string>[] = allPresets.map((value) => ({
    label: presetLabels[value] ?? value.toUpperCase(),
    value,
  }))

  return <FieldSegmentedGroup name={name} options={options} colorPalette="purple" {...props} />
}

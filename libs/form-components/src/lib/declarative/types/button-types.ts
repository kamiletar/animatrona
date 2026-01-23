'use client'

import type { ReactNode } from 'react'

/**
 * Props for submit button
 */
export interface SubmitButtonProps {
  /** Button text (default: "Submit") */
  children?: ReactNode
  /** Whether button is disabled */
  disabled?: boolean
  /** Color palette (e.g. 'brand', 'blue', 'red') */
  colorPalette?: string
  /** Button size */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Button variant */
  variant?: 'solid' | 'outline' | 'ghost' | 'subtle'
  /** Full width button */
  width?: string | number | Record<string, string | number>
}

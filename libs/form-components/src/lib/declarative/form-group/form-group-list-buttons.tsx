'use client'

import { Button, IconButton } from '@chakra-ui/react'
import type { ReactElement, ReactNode } from 'react'
import { useFormGroupListContext, useFormGroupListItemContext } from './form-group-list-context'

export interface ListButtonAddProps {
  /** Button text (default: "+") */
  children?: ReactNode
  /** Default value for new item (default: empty object or empty string) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValue?: any
  /** Принудительно отключить кнопку (дополнительно к автоматическому maxItems) */
  disabled?: boolean
}

/**
 * Form.Group.List.Button.Add - Add new item to array
 *
 * Must be used inside Form.Group.List (typically in wrapper)
 *
 * Автоматически отключается при достижении maxItems из Zod схемы
 * (z.array().max(5) → кнопка отключится при 5 элементах)
 *
 * @example
 * ```tsx
 * <Form.Group.List
 *   name="items"
 *   wrapper={({ children }) => (
 *     <VStack>
 *       {children}
 *       <Form.Group.List.Button.Add defaultValue={{ title: '' }}>
 *         Add Item
 *       </Form.Group.List.Button.Add>
 *     </VStack>
 *   )}
 * >
 *   ...
 * </Form.Group.List>
 * ```
 */
export function ListButtonAdd({ children, defaultValue = {}, disabled }: ListButtonAddProps): ReactElement {
  const { pushValue, canAdd } = useFormGroupListContext()

  // Кнопка отключена если canAdd = false (достигнут maxItems) или disabled prop
  const isDisabled = disabled || !canAdd

  const handleAdd = () => {
    if (!isDisabled) {
      pushValue(defaultValue)
    }
  }

  if (children) {
    return (
      <Button type="button" onClick={handleAdd} variant="outline" size="sm" disabled={isDisabled}>
        {children}
      </Button>
    )
  }

  return (
    <IconButton
      type="button"
      onClick={handleAdd}
      variant="outline"
      size="sm"
      aria-label="Add item"
      disabled={isDisabled}
    >
      +
    </IconButton>
  )
}

export interface ListButtonRemoveProps {
  /** Button text (default: "x") */
  children?: ReactNode
  /** Принудительно отключить кнопку (дополнительно к автоматическому minItems) */
  disabled?: boolean
}

/**
 * Form.Group.List.Button.Remove - Remove current item from array
 *
 * Must be used inside Form.Group.List item (children)
 *
 * Автоматически отключается при достижении minItems из Zod схемы
 * (z.array().min(1) → кнопка отключится при 1 элементе)
 *
 * @example
 * ```tsx
 * <Form.Group.List name="items">
 *   <HStack>
 *     <Form.Field.String name="title" />
 *     <Form.Group.List.Button.Remove />
 *   </HStack>
 * </Form.Group.List>
 * ```
 */
export function ListButtonRemove({ children, disabled }: ListButtonRemoveProps): ReactElement {
  const { remove } = useFormGroupListItemContext()
  const { canRemove } = useFormGroupListContext()

  // Кнопка отключена если canRemove = false (достигнут minItems) или disabled prop
  const isDisabled = disabled || !canRemove

  const handleRemove = () => {
    if (!isDisabled) {
      remove()
    }
  }

  if (children) {
    return (
      <Button type="button" onClick={handleRemove} variant="outline" size="sm" colorPalette="red" disabled={isDisabled}>
        {children}
      </Button>
    )
  }

  return (
    <IconButton
      type="button"
      onClick={handleRemove}
      variant="outline"
      size="sm"
      colorPalette="red"
      aria-label="Remove item"
      disabled={isDisabled}
    >
      x
    </IconButton>
  )
}

'use client'

import { Fragment, type ReactElement, type ReactNode } from 'react'
import { FormGroup, useFormGroup } from '../../form-group'
import { DeclarativeFormContext, useDeclarativeForm } from '../form-context'
import { getZodConstraints } from '../schema-constraints'
import type {
  DeclarativeFormContextValue,
  FormGroupListContextValue,
  FormGroupListDeclarativeProps,
  FormGroupListItemContextValue,
} from '../types'
import { FormGroupListContext, FormGroupListItemContext } from './form-group-list-context'
import { SortableItem, SortableWrapper } from './form-group-list-sortable'

/**
 * Form.Group.List - Automatically iterates over array fields
 *
 * For object arrays: children are cloned for each element with FormGroup index
 * For primitive arrays: children without name get direct array index access
 *
 * Автоматически извлекает из Zod схемы:
 * - `maxItems` из `z.array().max(5)` → отключает кнопку Add при достижении лимита
 * - `minItems` из `z.array().min(1)` → отключает кнопку Remove если элементов меньше
 * - `helperText` подсказка "Максимум 5 элементов" (через Form.Group.List wrapper)
 *
 * Props всегда имеют приоритет над автоматическими значениями из схемы.
 *
 * @example Object array with auto constraints from Zod
 * ```tsx
 * // В схеме: z.object({ tags: z.array(z.string()).min(1).max(5) })
 * <Form.Group.List
 *   name="tags"
 *   wrapper={({ children }) => (
 *     <VStack>
 *       {children}
 *       <Form.Group.List.Button.Add />
 *       {/* Кнопка Add автоматически отключается при 5 элементах *\/}
 *     </VStack>
 *   )}
 * >
 *   <HStack>
 *     <Form.Field.String />
 *     <Form.Group.List.Button.Remove />
 *     {/* Кнопка Remove автоматически отключается при 1 элементе *\/}
 *   </HStack>
 * </Form.Group.List>
 * ```
 */
export function FormGroupListDeclarative({
  name,
  children,
  emptyContent,
  wrapper,
  sortable = false,
  maxItems: maxItemsProp,
  minItems: minItemsProp,
}: FormGroupListDeclarativeProps): ReactElement {
  const { form, schema } = useDeclarativeForm()
  const parentGroup = useFormGroup()

  // Build full path from parent groups
  const fullPath = parentGroup ? `${parentGroup.name}.${name}` : name

  // Извлекаем constraints для массива
  const constraints = getZodConstraints(schema, fullPath)

  // Props имеют приоритет над constraints
  const maxItems = maxItemsProp ?? constraints.array?.maxItems
  const minItems = minItemsProp ?? constraints.array?.minItems

  // Use form.Field with mode="array" for reactive array state
  return (
    <form.Field name={fullPath} mode="array">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(arrayField: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arrayValue = (arrayField.state.value as any[] | undefined) ?? []

        // Вычисляем canAdd и canRemove на основе constraints
        const canAdd = maxItems === undefined || arrayValue.length < maxItems
        const canRemove = minItems === undefined || arrayValue.length > minItems

        // List context for Add button - use arrayField methods
        const listContextValue: FormGroupListContextValue = {
          fullPath,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pushValue: (value: any) => arrayField.pushValue(value),
          length: arrayValue.length,
          maxItems,
          minItems,
          canAdd,
          canRemove,
        }

        // Handle drag end for sortable
        const handleReorder = (oldIndex: number, newIndex: number) => {
          arrayField.moveValue(oldIndex, newIndex)
        }

        // Generate IDs for sortable items
        const sortableIds = arrayValue.map((_, index) => `${fullPath}-${index}`)

        // Render single item
        const renderItem = (index: number): ReactNode => {
          // Form context with primitiveArrayIndex
          const formContextValue: DeclarativeFormContextValue = {
            form,
            schema,
            primitiveArrayIndex: index,
          }

          // Item context for Remove button - use arrayField.removeValue
          const itemContextValue: FormGroupListItemContextValue = {
            index,
            remove: () => arrayField.removeValue(index),
          }

          const itemContent = (
            <DeclarativeFormContext.Provider value={formContextValue}>
              <FormGroupListItemContext.Provider value={itemContextValue}>
                <FormGroup name={String(index)}>{children}</FormGroup>
              </FormGroupListItemContext.Provider>
            </DeclarativeFormContext.Provider>
          )

          // Wrap in SortableItem if sortable
          if (sortable) {
            return (
              <SortableItem key={sortableIds[index]} id={sortableIds[index]}>
                {itemContent}
              </SortableItem>
            )
          }

          return <Fragment key={index}>{itemContent}</Fragment>
        }

        // Render all items
        const renderItems = (): ReactNode => {
          if (arrayValue.length === 0 && emptyContent) {
            return emptyContent
          }

          const items = arrayValue.map((_, index) => renderItem(index))

          // Wrap in SortableWrapper if sortable
          if (sortable) {
            return (
              <SortableWrapper items={sortableIds} onReorder={handleReorder}>
                {items}
              </SortableWrapper>
            )
          }

          return items
        }

        // Wrap everything in FormGroup for path building
        const content = wrapper ? wrapper({ children: renderItems() }) : renderItems()

        return (
          <FormGroupListContext.Provider value={listContextValue}>
            <FormGroup name={name}>
              {/* Fragment needed when wrapper returns array */}
              <Fragment>{content}</Fragment>
            </FormGroup>
          </FormGroupListContext.Provider>
        )
      }}
    </form.Field>
  )
}

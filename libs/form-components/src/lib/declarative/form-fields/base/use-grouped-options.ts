'use client'

import { createListCollection } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import type { GroupableOption } from '../../types'

/**
 * Результат хука useGroupedOptions
 */
export interface GroupedOptionsResult<T = string> {
  /** Коллекция для Chakra компонентов (Select, Combobox, Listbox) */
  collection: ReturnType<typeof createListCollection<GroupableOption<T>>>
  /** Map групп с опциями (null если группировки нет) */
  groups: Map<string, GroupableOption<T>[]> | null
}

/**
 * Функция получения label из опции
 * Используется для itemToString в коллекции и рендеринга текста
 *
 * @example
 * ```tsx
 * // В itemToString коллекции
 * createListCollection({ items, itemToString: getOptionLabel })
 *
 * // В рендеринге
 * <Select.ItemText>{getOptionLabel(option)}</Select.ItemText>
 * ```
 */
export function getOptionLabel<T>(item: { label?: string | ReactNode; value: T }): string {
  return typeof item.label === 'string' ? item.label : String(item.value)
}

/**
 * Хук для создания коллекции с опциональной группировкой
 *
 * Инкапсулирует общую логику:
 * - Создание Chakra ListCollection из опций
 * - Определение наличия групп
 * - Группировка опций в Map для рендеринга
 *
 * @example Использование в Listbox
 * ```tsx
 * const { collection, groups } = useGroupedOptions(options)
 *
 * return (
 *   <Listbox.Root collection={collection}>
 *     {groups
 *       ? Array.from(groups.entries()).map(([name, opts]) => (
 *           <Listbox.ItemGroup key={name}>
 *             <Listbox.ItemGroupLabel>{name}</Listbox.ItemGroupLabel>
 *             {opts.map(opt => <Listbox.Item key={opt.value} item={opt} />)}
 *           </Listbox.ItemGroup>
 *         ))
 *       : options.map(opt => <Listbox.Item key={opt.value} item={opt} />)
 *     }
 *   </Listbox.Root>
 * )
 * ```
 */
export function useGroupedOptions<T = string>(options: GroupableOption<T>[]): GroupedOptionsResult<T> {
  // Создаём коллекцию с опциональной группировкой
  const collection = useMemo(() => {
    const hasGroups = options.some((opt) => opt.group)

    return createListCollection({
      items: options,
      itemToString: getOptionLabel,
      itemToValue: (item) => item.value as string,
      isItemDisabled: (item: GroupableOption<T>) => item.disabled ?? false,
      ...(hasGroups && {
        groupBy: (item: GroupableOption<T>) => item.group ?? '',
      }),
    })
  }, [options])

  // Проверяем наличие групп и создаём Map
  const groups = useMemo(() => {
    const hasGroups = options.some((opt) => opt.group)
    if (!hasGroups) {
      return null
    }

    const groupMap = new Map<string, GroupableOption<T>[]>()
    for (const opt of options) {
      const group = opt.group ?? ''
      const existing = groupMap.get(group) ?? []
      groupMap.set(group, [...existing, opt])
    }
    return groupMap
  }, [options])

  return { collection, groups }
}

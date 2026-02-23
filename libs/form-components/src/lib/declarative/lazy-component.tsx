'use client'

import { Skeleton } from '@chakra-ui/react'
import type { ComponentType } from 'react'
import { lazy, Suspense } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>

type LazyImportFn<T> = () => Promise<{ default: T } | T>

/**
 * Создаёт ленивый компонент с встроенным Suspense и Skeleton fallback
 *
 * Поддерживает как default export, так и named export (объект модуля)
 *
 * @example
 * ```tsx
 * const LazySelect = createLazyComponent(
 *   () => import('./select-type').then(m => m.SelectType),
 *   '40px'
 * )
 *
 * // Использование
 * <LazySelect name="type" label="Тип" />
 * ```
 */
export function createLazyComponent<T extends AnyComponent>(
  importFn: LazyImportFn<T>,
  fallbackHeight = '40px'
): ComponentType<React.ComponentProps<T>> {
  const LazyComponent = lazy(async () => {
    const module = await importFn()
    // Поддержка default и named exports
    if (module && typeof module === 'object' && 'default' in module) {
      return module as { default: T }
    }
    // Если вернули сам компонент (named export)
    return { default: module as T }
  })

  // Wrapper с Suspense
  function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={<Skeleton height={fallbackHeight} borderRadius="md" />}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }

  LazyWrapper.displayName = `Lazy(${importFn.name || 'Component'})`

  return LazyWrapper
}

/**
 * Преобразует объект с функциями динамического импорта в объект с lazy компонентами
 *
 * @example
 * ```tsx
 * const lazySelects = createLazyComponents({
 *   Type: () => import('./select-type').then(m => m.SelectType),
 *   Status: () => import('./select-status').then(m => m.SelectStatus),
 * })
 *
 * // Результат:
 * lazySelects.Type // LazyWrapper с встроенным Suspense
 * lazySelects.Status // LazyWrapper с встроенным Suspense
 * ```
 */
export function createLazyComponents<T extends Record<string, LazyImportFn<AnyComponent>>>(
  imports: T,
  fallbackHeight = '40px'
): { [K in keyof T]: AnyComponent } {
  return Object.entries(imports).reduce(
    (acc, [name, importFn]) => ({
      ...acc,
      [name]: createLazyComponent(importFn, fallbackHeight),
    }),
    {} as { [K in keyof T]: AnyComponent }
  )
}

/** Тип для функции ленивого импорта */
export type LazyComponentImport<T extends AnyComponent = AnyComponent> = LazyImportFn<T>

'use client'

import { createFormHook, type FieldApi, type FormApi } from '@tanstack/react-form'
import { fieldContext, formContext } from './context'

/**
 * Базовые компоненты полей для форм
 * Могут быть расширены в отдельных приложениях
 */
const fieldComponents = {}

/**
 * Базовые компоненты форм
 * Могут быть расширены в отдельных приложениях
 */
const formComponents = {}

/**
 * Создаёт хук формы для конкретного приложения
 *
 * useAppForm предоставляет преднастроенный хук формы с:
 * - Уже настроенными контекстами поля и формы
 * - Доступом к form.AppField и form.AppForm для кастомных компонентов
 *
 * @example
 * ```tsx
 * import { useAppForm } from '@lena/form-components'
 *
 * function MyForm() {
 *   const form = useAppForm({
 *     defaultValues: {
 *       email: '',
 *       name: '',
 *     },
 *     onSubmit: async ({ value }) => {
 *       await submitToServer(value)
 *     },
 *   })
 *
 *   return (
 *     <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
 *       <form.Field
 *         name="email"
 *         children={(field) => (
 *           <input
 *             value={field.state.value}
 *             onChange={(e) => field.handleChange(e.target.value)}
 *           />
 *         )}
 *       />
 *       <button type="submit">Submit</button>
 *     </form>
 *   )
 * }
 * ```
 */
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents,
  formComponents,
})

// Реэкспорт типов для удобства
export type { FieldApi, FormApi }

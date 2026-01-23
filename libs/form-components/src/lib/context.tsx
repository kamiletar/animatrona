'use client'

import { createFormHookContexts } from '@tanstack/react-form'
import { useMemo, type ReactNode } from 'react'

/**
 * Form hook contexts for the application
 *
 * These contexts and hooks are used by custom field components
 * to access form and field state without prop drilling.
 *
 * @example
 * ```tsx
 * // In a custom field component
 * import { useFieldContext, useFormContext } from '@lena/form-components'
 *
 * function TextField({ label }: { label: string }) {
 *   const field = useFieldContext<string>()
 *   return (
 *     <label>
 *       {label}
 *       <input
 *         value={field.state.value}
 *         onChange={(e) => field.handleChange(e.target.value)}
 *         onBlur={field.handleBlur}
 *       />
 *     </label>
 *   )
 * }
 * ```
 */
export const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

/**
 * Типизированная обёртка над useFormContext.
 *
 * Решает проблему типизации: стандартный useFormContext() не принимает type argument,
 * поэтому для доступа к типизированным values нужен workaround `as unknown as T`.
 * Этот хук делает это автоматически.
 *
 * @example
 * ```tsx
 * interface Settings {
 *   fontSize: number
 *   columns: number
 * }
 *
 * function LivePreview() {
 *   const { values, form } = useTypedFormContext<Settings>()
 *
 *   return (
 *     <form.Subscribe selector={(s) => values(s)}>
 *       {(settings) => (
 *         // settings имеет тип Settings
 *         <div style={{ fontSize: settings.fontSize }}>...</div>
 *       )}
 *     </form.Subscribe>
 *   )
 * }
 * ```
 */
export function useTypedFormContext<TFormData extends object>() {
  const rawForm = useFormContext()

  return useMemo(
    () => ({
      /**
       * Оригинальный form API из TanStack Form.
       * Используйте form.store для useStore подписок.
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form: rawForm as any,

      /**
       * Типизированный setFieldValue.
       * Используйте вместо form.setFieldValue для правильной типизации.
       */
      setFieldValue: <K extends keyof TFormData & string>(name: K, value: TFormData[K]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(rawForm.setFieldValue as any)(name, value)
      },

      /**
       * Типизированный селектор для values.
       * Используйте внутри form.Subscribe: `selector={(s) => values(s)}`
       */
      values: (state: { values: unknown }) => state.values as TFormData,

      /**
       * Получить текущие значения формы (snapshot).
       * Внимание: это не реактивно! Для реактивного доступа используйте form.Subscribe.
       */
      getValues: () => rawForm.state.values as unknown as TFormData,

      /**
       * Подписаться на конкретное поле.
       * Возвращает селектор для использования в form.Subscribe.
       */
      field:
        <K extends keyof TFormData>(name: K) =>
        (state: { values: unknown }) =>
          (state.values as TFormData)[name],
    }),
    [rawForm]
  )
}

/**
 * Типы для TypedFormSubscribe компонента
 */
interface TypedFormSubscribeProps<TFormData extends object, TSelected> {
  /** Селектор для выбора данных из состояния формы */
  selector: (values: TFormData) => TSelected
  /** Render функция, получающая выбранные данные */
  children: (selected: TSelected) => ReactNode
}

/**
 * Типизированный Subscribe компонент для удобной подписки на значения формы.
 *
 * @example
 * ```tsx
 * function LivePreview() {
 *   const { TypedSubscribe } = useTypedFormSubscribe<Settings>()
 *
 *   return (
 *     <TypedSubscribe selector={(values) => values.fontSize}>
 *       {(fontSize) => <div style={{ fontSize }}>...</div>}
 *     </TypedSubscribe>
 *   )
 * }
 * ```
 */
export function useTypedFormSubscribe<TFormData extends object>() {
  const form = useFormContext()

  const TypedSubscribe = useMemo(() => {
    return function TypedFormSubscribe<TSelected>({
      selector,
      children,
    }: TypedFormSubscribeProps<TFormData, TSelected>) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrappedSelector = (state: any) => selector(state.values as unknown as TFormData)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrappedChildren = children as any
      return <form.Subscribe selector={wrappedSelector}>{wrappedChildren}</form.Subscribe>
    }
  }, [form])

  return { form, TypedSubscribe }
}

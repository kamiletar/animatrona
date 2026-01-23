'use client'

import type { ReactElement } from 'react'
import type { FormPropsWithApi } from '../types'
import type { FormComponent } from './form-compound-types'
import { FormSimple } from './form-simple'
import { FormWithApi } from './form-with-api'

// Реэкспорт типов для внешнего использования
export type {
  FormButtonComponents,
  FormComponent,
  FormFieldComponents,
  FormGroupComponent,
  FormGroupListComponent,
  FormStepsComponent,
  ListButtonComponents,
} from './form-compound-types'

// Реэкспорт подкомпонентов
export { FormLoadingState } from './form-loading-state'
export { FormSimple, type FormSimpleProps } from './form-simple'
export { buildValidators } from './form-validators'
export { FormWithApi, type FormWithApiProps } from './form-with-api'
export { useFormFeatures, type UseFormFeaturesConfig, type UseFormFeaturesResult } from './use-form-features'

/**
 * Корневой компонент декларативной формы.
 *
 * Поддерживает два режима:
 * 1. **Простой режим** — укажите initialValue и onSubmit
 * 2. **API режим** — укажите api для автоматической интеграции с ZenStack
 *
 * @example Простой режим
 * ```tsx
 * <Form initialValue={{ title: '', count: 0 }} onSubmit={handleSubmit}>
 *   <Form.Field.String name="title" label="Заголовок" />
 *   <Form.Button.Submit>Сохранить</Form.Button.Submit>
 * </Form>
 * ```
 *
 * @example API режим (ZenStack)
 * ```tsx
 * <Form
 *   api={{
 *     id: 'abc123', // пустой = создание, заполненный = редактирование
 *     query: { hook: useFindUniqueRecipe, include: { components: true } },
 *     mutations: { create: useCreateRecipe, update: useUpdateRecipe },
 *   }}
 *   schema={RecipeSchema}
 *   onSubmit={(data) => console.log('Сохранено:', data)}
 * >
 *   <Form.Field.String name="title" />
 *   <Form.Button.Submit />
 * </Form>
 * ```
 */
function FormRoot<TData extends object>({
  api,
  initialValue,
  onSubmit,
  schema,
  persistence,
  offline,
  validateOn,
  disabled,
  readOnly,
  children,
}: FormPropsWithApi<TData>): ReactElement {
  // Если указан api — используем FormWithApi, иначе — простую форму
  if (api) {
    return (
      <FormWithApi
        api={api}
        initialValue={initialValue}
        onSubmit={onSubmit}
        schema={schema}
        persistence={persistence}
        offline={offline}
        validateOn={validateOn}
        disabled={disabled}
        readOnly={readOnly}
      >
        {children}
      </FormWithApi>
    )
  }

  // Простой режим — initialValue обязателен
  if (!initialValue) {
    throw new Error('Form requires either api prop or initialValue prop')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const noopSubmit = () => {}

  return (
    <FormSimple
      initialValue={initialValue}
      onSubmit={onSubmit ?? noopSubmit}
      schema={schema}
      persistence={persistence}
      offline={offline}
      validateOn={validateOn}
      disabled={disabled}
      readOnly={readOnly}
    >
      {children}
    </FormSimple>
  )
}

/**
 * Form как compound component.
 * Подкомпоненты (Field, Group, Button, Steps и т.д.) добавляются в declarative/index.ts
 */
export const Form = FormRoot as unknown as FormComponent

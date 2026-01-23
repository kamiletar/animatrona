'use client'

import { HStack, VStack } from '@chakra-ui/react'
import type { ReactElement, ReactNode } from 'react'
import type { FormOfflineConfig } from '../offline'
import { FormAutoFields } from './form-auto-fields'
import { ButtonReset } from './form-buttons/button-reset'
import { ButtonSubmit } from './form-buttons/button-submit'
import type { FormPersistenceConfig } from './form-persistence'
import { FormSimple } from './form-root'
import type { FormMiddleware, ValidateOn } from './types'

/**
 * Props для Form.FromSchema
 */
export interface FormFromSchemaProps<TData extends object> {
  /**
   * Zod схема (обязательна)
   * Используется для валидации и автогенерации полей
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any
  /**
   * Начальные значения формы
   */
  initialValue: TData
  /**
   * Обработчик отправки формы
   */
  onSubmit: (data: TData) => void | Promise<void>
  /**
   * Текст кнопки отправки
   * @default 'Сохранить'
   */
  submitLabel?: ReactNode
  /**
   * Показывать кнопку сброса
   * @default false
   */
  showReset?: boolean
  /**
   * Текст кнопки сброса
   * @default 'Сбросить'
   */
  resetLabel?: ReactNode
  /**
   * Исключить поля из автогенерации
   * @example exclude={['id', 'createdAt', 'updatedAt']}
   */
  exclude?: string[]
  /**
   * Режим валидации
   */
  validateOn?: ValidateOn | ValidateOn[]
  /**
   * Middleware для обработки событий формы
   */
  middleware?: FormMiddleware<TData>
  /**
   * Глобальное отключение всех полей
   */
  disabled?: boolean
  /**
   * Глобальный режим только для чтения
   */
  readOnly?: boolean
  /**
   * Конфигурация localStorage персистенции
   */
  persistence?: FormPersistenceConfig
  /**
   * Конфигурация оффлайн режима
   */
  offline?: FormOfflineConfig
  /**
   * Дополнительный контент перед кнопками
   */
  beforeButtons?: ReactNode
  /**
   * Дополнительный контент после кнопок
   */
  afterButtons?: ReactNode
  /**
   * Gap между полями
   * @default 4
   */
  gap?: number
}

/**
 * Form.FromSchema — полностью автоматическая генерация формы из Zod схемы
 *
 * Создаёт форму с автоматически сгенерированными полями на основе
 * типов и метаданных Zod схемы.
 *
 * @example Простое использование
 * ```tsx
 * const UserSchema = z.object({
 *   firstName: z.string().meta({ ui: { title: 'Имя' } }),
 *   lastName: z.string().meta({ ui: { title: 'Фамилия' } }),
 *   email: z.string().email().meta({ ui: { title: 'Email' } }),
 *   bio: z.string().meta({ ui: { title: 'О себе', fieldType: 'textarea' } }),
 * })
 *
 * <Form.FromSchema
 *   schema={UserSchema}
 *   initialValue={{ firstName: '', lastName: '', email: '', bio: '' }}
 *   onSubmit={saveUser}
 *   submitLabel="Создать пользователя"
 * />
 * ```
 *
 * @example С исключением полей и кнопкой сброса
 * ```tsx
 * <Form.FromSchema
 *   schema={UserSchema}
 *   initialValue={userData}
 *   onSubmit={updateUser}
 *   exclude={['id', 'createdAt']}
 *   showReset
 *   submitLabel="Обновить"
 *   resetLabel="Отменить изменения"
 * />
 * ```
 *
 * @example С middleware и валидацией
 * ```tsx
 * <Form.FromSchema
 *   schema={UserSchema}
 *   initialValue={data}
 *   onSubmit={save}
 *   validateOn="blur"
 *   middleware={{
 *     afterSuccess: () => toaster.success({ title: 'Сохранено!' }),
 *     onError: (e) => toaster.error({ title: e.message }),
 *   }}
 * />
 * ```
 */
export function FormFromSchema<TData extends object>({
  schema,
  initialValue,
  onSubmit,
  submitLabel = 'Сохранить',
  showReset = false,
  resetLabel = 'Сбросить',
  exclude,
  validateOn,
  middleware,
  disabled,
  readOnly,
  persistence,
  offline,
  beforeButtons,
  afterButtons,
  gap = 4,
}: FormFromSchemaProps<TData>): ReactElement {
  return (
    <FormSimple
      schema={schema}
      initialValue={initialValue}
      onSubmit={onSubmit}
      validateOn={validateOn}
      middleware={middleware}
      disabled={disabled}
      readOnly={readOnly}
      persistence={persistence}
      offline={offline}
    >
      <VStack align="stretch" gap={gap}>
        {/* Автоматически сгенерированные поля */}
        <FormAutoFields exclude={exclude} />

        {/* Дополнительный контент перед кнопками */}
        {beforeButtons}

        {/* Кнопки */}
        <HStack justify="flex-end" gap={2}>
          {showReset && <ButtonReset variant="outline">{resetLabel}</ButtonReset>}
          <ButtonSubmit>{submitLabel}</ButtonSubmit>
        </HStack>

        {/* Дополнительный контент после кнопок */}
        {afterButtons}
      </VStack>
    </FormSimple>
  )
}

FormFromSchema.displayName = 'FormFromSchema'

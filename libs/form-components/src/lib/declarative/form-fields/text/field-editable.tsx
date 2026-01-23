'use client'

import { Editable, Field, IconButton } from '@chakra-ui/react'
import type { ReactElement, ReactNode } from 'react'
import type { BaseFieldProps } from '../../types'
import { createField, FieldError, FieldLabel } from '../base'

/**
 * Props для Editable поля
 */
export interface EditableFieldProps extends Omit<BaseFieldProps, 'placeholder'> {
  /** Placeholder при пустом значении */
  placeholder?: string
  /** Использовать textarea для многострочного редактирования (по умолчанию: false) */
  multiline?: boolean
  /** Режим активации (по умолчанию: click) */
  activationMode?: 'click' | 'dblclick' | 'focus' | 'none'
  /** Показывать кнопки управления (редактировать, отменить, сохранить) (по умолчанию: false) */
  showControls?: boolean
  /** Автоматически менять размер textarea (только для multiline=true) (по умолчанию: true) */
  autoResize?: boolean
  /** Кастомная иконка редактирования */
  editIcon?: ReactNode
  /** Кастомная иконка отмены */
  cancelIcon?: ReactNode
  /** Кастомная иконка сохранения */
  submitIcon?: ReactNode
  /** Сохранять при blur (по умолчанию: true) */
  submitOnBlur?: boolean
}

/**
 * Form.Field.Editable - Редактируемый текст inline
 *
 * Рендерит текст, который можно кликнуть для inline редактирования.
 * Поддерживает однострочный input и многострочный textarea.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.Editable
 *   name="title"
 *   label="Заголовок"
 *   placeholder="Кликните для добавления заголовка"
 * />
 * ```
 *
 * @example Многострочный
 * ```tsx
 * <Form.Field.Editable
 *   name="description"
 *   multiline
 *   placeholder="Кликните для добавления описания..."
 * />
 * ```
 *
 * @example С кнопками управления
 * ```tsx
 * <Form.Field.Editable
 *   name="name"
 *   showControls
 *   activationMode="dblclick"
 * />
 * ```
 */
export const FieldEditable = createField<EditableFieldProps, string>({
  displayName: 'FieldEditable',

  render: ({ field, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const {
      multiline = false,
      activationMode = 'click',
      showControls = false,
      editIcon,
      cancelIcon,
      submitIcon,
      submitOnBlur = true,
    } = componentProps

    const currentValue = (field.state.value as string) || ''

    return (
      <Field.Root
        invalid={hasError}
        required={resolved.required}
        disabled={resolved.disabled}
        readOnly={resolved.readOnly}
      >
        <FieldLabel label={resolved.label} tooltip={resolved.tooltip} required={resolved.required} />

        <Editable.Root
          value={currentValue}
          onValueChange={(details) => field.handleChange(details.value)}
          disabled={resolved.disabled}
          readOnly={resolved.readOnly}
          placeholder={resolved.placeholder ?? 'Кликните для редактирования'}
          activationMode={activationMode}
          submitMode={submitOnBlur ? 'blur' : 'enter'}
        >
          <Editable.Preview
            minH={multiline ? '48px' : undefined}
            alignItems={multiline ? 'flex-start' : undefined}
            width="full"
          />

          {multiline ? <Editable.Textarea /> : <Editable.Input />}

          {showControls && (
            <Editable.Control>
              <Editable.EditTrigger asChild>
                <IconButton variant="ghost" size="xs">
                  {editIcon ?? '✏️'}
                </IconButton>
              </Editable.EditTrigger>
              <Editable.CancelTrigger asChild>
                <IconButton variant="outline" size="xs">
                  {cancelIcon ?? '✕'}
                </IconButton>
              </Editable.CancelTrigger>
              <Editable.SubmitTrigger asChild>
                <IconButton variant="outline" size="xs">
                  {submitIcon ?? '✓'}
                </IconButton>
              </Editable.SubmitTrigger>
            </Editable.Control>
          )}
        </Editable.Root>

        <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
      </Field.Root>
    )
  },
})

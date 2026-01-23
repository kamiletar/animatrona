'use client'

import { Field, TagsInput } from '@chakra-ui/react'
import type { ReactElement } from 'react'
import type { BaseFieldProps, FieldTooltipMeta } from '../../types'
import { createField, FieldError, SelectionFieldLabel } from '../base'

/**
 * Props для Form.Field.Tags
 */
export interface TagsFieldProps extends BaseFieldProps {
  /** Tooltip для label поля */
  tooltip?: FieldTooltipMeta
  /** Максимальное количество тегов */
  maxTags?: number
  /** Минимальная длина каждого тега (по умолчанию: 1) */
  minTagLength?: number
  /** Кастомный разделитель (regex или строка). По умолчанию Enter */
  delimiter?: RegExp | string
  /** Добавлять теги при blur (по умолчанию: false) */
  addOnBlur?: boolean
  /** Добавлять теги при вставке (по умолчанию: true) */
  addOnPaste?: boolean
  /** Разрешить редактирование тегов по клику (по умолчанию: false) */
  editable?: boolean
  /** Показывать кнопку очистки (по умолчанию: false) */
  clearable?: boolean
  /** Размер (по умолчанию: md) */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Визуальный вариант (по умолчанию: outline) */
  variant?: 'outline' | 'subtle' | 'flushed'
  /** Цветовая палитра для тегов */
  colorPalette?: string
}

/**
 * Form.Field.Tags - Поле ввода тегов
 *
 * Рендерит input для добавления/удаления строковых тегов.
 * Интегрируется с Chakra UI TagsInput компонентом.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.Tags name="tags" label="Теги" placeholder="Добавить тег..." />
 * ```
 *
 * @example С ограничениями
 * ```tsx
 * <Form.Field.Tags
 *   name="categories"
 *   label="Категории"
 *   maxTags={5}
 *   minTagLength={2}
 *   helperText="До 5 категорий"
 * />
 * ```
 *
 * @example С кастомным разделителем
 * ```tsx
 * <Form.Field.Tags
 *   name="emails"
 *   label="Email адреса"
 *   delimiter={/[;,\s]/}
 *   addOnPaste
 * />
 * ```
 *
 * @example Редактируемые теги
 * ```tsx
 * <Form.Field.Tags
 *   name="tags"
 *   label="Теги"
 *   editable
 *   clearable
 * />
 * ```
 */
export const FieldTags = createField<TagsFieldProps, string[]>({
  displayName: 'FieldTags',

  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const {
      maxTags,
      minTagLength = 1,
      delimiter,
      addOnBlur = false,
      addOnPaste = true,
      editable = false,
      clearable = false,
      size = 'md',
      variant = 'outline',
      colorPalette,
    } = componentProps

    const value = (field.state.value as string[]) ?? []

    const handleValueChange = (details: { value: string[] }) => {
      field.handleChange(details.value)
    }

    const validateTag = (details: { inputValue: string }) => {
      return details.inputValue.length >= minTagLength
    }

    return (
      <Field.Root
        invalid={hasError}
        required={resolved.required}
        disabled={resolved.disabled}
        readOnly={resolved.readOnly}
      >
        <TagsInput.Root
          value={value}
          onValueChange={handleValueChange}
          max={maxTags}
          validate={validateTag}
          delimiter={delimiter}
          blurBehavior={addOnBlur ? 'add' : undefined}
          addOnPaste={addOnPaste}
          editable={editable}
          disabled={resolved.disabled}
          readOnly={resolved.readOnly}
          size={size}
          variant={variant}
          colorPalette={colorPalette}
          data-field-name={fullPath}
        >
          {resolved.label && (
            <TagsInput.Label>
              <SelectionFieldLabel
                label={resolved.label}
                tooltip={resolved.tooltip}
                required={resolved.required}
              />
            </TagsInput.Label>
          )}

          <TagsInput.Control>
            <TagsInput.Items />
            <TagsInput.Input placeholder={resolved.placeholder} onBlur={field.handleBlur} />
            {clearable && <TagsInput.ClearTrigger />}
          </TagsInput.Control>

          <TagsInput.HiddenInput />
        </TagsInput.Root>

        <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
      </Field.Root>
    )
  },
})

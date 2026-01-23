'use client'

import { IconButton, Input, InputGroup } from '@chakra-ui/react'
import { useState, type ReactElement } from 'react'
import { LuEye, LuEyeOff } from 'react-icons/lu'
import type { PasswordFieldProps } from '../../types'
import { createField, FieldWrapper } from '../base'

/**
 * Состояние для переключения видимости пароля
 */
interface PasswordFieldState {
  /** Видим ли пароль */
  visible: boolean
  /** Переключить видимость */
  toggle: () => void
}

/**
 * Form.Field.Password - Поле ввода пароля с переключением видимости
 *
 * Рендерит поле ввода пароля с кнопкой показа/скрытия.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.Password name="password" label="Пароль" />
 * ```
 *
 * @example С видимым паролем по умолчанию
 * ```tsx
 * <Form.Field.Password name="password" label="Пароль" defaultVisible />
 * ```
 */
export const FieldPassword = createField<PasswordFieldProps, string, PasswordFieldState>({
  displayName: 'FieldPassword',

  useFieldState: (props) => {
    const [visible, setVisible] = useState(props.defaultVisible ?? false)
    return {
      visible,
      toggle: () => setVisible((v) => !v),
    }
  },

  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps, fieldState }): ReactElement => (
    <FieldWrapper resolved={resolved} hasError={hasError} errorMessage={errorMessage} fullPath={fullPath}>
      <InputGroup
        endElement={
          <IconButton
            tabIndex={-1}
            me="-2"
            aspectRatio="square"
            size="sm"
            variant="ghost"
            height="calc(100% - {spacing.2})"
            aria-label="Переключить видимость пароля"
            disabled={resolved.disabled}
            onPointerDown={(e) => {
              if (resolved.disabled) {
                return
              }
              if (e.button !== 0) {
                return
              }
              e.preventDefault()
              fieldState.toggle()
            }}
          >
            {fieldState.visible ? <LuEyeOff /> : <LuEye />}
          </IconButton>
        }
      >
        <Input
          type={fieldState.visible ? 'text' : 'password'}
          value={(field.state.value as string) ?? ''}
          onChange={(e) => field.handleChange((e.target as HTMLInputElement).value)}
          onBlur={field.handleBlur}
          placeholder={resolved.placeholder}
          maxLength={componentProps.maxLength}
          autoComplete={componentProps.autoComplete}
          data-field-name={fullPath}
        />
      </InputGroup>
    </FieldWrapper>
  ),
})

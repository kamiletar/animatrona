'use client'

import { Alert, Box, List, Text } from '@chakra-ui/react'
import type { ReactElement, ReactNode } from 'react'
import { useDeclarativeForm } from './form-context'

interface FormErrorsProps {
  /** Заголовок секции ошибок */
  title?: ReactNode
}

interface ZodIssue {
  message: string
  code?: string
  path?: string[]
  expected?: string
}

type FieldErrors = Record<string, ZodIssue[]>

/**
 * Извлекает все сообщения об ошибках из структуры TanStack Form + Zod
 * Формат: { "field.path": [{ message: "...", code: "...", path: [...] }] }
 */
function extractAllErrors(errors: unknown[]): string[] {
  const messages: string[] = []

  for (const error of errors) {
    if (!error) {
      continue
    }

    if (typeof error === 'string') {
      const trimmed = error.trim()
      if (trimmed) {
        messages.push(trimmed)
      }
      continue
    }

    if (typeof error === 'object') {
      // Обрабатываем объект ошибок полей: { "field.path": [{ message: "..." }] }
      const fieldErrors = error as FieldErrors
      for (const [fieldPath, issues] of Object.entries(fieldErrors)) {
        if (Array.isArray(issues)) {
          for (const issue of issues) {
            if (issue.message) {
              messages.push(`${fieldPath}: ${issue.message}`)
            }
          }
        }
      }
    }
  }

  return messages
}

/**
 * Form.Errors - Отображает все ошибки валидации формы
 *
 * Показывает сводку всех ошибок валидации по всем полям.
 * Рендерится только при наличии ошибок.
 *
 * @example
 * ```tsx
 * <Form initialValue={data} onSubmit={handleSubmit}>
 *   <Form.Field.String name="title" />
 *   <Form.Errors />
 *   <Form.Button.Submit />
 * </Form>
 * ```
 */
export function FormErrors({ title = 'Please fix the following errors:' }: FormErrorsProps): ReactElement | null {
  const { form, apiState } = useDeclarativeForm()

  // Извлекаем сообщение об ошибке сервера, если есть
  const serverError = apiState?.mutationError
  // Некоторые библиотеки (например, ZenStack) добавляют info к Error
  const errorInfo = serverError && 'info' in serverError ? (serverError as { info?: { message?: string } }).info : null
  const serverErrorMessage = serverError ? serverError.message || errorInfo?.message || 'Server error occurred' : null

  return (
    <form.Subscribe selector={(state: { errors: unknown[] }) => state.errors}>
      {(errors: unknown[]) => {
        const validErrors = extractAllErrors(errors)
        const hasErrors = validErrors.length > 0 || serverErrorMessage

        if (!hasErrors) {
          return null
        }

        return (
          <Alert.Root status="error">
            <Alert.Indicator />
            <Box>
              <Alert.Title>{title}</Alert.Title>
              <Alert.Description>
                <List.Root>
                  {serverErrorMessage && (
                    <List.Item>
                      <Text fontWeight="bold">{serverErrorMessage}</Text>
                    </List.Item>
                  )}
                  {validErrors.map((error, index) => (
                    <List.Item key={index}>
                      <Text>{error}</Text>
                    </List.Item>
                  ))}
                </List.Root>
              </Alert.Description>
            </Box>
          </Alert.Root>
        )
      }}
    </form.Subscribe>
  )
}

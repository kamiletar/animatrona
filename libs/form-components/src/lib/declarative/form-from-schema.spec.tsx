import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod/v4'
import { FormFromSchema } from './form-from-schema'

// Обёртка для тестов с Chakra UI
const TestWrapper = ({ children }: { children: ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
)

// Простая тестовая схема
const SimpleSchema = z.object({
  name: z.string().meta({ ui: { title: 'Имя' } }),
  email: z.string().email().meta({ ui: { title: 'Email' } }),
})

// Схема с числовым полем
const NumberSchema = z.object({
  title: z.string().meta({ ui: { title: 'Заголовок' } }),
  age: z.number().meta({ ui: { title: 'Возраст' } }),
})

// Схема с boolean
const CheckboxSchema = z.object({
  name: z.string().meta({ ui: { title: 'Имя' } }),
  agree: z.boolean().meta({ ui: { title: 'Согласие' } }),
})

describe('FormFromSchema', () => {
  describe('rendering', () => {
    it('рендерит форму с автоматически сгенерированными полями', async () => {
      render(
        <TestWrapper>
          <FormFromSchema
            schema={SimpleSchema}
            initialValue={{ name: '', email: '' }}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Имя')).toBeInTheDocument()
        expect(screen.getByText('Email')).toBeInTheDocument()
      })
    })

    it('рендерит кнопку Submit с дефолтным текстом', async () => {
      render(
        <TestWrapper>
          <FormFromSchema
            schema={SimpleSchema}
            initialValue={{ name: '', email: '' }}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument()
      })
    })

    it('рендерит кнопку Submit с кастомным текстом', async () => {
      render(
        <TestWrapper>
          <FormFromSchema
            schema={SimpleSchema}
            initialValue={{ name: '', email: '' }}
            onSubmit={vi.fn()}
            submitLabel="Создать"
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Создать' })).toBeInTheDocument()
      })
    })

    it('не рендерит кнопку Reset по умолчанию', async () => {
      render(
        <TestWrapper>
          <FormFromSchema
            schema={SimpleSchema}
            initialValue={{ name: '', email: '' }}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Сбросить' })).not.toBeInTheDocument()
      })
    })

    it('рендерит кнопку Reset когда showReset=true', async () => {
      render(
        <TestWrapper>
          <FormFromSchema
            schema={SimpleSchema}
            initialValue={{ name: '', email: '' }}
            onSubmit={vi.fn()}
            showReset
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Сбросить' })).toBeInTheDocument()
      })
    })

    it('рендерит кнопку Reset с кастомным текстом', async () => {
      render(
        <TestWrapper>
          <FormFromSchema
            schema={SimpleSchema}
            initialValue={{ name: '', email: '' }}
            onSubmit={vi.fn()}
            showReset
            resetLabel="Отменить"
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Отменить' })).toBeInTheDocument()
      })
    })
  })

  describe('exclude prop', () => {
    it('исключает поля из рендеринга', async () => {
      render(
        <TestWrapper>
          <FormFromSchema
            schema={SimpleSchema}
            initialValue={{ name: '', email: '' }}
            onSubmit={vi.fn()}
            exclude={['email']}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Имя')).toBeInTheDocument()
        expect(screen.queryByText('Email')).not.toBeInTheDocument()
      })
    })

    it('исключает несколько полей', async () => {
      const Schema = z.object({
        a: z.string().meta({ ui: { title: 'A' } }),
        b: z.string().meta({ ui: { title: 'B' } }),
        c: z.string().meta({ ui: { title: 'C' } }),
      })

      render(
        <TestWrapper>
          <FormFromSchema
            schema={Schema}
            initialValue={{ a: '', b: '', c: '' }}
            onSubmit={vi.fn()}
            exclude={['a', 'c']}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.queryByText('A')).not.toBeInTheDocument()
        expect(screen.getByText('B')).toBeInTheDocument()
        expect(screen.queryByText('C')).not.toBeInTheDocument()
      })
    })
  })

  describe('initial values', () => {
    it('отображает начальные значения в полях', async () => {
      render(
        <TestWrapper>
          <FormFromSchema
            schema={SimpleSchema}
            initialValue={{ name: 'Иван', email: 'ivan@test.ru' }}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByDisplayValue('Иван')).toBeInTheDocument()
        expect(screen.getByDisplayValue('ivan@test.ru')).toBeInTheDocument()
      })
    })
  })

  describe('submit', () => {
    it('вызывает onSubmit при отправке формы', async () => {
      const onSubmit = vi.fn()

      render(
        <TestWrapper>
          <FormFromSchema
            schema={SimpleSchema}
            initialValue={{ name: 'Тест', email: 'test@test.ru' }}
            onSubmit={onSubmit}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument()
      })

      await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Тест',
            email: 'test@test.ru',
          })
        )
      })
    })

    it('передаёт async onSubmit', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined)

      render(
        <TestWrapper>
          <FormFromSchema
            schema={SimpleSchema}
            initialValue={{ name: 'Async', email: 'async@test.ru' }}
            onSubmit={onSubmit}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument()
      })

      await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled()
      })
    })
  })

  describe('disabled/readOnly', () => {
    it('отключает все поля когда disabled=true', async () => {
      render(
        <TestWrapper>
          <FormFromSchema
            schema={SimpleSchema}
            initialValue={{ name: '', email: '' }}
            onSubmit={vi.fn()}
            disabled
          />
        </TestWrapper>
      )

      await waitFor(() => {
        const inputs = screen.getAllByRole('textbox')
        inputs.forEach((input) => {
          expect(input).toBeDisabled()
        })
      })
    })
  })

  describe('beforeButtons/afterButtons slots', () => {
    it('рендерит beforeButtons перед кнопками', async () => {
      render(
        <TestWrapper>
          <FormFromSchema
            schema={SimpleSchema}
            initialValue={{ name: '', email: '' }}
            onSubmit={vi.fn()}
            beforeButtons={<div data-testid="before-buttons">Before Content</div>}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('before-buttons')).toBeInTheDocument()
      })
    })

    it('рендерит afterButtons после кнопок', async () => {
      render(
        <TestWrapper>
          <FormFromSchema
            schema={SimpleSchema}
            initialValue={{ name: '', email: '' }}
            onSubmit={vi.fn()}
            afterButtons={<div data-testid="after-buttons">After Content</div>}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('after-buttons')).toBeInTheDocument()
      })
    })
  })

  describe('different field types', () => {
    it('рендерит числовые поля', async () => {
      render(
        <TestWrapper>
          <FormFromSchema
            schema={NumberSchema}
            initialValue={{ title: '', age: 25 }}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Заголовок')).toBeInTheDocument()
        expect(screen.getByText('Возраст')).toBeInTheDocument()
      })
    })

    it('рендерит boolean поля как checkbox', async () => {
      render(
        <TestWrapper>
          <FormFromSchema
            schema={CheckboxSchema}
            initialValue={{ name: '', agree: false }}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Имя')).toBeInTheDocument()
        expect(screen.getByText('Согласие')).toBeInTheDocument()
      })
    })
  })

  describe('displayName', () => {
    it('имеет корректный displayName', () => {
      expect(FormFromSchema.displayName).toBe('FormFromSchema')
    })
  })
})

'use client'

import { Box, Field, HStack, IconButton } from '@chakra-ui/react'
import type { AnyFieldApi } from '@tanstack/react-form'
import TiptapImage from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor, type Content } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useMemo, type ReactElement } from 'react'
import type { BaseFieldProps, FieldTooltipMeta } from '../../types'
import { FieldError, FieldLabel, getFieldErrors, useResolvedFieldProps } from '../base'
import { ImagePopover, type ImageUploadConfig } from './image-popover'
import { LinkPopover } from './link-popover'
import { DEFAULT_TOOLBAR_BUTTONS, TOOLBAR_CONFIG, type ToolbarButton } from './toolbar-config'

/**
 * Безопасный парсинг JSON с fallback на пустой документ
 * Предотвращает крэш при невалидном JSON
 */
function safeParseJSON(value: string): Content {
  try {
    return JSON.parse(value) as Content
  } catch {
    console.warn('RichText: Invalid JSON content, using empty document')
    return ''
  }
}

/**
 * Props для RichText поля
 */
export interface RichTextFieldProps extends BaseFieldProps {
  /** Tooltip для label поля */
  tooltip?: FieldTooltipMeta
  /** Минимальная высота редактора (по умолчанию: 150px) */
  minHeight?: string | number
  /** Максимальная высота редактора (включает скролл) */
  maxHeight?: string | number
  /** Показывать панель инструментов (по умолчанию: true) */
  showToolbar?: boolean
  /** Кнопки панели инструментов (по умолчанию: все) */
  toolbarButtons?: ToolbarButton[]
  /** Формат вывода: 'html' или 'json' (по умолчанию: 'html') */
  outputFormat?: 'html' | 'json'
  /** Конфигурация загрузки изображений (опционально) */
  imageUpload?: ImageUploadConfig
}

// Реэкспортируем тип для удобства использования
export type { ImageUploadConfig }

/**
 * Form.Field.RichText - WYSIWYG редактор форматированного текста
 *
 * Рендерит редактор на базе Tiptap с панелью инструментов
 * и автоматической интеграцией с формой.
 *
 * @example Базовое использование
 * ```tsx
 * <Form.Field.RichText name="content" label="Контент" />
 * ```
 *
 * @example С кастомной высотой
 * ```tsx
 * <Form.Field.RichText
 *   name="description"
 *   label="Описание"
 *   minHeight="200px"
 *   maxHeight="400px"
 * />
 * ```
 *
 * @example С ограниченной панелью инструментов
 * ```tsx
 * <Form.Field.RichText
 *   name="comment"
 *   label="Комментарий"
 *   toolbarButtons={['bold', 'italic', 'link']}
 * />
 * ```
 *
 * @example JSON вывод (для хранения в БД)
 * ```tsx
 * <Form.Field.RichText
 *   name="article"
 *   label="Статья"
 *   outputFormat="json"
 * />
 * ```
 */
export function FieldRichText({
  name,
  label,
  placeholder,
  helperText,
  required,
  disabled,
  readOnly,
  tooltip,
  minHeight = '150px',
  maxHeight,
  showToolbar = true,
  toolbarButtons = DEFAULT_TOOLBAR_BUTTONS,
  outputFormat = 'html',
  imageUpload,
}: RichTextFieldProps): ReactElement {
  const {
    form,
    fullPath,
    label: resolvedLabel,
    placeholder: resolvedPlaceholder,
    helperText: resolvedHelperText,
    tooltip: resolvedTooltip,
    required: resolvedRequired,
    disabled: resolvedDisabled,
    readOnly: resolvedReadOnly,
  } = useResolvedFieldProps(name, { label, placeholder, helperText, required, disabled, readOnly, tooltip })

  return (
    <form.Field name={fullPath}>
      {(field: AnyFieldApi) => {
        const { hasError, errorMessage } = getFieldErrors(field)

        return (
          <Field.Root
            invalid={hasError}
            required={resolvedRequired}
            disabled={resolvedDisabled}
            readOnly={resolvedReadOnly}
          >
            <FieldLabel label={resolvedLabel} tooltip={resolvedTooltip} required={resolvedRequired} />
            <RichTextEditor
              value={field.state.value as string}
              onChange={(value) => field.handleChange(value)}
              onBlur={field.handleBlur}
              placeholder={resolvedPlaceholder}
              minHeight={minHeight}
              maxHeight={maxHeight}
              showToolbar={showToolbar}
              toolbarButtons={toolbarButtons}
              outputFormat={outputFormat}
              disabled={disabled}
              readOnly={readOnly}
              hasError={hasError}
              fieldName={fullPath}
              imageUpload={imageUpload}
            />
            <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolvedHelperText} />
          </Field.Root>
        )
      }}
    </form.Field>
  )
}

/**
 * Props для внутреннего компонента редактора
 */
interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  placeholder?: string
  minHeight: string | number
  maxHeight?: string | number
  showToolbar: boolean
  toolbarButtons: ToolbarButton[]
  outputFormat: 'html' | 'json'
  disabled?: boolean
  readOnly?: boolean
  hasError?: boolean
  fieldName: string
  imageUpload?: ImageUploadConfig
}

/**
 * Внутренний компонент Tiptap редактора
 */
function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  minHeight,
  maxHeight,
  showToolbar,
  toolbarButtons,
  outputFormat,
  disabled,
  readOnly,
  hasError,
  fieldName,
  imageUpload,
}: RichTextEditorProps) {
  // Собираем расширения динамически
  const extensions = useMemo(() => {
    // Базовые расширения
    const baseExtensions = [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Начните вводить...',
      }),
      // Добавляем Image extension только если imageUpload настроен
      ...(imageUpload
        ? [
            TiptapImage.configure({
              inline: false,
              allowBase64: false,
              HTMLAttributes: {
                class: 'richtext-image',
              },
            }),
          ]
        : []),
    ]

    return baseExtensions
  }, [placeholder, imageUpload])

  const editor = useEditor({
    extensions,
    content: outputFormat === 'json' && value ? safeParseJSON(value) : value || '',
    editable: !disabled && !readOnly,
    onUpdate: ({ editor }) => {
      if (outputFormat === 'json') {
        onChange(JSON.stringify(editor.getJSON()))
      } else {
        onChange(editor.getHTML())
      }
    },
    onBlur: () => {
      onBlur()
    },
    immediatelyRender: false,
  })

  // Синхронизация внешних изменений значения
  useEffect(() => {
    if (!editor) {
      return
    }

    const currentContent = outputFormat === 'json' ? JSON.stringify(editor.getJSON()) : editor.getHTML()

    // Обновлять только если контент изменился (избегаем прыжка курсора)
    if (value !== currentContent) {
      const content = outputFormat === 'json' && value ? safeParseJSON(value) : value || ''
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [editor, value, outputFormat])

  // Обновление состояния редактируемости
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled && !readOnly)
    }
  }, [editor, disabled, readOnly])

  if (!editor) {
    return null
  }

  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      borderColor={hasError ? 'border.error' : 'border'}
      overflow="hidden"
      data-field-name={fieldName}
      _focusWithin={{
        borderColor: hasError ? 'border.error' : 'colorPalette.500',
        boxShadow: hasError
          ? '0 0 0 1px var(--chakra-colors-border-error)'
          : '0 0 0 1px var(--chakra-colors-colorPalette-500)',
      }}
    >
      {showToolbar && !readOnly && (
        <HStack p={1} gap={0.5} borderBottomWidth="1px" borderColor="border" bg="bg.subtle" flexWrap="wrap">
          {toolbarButtons.map((button) => {
            // Специальная обработка для link — используем Popover вместо window.prompt
            if (button === 'link') {
              return <LinkPopover key={button} editor={editor} disabled={disabled} />
            }

            // Специальная обработка для image — используем ImagePopover с загрузкой
            if (button === 'image') {
              // Показываем кнопку только если imageUpload настроен
              if (!imageUpload) {
                return null
              }
              return <ImagePopover key={button} editor={editor} config={imageUpload} disabled={disabled} />
            }

            const config = TOOLBAR_CONFIG[button]
            const isActive = config.isActive?.(editor) ?? false

            return (
              <IconButton
                key={button}
                aria-label={config.label}
                size="sm"
                variant={isActive ? 'solid' : 'ghost'}
                colorPalette={isActive ? 'brand' : undefined}
                onClick={() => config.action(editor)}
                disabled={disabled}
              >
                {config.icon}
              </IconButton>
            )
          })}
        </HStack>
      )}
      <Box
        minHeight={minHeight}
        maxHeight={maxHeight}
        overflowY={maxHeight ? 'auto' : undefined}
        p={3}
        css={{
          '& .tiptap': {
            outline: 'none',
            minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
          },
          '& .tiptap p.is-editor-empty:first-child::before': {
            color: 'var(--chakra-colors-fg-muted)',
            content: 'attr(data-placeholder)',
            float: 'left',
            height: 0,
            pointerEvents: 'none',
          },
          '& .tiptap h1': {
            fontSize: '2xl',
            fontWeight: 'bold',
            marginTop: '1em',
            marginBottom: '0.5em',
          },
          '& .tiptap h2': {
            fontSize: 'xl',
            fontWeight: 'bold',
            marginTop: '1em',
            marginBottom: '0.5em',
          },
          '& .tiptap h3': {
            fontSize: 'lg',
            fontWeight: 'semibold',
            marginTop: '1em',
            marginBottom: '0.5em',
          },
          '& .tiptap ul, & .tiptap ol': {
            paddingLeft: '1.5em',
            marginTop: '0.5em',
            marginBottom: '0.5em',
          },
          '& .tiptap blockquote': {
            borderLeft: '3px solid var(--chakra-colors-border)',
            paddingLeft: '1em',
            marginLeft: 0,
            marginTop: '0.5em',
            marginBottom: '0.5em',
            fontStyle: 'italic',
            color: 'var(--chakra-colors-fg-muted)',
          },
          '& .tiptap code': {
            backgroundColor: 'var(--chakra-colors-bg-subtle)',
            borderRadius: '3px',
            padding: '0.2em 0.4em',
            fontFamily: 'mono',
            fontSize: '0.9em',
          },
          '& .tiptap a': {
            color: 'var(--chakra-colors-colorPalette-500)',
            textDecoration: 'underline',
            cursor: 'pointer',
          },
          '& .tiptap p': {
            marginTop: '0.25em',
            marginBottom: '0.25em',
          },
          '& .tiptap img, & .tiptap .richtext-image': {
            maxWidth: '100%',
            height: 'auto',
            borderRadius: '4px',
            marginTop: '0.5em',
            marginBottom: '0.5em',
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  )
}

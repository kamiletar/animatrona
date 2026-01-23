'use client'

import {
  Box,
  Button,
  Field,
  FileUpload,
  Float,
  HStack,
  Icon,
  IconButton,
  Input,
  Text,
  useFileUploadContext,
} from '@chakra-ui/react'
import type { ReactElement, ReactNode } from 'react'
import { LuFile, LuUpload, LuX } from 'react-icons/lu'
import type { FieldTooltipMeta } from '../../types'
import { createField, FieldError, FieldLabel } from '../base'

/**
 * Props для FileUpload поля
 */
export interface FileUploadFieldProps {
  /** Имя поля */
  name?: string
  /** Лейбл поля */
  label?: string
  /** Вспомогательный текст под полем */
  helperText?: string
  /** Обязательное ли поле */
  required?: boolean
  /** Отключено ли поле */
  disabled?: boolean
  /** Tooltip для лейбла поля */
  tooltip?: FieldTooltipMeta

  /**
   * Допустимые типы файлов
   * @example "image/*"
   * @example ["image/png", "image/jpeg"]
   * @example ".pdf,.doc,.docx"
   */
  accept?: string | string[]
  /** Максимальный размер файла в байтах */
  maxFileSize?: number
  /** Максимальное количество файлов (по умолчанию: 1) */
  maxFiles?: number
  /**
   * Вариант отображения
   * - 'button': Простая кнопка-триггер
   * - 'dropzone': Зона drag & drop
   * - 'input': Input-подобный вид
   */
  variant?: 'button' | 'dropzone' | 'input'
  /** Показывать размер файлов в списке */
  showSize?: boolean
  /** Разрешить удаление файлов из списка */
  clearable?: boolean
  /** Текст зоны dropzone */
  dropzoneLabel?: ReactNode
  /** Описание зоны dropzone */
  dropzoneDescription?: ReactNode
  /** Текст кнопки (для варианта 'button') */
  buttonText?: ReactNode
}

/**
 * Список файлов с превью изображений
 */
function FileImageList({ clearable }: { clearable?: boolean }) {
  const fileUpload = useFileUploadContext()

  if (fileUpload.acceptedFiles.length === 0) {
    return null
  }

  return (
    <HStack wrap="wrap" gap="3" mt="2">
      {fileUpload.acceptedFiles.map((file) => (
        <FileUpload.Item key={file.name} file={file} p="2" width="auto" pos="relative">
          {clearable && (
            <Float placement="top-end">
              <FileUpload.ItemDeleteTrigger asChild>
                <IconButton size="2xs" variant="solid" colorPalette="red" rounded="full">
                  <LuX />
                </IconButton>
              </FileUpload.ItemDeleteTrigger>
            </Float>
          )}
          <FileUpload.ItemPreview type="image/*" asChild>
            <FileUpload.ItemPreviewImage boxSize="16" rounded="md" objectFit="cover" />
          </FileUpload.ItemPreview>
          <FileUpload.ItemPreview type=".*" asChild>
            <Icon fontSize="4xl" color="fg.muted">
              <LuFile />
            </Icon>
          </FileUpload.ItemPreview>
        </FileUpload.Item>
      ))}
    </HStack>
  )
}

/**
 * Стандартный список файлов (не изображения)
 */
function FileList({ showSize, clearable }: { showSize?: boolean; clearable?: boolean }) {
  const fileUpload = useFileUploadContext()

  if (fileUpload.acceptedFiles.length === 0) {
    return null
  }

  return (
    <FileUpload.ItemGroup mt="2">
      {fileUpload.acceptedFiles.map((file) => (
        <FileUpload.Item key={file.name} file={file}>
          <FileUpload.ItemPreview asChild>
            <Icon fontSize="lg" color="fg.muted">
              <LuFile />
            </Icon>
          </FileUpload.ItemPreview>

          {showSize ? (
            <FileUpload.ItemContent>
              <FileUpload.ItemName />
              <FileUpload.ItemSizeText />
            </FileUpload.ItemContent>
          ) : (
            <FileUpload.ItemName flex="1" />
          )}

          {clearable && (
            <FileUpload.ItemDeleteTrigger asChild>
              <IconButton variant="ghost" color="fg.muted" size="xs">
                <LuX />
              </IconButton>
            </FileUpload.ItemDeleteTrigger>
          )}
        </FileUpload.Item>
      ))}
    </FileUpload.ItemGroup>
  )
}

/**
 * Form.Field.FileUpload - Поле загрузки файлов с несколькими вариантами
 *
 * Поддерживает загрузку одного или нескольких файлов с drag & drop,
 * превью файлов и автоматической интеграцией с формой.
 *
 * @example Вариант кнопки (по умолчанию)
 * ```tsx
 * <Form.Field.FileUpload name="avatar" label="Аватар" accept="image/*" />
 * ```
 *
 * @example Вариант dropzone
 * ```tsx
 * <Form.Field.FileUpload
 *   name="documents"
 *   label="Документы"
 *   variant="dropzone"
 *   maxFiles={5}
 *   accept=".pdf,.doc,.docx"
 *   dropzoneLabel="Перетащите файлы сюда"
 *   dropzoneDescription="PDF, DOC до 10МБ"
 * />
 * ```
 *
 * @example Вариант input
 * ```tsx
 * <Form.Field.FileUpload
 *   name="file"
 *   label="Выберите файл"
 *   variant="input"
 *   placeholder="Выберите файл..."
 * />
 * ```
 *
 * @example Несколько изображений с превью
 * ```tsx
 * <Form.Field.FileUpload
 *   name="gallery"
 *   label="Галерея"
 *   variant="dropzone"
 *   accept="image/*"
 *   maxFiles={10}
 *   showSize
 *   clearable
 * />
 * ```
 */
export const FieldFileUpload = createField<FileUploadFieldProps, File[]>({
  displayName: 'FieldFileUpload',

  render: ({ field, fullPath, resolved, hasError, errorMessage, componentProps }): ReactElement => {
    const {
      accept,
      maxFileSize,
      maxFiles = 1,
      variant = 'button',
      showSize = false,
      clearable = true,
      dropzoneLabel = 'Перетащите файлы сюда',
      dropzoneDescription,
      buttonText = 'Загрузить файл',
    } = componentProps

    const placeholder = resolved.placeholder ?? 'Выберите файл(ы)'

    // Нормализация accept в массив для Chakra
    const normalizedAccept = accept
      ? typeof accept === 'string'
        ? accept.split(',').map((s) => s.trim())
        : accept
      : undefined

    // Проверка, работаем ли с изображениями для превью
    const isImageUpload = normalizedAccept?.some((type) => type.startsWith('image/') || type === 'image/*')

    return (
      <Field.Root invalid={hasError} required={resolved.required} disabled={resolved.disabled}>
        <FieldLabel label={resolved.label} tooltip={resolved.tooltip} required={resolved.required} />

        <FileUpload.Root
          maxFiles={maxFiles}
          maxFileSize={maxFileSize}
          accept={normalizedAccept}
          disabled={resolved.disabled}
          onFileChange={(details) => {
            field.handleChange(details.acceptedFiles)
          }}
          data-field-name={fullPath}
        >
          <FileUpload.HiddenInput onBlur={field.handleBlur} />

          {variant === 'button' && (
            <>
              <FileUpload.Trigger asChild>
                <Button variant="outline" size="sm">
                  <LuUpload />
                  {buttonText}
                </Button>
              </FileUpload.Trigger>
              {isImageUpload ? (
                <FileImageList clearable={clearable} />
              ) : (
                <FileList showSize={showSize} clearable={clearable} />
              )}
            </>
          )}

          {variant === 'dropzone' && (
            <>
              <FileUpload.Dropzone>
                <Icon size="md" color="fg.muted">
                  <LuUpload />
                </Icon>
                <FileUpload.DropzoneContent>
                  <Box>{dropzoneLabel}</Box>
                  {dropzoneDescription && <Text color="fg.muted">{dropzoneDescription}</Text>}
                </FileUpload.DropzoneContent>
              </FileUpload.Dropzone>
              {isImageUpload ? (
                <FileImageList clearable={clearable} />
              ) : (
                <FileList showSize={showSize} clearable={clearable} />
              )}
            </>
          )}

          {variant === 'input' && (
            <Input asChild>
              <FileUpload.Trigger>
                <FileUpload.Context>
                  {({ acceptedFiles }) => {
                    if (acceptedFiles.length === 1) {
                      return <span>{acceptedFiles[0].name}</span>
                    }
                    if (acceptedFiles.length > 1) {
                      return <span>{acceptedFiles.length} файлов</span>
                    }
                    return <Text color="fg.subtle">{placeholder}</Text>
                  }}
                </FileUpload.Context>
              </FileUpload.Trigger>
            </Input>
          )}
        </FileUpload.Root>

        <FieldError hasError={hasError} errorMessage={errorMessage} helperText={resolved.helperText} />
      </Field.Root>
    )
  },
})

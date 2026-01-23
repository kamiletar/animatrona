'use client'

import {
  Box,
  Button,
  Center,
  HStack,
  Icon,
  IconButton,
  Image,
  Popover,
  Portal,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import type { Editor } from '@tiptap/react'
import { useCallback, useRef, useState, type ReactElement } from 'react'
import { LuImage, LuUpload, LuX } from 'react-icons/lu'

/**
 * Конфигурация загрузки изображений
 */
export interface ImageUploadConfig {
  /** URL endpoint для загрузки */
  endpoint: string
  /** Категория изображения (для upload API) */
  category?: string
  /** Максимальный размер файла в байтах (по умолчанию: 10MB) */
  maxSize?: number
  /** Разрешённые MIME типы (по умолчанию: ['image/*']) */
  acceptTypes?: string[]
}

/**
 * Props для ImagePopover
 */
interface ImagePopoverProps {
  editor: Editor
  config: ImageUploadConfig
  disabled?: boolean
}

/** Состояния загрузки */
type UploadState = 'idle' | 'uploading' | 'error'

/**
 * Компонент для загрузки и вставки изображений в RichText редактор
 *
 * Использует Popover с drag-n-drop зоной и кнопкой выбора файла.
 * После успешной загрузки вставляет изображение в редактор.
 */
export function ImagePopover({ editor, config, disabled }: ImagePopoverProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const maxSize = config.maxSize ?? 10 * 1024 * 1024 // 10MB по умолчанию
  const acceptTypes = config.acceptTypes ?? ['image/*']

  /**
   * Загрузка файла на сервер
   */
  const handleUpload = useCallback(
    async (file: File) => {
      // Проверка типа файла
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Файл должен быть изображением')
        setUploadState('error')
        return
      }

      // Проверка размера
      if (file.size > maxSize) {
        const maxSizeMB = (maxSize / 1024 / 1024).toFixed(0)
        setErrorMessage(`Размер файла не должен превышать ${maxSizeMB}MB`)
        setUploadState('error')
        return
      }

      // Создаём превью
      const preview = URL.createObjectURL(file)
      setPreviewUrl(preview)
      setUploadState('uploading')
      setErrorMessage(null)

      try {
        const formData = new FormData()
        formData.append('file', file)
        if (config.category) {
          formData.append('category', config.category)
        }

        const response = await fetch(config.endpoint, {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Ошибка загрузки')
        }

        if (result.url) {
          // Вставляем изображение в редактор
          editor.chain().focus().setImage({ src: result.url }).run()
          handleClose()
        } else {
          throw new Error('URL изображения не получен')
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Ошибка загрузки')
        setUploadState('error')
      } finally {
        // Очищаем превью URL
        if (preview) {
          URL.revokeObjectURL(preview)
        }
      }
    },
    [editor, config, maxSize]
  )

  /**
   * Обработка выбора файла через input
   */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleUpload(file)
      }
      // Сбрасываем input для повторного выбора того же файла
      e.target.value = ''
    },
    [handleUpload]
  )

  /**
   * Обработка drop события
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        handleUpload(file)
      }
    },
    [handleUpload]
  )

  /**
   * Закрытие popover и сброс состояния
   */
  const handleClose = useCallback(() => {
    setIsOpen(false)
    setUploadState('idle')
    setErrorMessage(null)
    setPreviewUrl(null)
    setIsDragging(false)
  }, [])

  /**
   * Повторная попытка после ошибки
   */
  const handleRetry = useCallback(() => {
    setUploadState('idle')
    setErrorMessage(null)
    setPreviewUrl(null)
  }, [])

  return (
    <Popover.Root open={isOpen} onOpenChange={(details) => setIsOpen(details.open)}>
      <Popover.Trigger asChild>
        <IconButton
          aria-label="Вставить изображение"
          size="sm"
          variant="ghost"
          onClick={() => setIsOpen(true)}
          disabled={disabled}
        >
          <LuImage />
        </IconButton>
      </Popover.Trigger>

      <Portal>
        <Popover.Positioner>
          <Popover.Content width="320px">
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body p={3}>
              {/* Состояние: idle - зона загрузки */}
              {uploadState === 'idle' && (
                <VStack gap={3} align="stretch">
                  <Box
                    p={6}
                    borderWidth="2px"
                    borderStyle="dashed"
                    borderColor={isDragging ? 'colorPalette.500' : 'border'}
                    borderRadius="md"
                    bg={isDragging ? 'colorPalette.50' : 'bg.subtle'}
                    transition="all 0.2s"
                    cursor="pointer"
                    _hover={{ borderColor: 'colorPalette.400' }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      setIsDragging(false)
                    }}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Center>
                      <VStack gap={2}>
                        <Icon fontSize="2xl" color="fg.muted">
                          <LuUpload />
                        </Icon>
                        <Text fontSize="sm" fontWeight="medium" textAlign="center">
                          Перетащите изображение сюда
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                          или нажмите для выбора
                        </Text>
                      </VStack>
                    </Center>
                  </Box>

                  <Text fontSize="xs" color="fg.muted" textAlign="center">
                    PNG, JPG, WEBP до {(maxSize / 1024 / 1024).toFixed(0)}MB
                  </Text>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptTypes.join(',')}
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />

                  <HStack justify="flex-end">
                    <Button size="sm" variant="ghost" onClick={handleClose}>
                      Отмена
                    </Button>
                  </HStack>
                </VStack>
              )}

              {/* Состояние: uploading - загрузка */}
              {uploadState === 'uploading' && (
                <VStack gap={3} align="stretch">
                  {previewUrl && (
                    <Box borderRadius="md" overflow="hidden" bg="bg.subtle">
                      <Image src={previewUrl} alt="Превью" maxH="150px" w="100%" objectFit="contain" />
                    </Box>
                  )}
                  <Center py={2}>
                    <HStack gap={2}>
                      <Spinner size="sm" color="colorPalette.500" />
                      <Text fontSize="sm" color="fg.muted">
                        Загрузка...
                      </Text>
                    </HStack>
                  </Center>
                </VStack>
              )}

              {/* Состояние: error - ошибка */}
              {uploadState === 'error' && (
                <VStack gap={3} align="stretch">
                  {previewUrl && (
                    <Box borderRadius="md" overflow="hidden" bg="bg.subtle" position="relative">
                      <Image src={previewUrl} alt="Превью" maxH="150px" w="100%" objectFit="contain" opacity={0.5} />
                      <Center position="absolute" inset={0} bg="blackAlpha.500" borderRadius="md">
                        <Icon color="red.400" fontSize="2xl">
                          <LuX />
                        </Icon>
                      </Center>
                    </Box>
                  )}
                  <Text fontSize="sm" color="red.400" textAlign="center">
                    {errorMessage}
                  </Text>
                  <HStack justify="center" gap={2}>
                    <Button size="sm" variant="ghost" onClick={handleClose}>
                      Отмена
                    </Button>
                    <Button size="sm" colorPalette="brand" onClick={handleRetry}>
                      Попробовать снова
                    </Button>
                  </HStack>
                </VStack>
              )}
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}

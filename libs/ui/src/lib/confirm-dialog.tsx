'use client'

import { Button, CloseButton, Dialog, Portal, Text, VStack } from '@chakra-ui/react'
import { type ReactNode } from 'react'

type ColorPalette = 'red' | 'green' | 'yellow' | 'blue' | 'orange' | 'brand' | 'gray'

export interface ConfirmDialogProps {
  /**
   * Состояние открытия диалога
   */
  isOpen: boolean
  /**
   * Callback при закрытии диалога
   */
  onClose: () => void
  /**
   * Callback при подтверждении
   */
  onConfirm: () => void
  /**
   * Заголовок диалога
   */
  title: string
  /**
   * Описание действия (можно передать ReactNode для кастомного контента)
   */
  description?: ReactNode
  /**
   * Текст кнопки подтверждения
   * @default 'Подтвердить'
   */
  confirmText?: string
  /**
   * Текст кнопки отмены
   * @default 'Отмена'
   */
  cancelText?: string
  /**
   * Цвет кнопки подтверждения
   * @default 'red'
   */
  colorPalette?: ColorPalette
  /**
   * Состояние загрузки (блокирует кнопки)
   */
  isPending?: boolean
  /**
   * Закрывать диалог после подтверждения
   * @default true
   */
  closeOnConfirm?: boolean
}

/**
 * Универсальный диалог подтверждения
 *
 * @example
 * ```tsx
 * // Простое использование
 * <ConfirmDialog
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onConfirm={handleDelete}
 *   title="Удалить запись?"
 *   description="Это действие нельзя отменить."
 * />
 *
 * // С кастомными настройками
 * <ConfirmDialog
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onConfirm={handleRestore}
 *   title="Восстановить запись?"
 *   description="Запись будет восстановлена из архива."
 *   confirmText="Восстановить"
 *   colorPalette="green"
 * />
 * ```
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  colorPalette = 'red',
  isPending,
  closeOnConfirm = true,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    if (closeOnConfirm) {
      onClose()
    }
  }

  return (
    <Dialog.Root
      role="alertdialog"
      open={isOpen}
      onOpenChange={(e) => !e.open && onClose()}
      size={{ base: 'full', md: 'sm' }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>

            {description && (
              <Dialog.Body>
                {typeof description === 'string' ? (
                  <Text color="fg.muted">{description}</Text>
                ) : (
                  <VStack align="stretch" gap={2}>
                    {description}
                  </VStack>
                )}
              </Dialog.Body>
            )}

            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline" disabled={isPending}>
                  {cancelText}
                </Button>
              </Dialog.ActionTrigger>
              <Button colorPalette={colorPalette} onClick={handleConfirm} loading={isPending}>
                {confirmText}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

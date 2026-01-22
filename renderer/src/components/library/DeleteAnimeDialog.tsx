'use client'

import { Box, Button, CloseButton, Dialog, HStack, Icon, Portal, Text, VStack } from '@chakra-ui/react'
import { LuTrash2, LuTriangleAlert } from 'react-icons/lu'

import { AnimatronaForm, DeleteAnimeSchema, deleteAnimeDefaults, type DeleteAnimeFormData } from '@/animatrona-form'
import { toaster } from '@/components/ui/toaster'
import { useDeleteAnimeWithFiles } from '@/lib/hooks/use-delete-anime'

interface DeleteAnimeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  anime: {
    id: string
    name: string
    episodeCount: number
    /** Путь к папке аниме в библиотеке (сохраняется в БД при создании) */
    folderPath: string | null
  }
  onDeleted?: () => void
}

/**
 * Диалог подтверждения удаления аниме
 * Мигрировано на AnimatronaForm
 */
export function DeleteAnimeDialog({ open, onOpenChange, anime, onDeleted }: DeleteAnimeDialogProps) {
  const { deleteAnime, isDeleting } = useDeleteAnimeWithFiles()

  // folderPath берётся напрямую из БД — не нужно вычислять!
  const animeFolderPath = anime.folderPath
  const hasFilesToDelete = !!animeFolderPath

  const handleSubmit = async (data: DeleteAnimeFormData) => {
    const result = await deleteAnime({
      animeId: anime.id,
      animeFolderPath: data.deleteFiles ? animeFolderPath : null,
      moveToTrash: data.moveToTrash,
    })

    if (result.success) {
      toaster.success({
        title: 'Аниме удалено',
        description: data.deleteFiles && result.deletedFolders > 0 ? `Папка аниме удалена` : 'Файлы оставлены на диске',
      })
      onOpenChange(false)
      onDeleted?.()
    } else {
      toaster.error({
        title: 'Ошибка удаления',
        description: result.errors.join('\n'),
      })
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                <HStack>
                  <Icon as={LuTriangleAlert} color="red.500" />
                  <Text>Удалить аниме?</Text>
                </HStack>
              </Dialog.Title>
            </Dialog.Header>

            <AnimatronaForm initialValue={deleteAnimeDefaults} schema={DeleteAnimeSchema} onSubmit={handleSubmit}>
              <Dialog.Body>
                <VStack gap={4} align="stretch">
                  <Box p={4} bg="bg.subtle" borderRadius="md">
                    <Text fontWeight="bold" fontSize="lg">
                      {anime.name}
                    </Text>
                    <Text color="fg.muted" fontSize="sm">
                      {anime.episodeCount} эпизодов
                    </Text>
                  </Box>

                  <VStack gap={2} align="stretch">
                    <AnimatronaForm.Field.Switch
                      name="deleteFiles"
                      label={
                        <>
                          Удалить файлы с диска
                          {!hasFilesToDelete && (
                            <Text as="span" color="fg.subtle" fontSize="sm" ml={2}>
                              (нет файлов)
                            </Text>
                          )}
                        </>
                      }
                      disabled={!hasFilesToDelete}
                    />

                    <AnimatronaForm.When field="deleteFiles" is={true}>
                      <Box pl={6}>
                        <AnimatronaForm.Field.Switch name="moveToTrash" label="В корзину (можно восстановить)" />
                      </Box>
                    </AnimatronaForm.When>
                  </VStack>

                  {/* Предупреждение о безвозвратном удалении */}
                  <AnimatronaForm.When field="deleteFiles" is={true}>
                    <AnimatronaForm.When field="moveToTrash" is={false}>
                      <Box p={3} bg="red.900" borderRadius="md">
                        <HStack>
                          <Icon as={LuTriangleAlert} color="red.300" />
                          <Text color="red.200" fontSize="sm">
                            Файлы будут удалены безвозвратно!
                          </Text>
                        </HStack>
                      </Box>
                    </AnimatronaForm.When>
                  </AnimatronaForm.When>
                </VStack>
              </Dialog.Body>

              <Dialog.Footer>
                <HStack gap={2}>
                  <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isDeleting}>
                    Отмена
                  </Button>
                  <AnimatronaForm.Button.Submit colorPalette="red" disabled={isDeleting}>
                    <Icon as={LuTrash2} mr={2} />
                    {isDeleting ? 'Удаление...' : 'Удалить'}
                  </AnimatronaForm.Button.Submit>
                </HStack>
              </Dialog.Footer>
            </AnimatronaForm>

            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

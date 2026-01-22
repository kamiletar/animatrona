'use client'

/**
 * Карточка настроек библиотеки (папки)
 */

import { Box, Button, Card, Heading, HStack, Icon, Text, VStack } from '@chakra-ui/react'
import { LuFolderOpen } from 'react-icons/lu'

import type { Settings } from '@/generated/prisma'

import type { DefaultPaths } from './types'

interface LibrarySettingsCardProps {
  settings: Settings | null | undefined
  defaultPaths: DefaultPaths | null
  onSave: (field: string, value: unknown) => void
}

/**
 * Настройки библиотеки (папки хранения)
 */
export function LibrarySettingsCard({ settings, defaultPaths, onSave }: LibrarySettingsCardProps) {
  const handleSelectFolder = async (field: 'libraryPath' | 'outputPath') => {
    const folder = await window.electronAPI?.dialog.selectFolder()
    if (folder) {
      onSave(field, folder)
    }
  }

  return (
    <Card.Root bg="bg.panel" border="1px" borderColor="border.subtle">
      <Card.Header>
        <HStack gap={3}>
          <Icon as={LuFolderOpen} color="purple.400" boxSize={5} />
          <Heading size="md">Библиотека</Heading>
        </HStack>
      </Card.Header>
      <Card.Body>
        <VStack gap={4} align="stretch">
          {/* Папка библиотеки */}
          <Box>
            <Text fontSize="sm" color="fg.subtle" mb={2}>
              Папка библиотеки
            </Text>
            <HStack>
              <Box flex={1} p={3} bg="bg.subtle" borderRadius="md">
                {settings?.libraryPath ? <Text color="fg">{settings.libraryPath}</Text> : (
                  <VStack align="start" gap={0}>
                    <Text color="fg.muted" fontSize="sm">
                      {defaultPaths?.libraryPath || 'Загрузка...'}
                    </Text>
                    <Text color="fg.subtle" fontSize="xs">
                      (по умолчанию)
                    </Text>
                  </VStack>
                )}
              </Box>
              <Button variant="outline" onClick={() => handleSelectFolder('libraryPath')}>
                Выбрать
              </Button>
            </HStack>
          </Box>

          {/* Папка транскодирования */}
          <Box>
            <Text fontSize="sm" color="fg.subtle" mb={2}>
              Папка для транскодирования
            </Text>
            <HStack>
              <Box flex={1} p={3} bg="bg.subtle" borderRadius="md">
                {settings?.outputPath
                  ? <Text color="fg">{settings.outputPath}</Text>
                  : (
                    <VStack align="start" gap={0}>
                      <Text color="fg.muted" fontSize="sm">
                        {defaultPaths?.outputPath || 'Загрузка...'}
                      </Text>
                      <Text color="fg.subtle" fontSize="xs">
                        (по умолчанию)
                      </Text>
                    </VStack>
                  )}
              </Box>
              <Button variant="outline" onClick={() => handleSelectFolder('outputPath')}>
                Выбрать
              </Button>
            </HStack>
          </Box>
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}

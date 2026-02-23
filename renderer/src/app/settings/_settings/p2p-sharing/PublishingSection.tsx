'use client'

/**
 * Секция публикации библиотеки
 */

import {
  Badge,
  Box,
  Button,
  Switch as ChakraSwitch,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  Progress,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { LuCloudUpload } from 'react-icons/lu'

import type { useP2PSharing } from '../use-p2p-sharing'
import { formatDate } from './format-utils'

interface PublishingSectionProps {
  publisher: ReturnType<typeof useP2PSharing>['publisher']
  ipfsRunning: boolean
  onUpdateConfig: (updates: { libraryName?: string; enabled?: boolean; autoPublish?: boolean }) => Promise<void>
  onPublish: () => Promise<unknown>
}

export function PublishingSection({ publisher, ipfsRunning, onUpdateConfig, onPublish }: PublishingSectionProps) {
  const [libraryName, setLibraryName] = useState(publisher.config?.libraryName || '')

  // Синхронизация с config когда он загружается
  useEffect(() => {
    if (publisher.config?.libraryName && !libraryName) {
      setLibraryName(publisher.config.libraryName)
    }
  }, [publisher.config?.libraryName, libraryName])

  const handleSaveName = () => {
    if (libraryName.trim() && libraryName !== publisher.config?.libraryName) {
      void onUpdateConfig({ libraryName: libraryName.trim() })
    }
  }

  return (
    <Box>
      <HStack mb={4} gap={3}>
        <Icon as={LuCloudUpload} color="blue.400" boxSize={5} />
        <Heading size="sm">Публикация библиотеки</Heading>
        {publisher.animeCount > 0 && (
          <Badge colorPalette="blue" size="sm">
            {publisher.animeCount} аниме • {publisher.episodeCount} эп.
          </Badge>
        )}
      </HStack>

      {!ipfsRunning ? (
        <Text color="fg.subtle">Запустите IPFS ноду для публикации</Text>
      ) : publisher.isLoading ? (
        <Text color="fg.subtle">Загрузка...</Text>
      ) : publisher.animeCount === 0 ? (
        <Box p={3} bg="orange.subtle" borderRadius="md">
          <Text fontSize="sm" color="orange.fg">
            Нет аниме для публикации. Импортируйте контент через очередь кодирования.
          </Text>
        </Box>
      ) : (
        <VStack align="stretch" gap={4}>
          {/* Название библиотеки */}
          <Box>
            <Text fontSize="sm" color="fg.subtle" mb={2}>
              Название библиотеки
            </Text>
            <HStack>
              <Input
                size="sm"
                value={libraryName}
                onChange={(e) => setLibraryName(e.target.value)}
                placeholder="Моя библиотека"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveName}
                disabled={!libraryName.trim() || libraryName === publisher.config?.libraryName}
              >
                Сохранить
              </Button>
            </HStack>
          </Box>

          {/* Переключатели */}
          <Flex justify="space-between" align="center">
            <VStack align="start" gap={0}>
              <Text fontSize="sm">Включить публикацию</Text>
              <Text fontSize="xs" color="fg.subtle">
                Ваша библиотека будет доступна другим пользователям
              </Text>
            </VStack>
            <ChakraSwitch.Root
              checked={publisher.config?.enabled ?? false}
              onCheckedChange={(e) => void onUpdateConfig({ enabled: e.checked })}
            >
              <ChakraSwitch.HiddenInput />
              <ChakraSwitch.Control />
            </ChakraSwitch.Root>
          </Flex>

          <Flex justify="space-between" align="center">
            <VStack align="start" gap={0}>
              <Text fontSize="sm">Автопубликация</Text>
              <Text fontSize="xs" color="fg.subtle">
                Автоматически публиковать при добавлении нового контента
              </Text>
            </VStack>
            <ChakraSwitch.Root
              checked={publisher.config?.autoPublish ?? false}
              onCheckedChange={(e) => void onUpdateConfig({ autoPublish: e.checked })}
              disabled={!publisher.config?.enabled}
            >
              <ChakraSwitch.HiddenInput />
              <ChakraSwitch.Control />
            </ChakraSwitch.Root>
          </Flex>

          {/* Прогресс публикации */}
          {publisher.isPublishing && publisher.progress && (
            <Box p={3} bg="bg.subtle" borderRadius="md">
              <Text fontSize="sm" mb={2}>
                {publisher.progress.stage === 'loading' && 'Загрузка данных из БД...'}
                {publisher.progress.stage === 'generating' && 'Генерация манифеста...'}
                {publisher.progress.stage === 'publishing' && 'Публикация IPNS...'}
              </Text>
              <Progress.Root value={(publisher.progress.current / publisher.progress.total) * 100} size="sm">
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
              <Text fontSize="xs" color="fg.subtle" mt={1}>
                {publisher.progress.current} / {publisher.progress.total}
              </Text>
            </Box>
          )}

          {/* Информация о публикации */}
          {publisher.config?.lastPublishedCid && (
            <Box p={3} bg="bg.subtle" borderRadius="md">
              <Text fontSize="xs" color="fg.subtle" mb={1}>
                Последняя публикация
              </Text>
              <Text fontFamily="mono" fontSize="xs" color="fg.muted" wordBreak="break-all">
                {publisher.config.lastPublishedCid}
              </Text>
              <Text fontSize="xs" color="fg.subtle" mt={1}>
                {formatDate(publisher.config.lastPublishedAt)}
              </Text>
            </Box>
          )}

          {/* Кнопка публикации */}
          <Button
            size="sm"
            colorPalette="blue"
            onClick={onPublish}
            loading={publisher.isPublishing}
            disabled={!publisher.config?.enabled}
          >
            <Icon as={LuCloudUpload} mr={2} />
            Опубликовать сейчас
          </Button>
        </VStack>
      )}
    </Box>
  )
}

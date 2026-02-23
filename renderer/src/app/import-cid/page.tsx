'use client'

/**
 * Страница импорта аниме по CID из IPFS
 *
 * Позволяет ввести CID манифеста, просмотреть превью и импортировать в библиотеку.
 */

import {
  Badge,
  Box,
  Button,
  Card,
  Heading,
  HStack,
  Icon,
  Input,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { LuCalendar, LuDownload, LuFilm, LuSearch, LuTag } from 'react-icons/lu'

import { Header } from '@/components/layout'
import { toaster } from '@/components/ui/toaster'
import type { AnimeManifest, AnimeManifestGenre, AnimeManifestStudio } from '@/types/electron'

// Отключаем статическую генерацию
export const dynamic = 'force-dynamic'

/**
 * Страница импорта аниме по CID
 */
export default function ImportCidPage() {
  const router = useRouter()

  // State
  const [cidInput, setCidInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [manifest, setManifest] = useState<AnimeManifest | null>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * Загрузить превью манифеста из IPFS
   */
  const handlePreview = useCallback(async () => {
    const cid = cidInput.trim()
    if (!cid) {
      setError('Введите CID манифеста')
      return
    }

    setIsLoading(true)
    setError(null)
    setManifest(null)

    try {
      if (!window.electron) {
        setError('Electron API недоступен')
        return
      }
      const result = await window.electron.animeManifest.get(cid)
      if (!result.success || !result.data) {
        setError(result.error || 'Не удалось загрузить манифест')
        return
      }
      setManifest(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setIsLoading(false)
    }
  }, [cidInput])

  /**
   * Импортировать аниме в библиотеку
   */
  const handleImport = useCallback(async () => {
    const cid = cidInput.trim()
    if (!cid || !manifest) return

    setIsImporting(true)

    try {
      if (!window.electron) {
        toaster.error({ title: 'Electron API недоступен' })
        return
      }
      const result = await window.electron.animeManifest.import(cid)
      if (!result.success || !result.data) {
        toaster.error({
          title: 'Ошибка импорта',
          description: result.error || 'Не удалось импортировать аниме',
        })
        return
      }

      toaster.success({
        title: 'Импорт завершён',
        description: `${result.data.animeName} (${result.data.episodeCount} эпизодов)`,
      })

      // Перейти к импортированному аниме
      router.push(`/library/${result.data.animeId}`)
    } catch (err) {
      toaster.error({
        title: 'Ошибка импорта',
        description: err instanceof Error ? err.message : 'Неизвестная ошибка',
      })
    } finally {
      setIsImporting(false)
    }
  }, [cidInput, manifest, router])

  /**
   * Обработка Enter в поле ввода
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading) {
        handlePreview()
      }
    },
    [handlePreview, isLoading],
  )

  return (
    <Box minH="100vh" bg="bg" color="fg">
      <Header title="Импорт по CID" />

      <Box p={6} maxW="800px" mx="auto">
        <VStack gap={6} align="stretch">
          {/* Заголовок */}
          <VStack gap={2} align="start">
            <Heading size="lg">Импорт аниме из IPFS</Heading>
            <Text color="fg.muted">
              Введите CID манифеста, чтобы импортировать аниме в библиотеку для стриминга.
            </Text>
          </VStack>

          {/* Поле ввода CID */}
          <Card.Root>
            <Card.Body>
              <VStack gap={4} align="stretch">
                <Text fontWeight="medium">CID манифеста</Text>
                <HStack gap={3}>
                  <Input
                    placeholder="bafy... или Qm..."
                    value={cidInput}
                    onChange={(e) => setCidInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    fontFamily="mono"
                    flex={1}
                  />
                  <Button colorPalette="purple" onClick={handlePreview} loading={isLoading}>
                    <Icon as={LuSearch} mr={2} />
                    Превью
                  </Button>
                </HStack>
                {error && <Text color="red.500">{error}</Text>}
              </VStack>
            </Card.Body>
          </Card.Root>

          {/* Превью манифеста */}
          {manifest && (
            <Card.Root>
              <Card.Header>
                <Heading size="md">Превью</Heading>
              </Card.Header>
              <Card.Body>
                <VStack gap={4} align="stretch">
                  {/* Название и год */}
                  <Box>
                    <Heading size="lg">{manifest.name}</Heading>
                    {manifest.originalName && (
                      <Text color="fg.muted" fontSize="md">
                        {manifest.originalName}
                      </Text>
                    )}
                  </Box>

                  {/* Мета-информация */}
                  <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
                    {manifest.year && (
                      <HStack>
                        <Icon as={LuCalendar} color="fg.muted" />
                        <Text>{manifest.year}</Text>
                      </HStack>
                    )}
                    {manifest.episodeCount && (
                      <HStack>
                        <Icon as={LuFilm} color="fg.muted" />
                        <Text>{manifest.episodeCount} эпизодов</Text>
                      </HStack>
                    )}
                    {manifest.status && (
                      <HStack>
                        <Badge colorPalette={manifest.status === 'COMPLETED' ? 'green' : 'blue'}>
                          {manifest.status === 'COMPLETED' ? 'Завершён' : 'Онгоинг'}
                        </Badge>
                      </HStack>
                    )}
                  </SimpleGrid>

                  {/* Жанры */}
                  {manifest.genres && manifest.genres.length > 0 && (
                    <Box>
                      <HStack mb={2}>
                        <Icon as={LuTag} color="fg.muted" />
                        <Text fontWeight="medium">Жанры</Text>
                      </HStack>
                      <HStack flexWrap="wrap" gap={2}>
                        {manifest.genres.map((g: AnimeManifestGenre) => (
                          <Badge key={g.name} variant="outline">
                            {g.nameRu || g.name}
                          </Badge>
                        ))}
                      </HStack>
                    </Box>
                  )}

                  {/* Описание */}
                  {manifest.description && (
                    <Box>
                      <Text fontWeight="medium" mb={2}>
                        Описание
                      </Text>
                      <Text color="fg.muted" lineClamp={4}>
                        {manifest.description}
                      </Text>
                    </Box>
                  )}

                  {/* Студии */}
                  {manifest.studios && manifest.studios.length > 0 && (
                    <Box>
                      <Text fontWeight="medium" mb={1}>
                        Студии
                      </Text>
                      <Text color="fg.muted">
                        {manifest.studios.map((s: AnimeManifestStudio) => s.name).join(', ')}
                      </Text>
                    </Box>
                  )}

                  {/* Озвучка */}
                  {manifest.fandubbers && manifest.fandubbers.length > 0 && (
                    <Box>
                      <Text fontWeight="medium" mb={1}>
                        Озвучка
                      </Text>
                      <Text color="fg.muted">{manifest.fandubbers.join(', ')}</Text>
                    </Box>
                  )}
                </VStack>
              </Card.Body>
              <Card.Footer>
                <HStack justify="flex-end" w="full">
                  <Button colorPalette="green" onClick={handleImport} loading={isImporting}>
                    {isImporting
                      ? (
                        <>
                          <Spinner size="sm" mr={2} />
                          Импорт...
                        </>
                      )
                      : (
                        <>
                          <Icon as={LuDownload} mr={2} />
                          Импортировать в библиотеку
                        </>
                      )}
                  </Button>
                </HStack>
              </Card.Footer>
            </Card.Root>
          )}

          {/* Загрузка */}
          {isLoading && (
            <Card.Root>
              <Card.Body>
                <HStack justify="center" py={8}>
                  <Spinner size="lg" color="purple.500" />
                  <Text>Загрузка манифеста из IPFS...</Text>
                </HStack>
              </Card.Body>
            </Card.Root>
          )}
        </VStack>
      </Box>
    </Box>
  )
}

'use client'

/**
 * Шаг 3: Сканирование файлов в папке
 */

import { Box, Button, Checkbox, HStack, Icon, NativeSelect, Spinner, Table, Text, VStack } from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuFileVideo, LuHash, LuRefreshCw } from 'react-icons/lu'

import { formatFileSize } from '@/lib/format-utils'
import { parseEpisodeInfo, type EpisodeType, type ParsedEpisodeInfo } from '@/lib/parse-filename'
import type { MediaFileInfo } from '@/types/electron'

// Реэкспорт типов для обратной совместимости
export type { EpisodeType, ParsedEpisodeInfo }

/** Результат парсинга номера эпизода */
export interface ParsedFile extends MediaFileInfo {
  episodeNumber: number | null
  episodeType: EpisodeType
  selected: boolean
}

interface FileScanStepProps {
  folderPath: string
  files: ParsedFile[]
  onFilesChange: (files: ParsedFile[]) => void
  /** Режим одиночного файла (для фильмов) */
  isFileMode?: boolean
  /** Путь к выбранному файлу */
  singleFilePath?: string | null
  /** Количество эпизодов из Shikimori */
  episodesCount?: number
}

/**
 * Шаг сканирования файлов
 */
export function FileScanStep({
  folderPath,
  files,
  onFilesChange,
  isFileMode,
  singleFilePath,
  episodesCount,
}: FileScanStepProps) {
  const [isScanning, setIsScanning] = useState(false)

  /** Номера эпизодов, которые уже заняты другими файлами */
  const usedEpisodes = useMemo(() => {
    const used = new Set<number>()
    files.forEach((f) => {
      if (f.episodeNumber !== null) {
        used.add(f.episodeNumber)
      }
    })
    return used
  }, [files])

  /** Максимальный номер эпизода для опций */
  const maxEpisode = useMemo(() => {
    // Если известно количество эпизодов из Shikimori — ограничиваем им
    // Добавляем запас +3 для возможных спешлов/превью
    // Минимум: количество файлов или 12 (для коротких сезонов)
    const fromShikimori = episodesCount || 0
    const fromFiles = files.length

    if (fromShikimori > 0) {
      // Есть данные из Shikimori — используем их + небольшой запас
      return Math.max(fromShikimori + 3, fromFiles, 12)
    }
    // Нет данных — используем количество файлов * 1.5 или минимум 24
    return Math.max(Math.ceil(fromFiles * 1.5), 24)
  }, [episodesCount, files.length])

  /** Изменение номера эпизода */
  const handleEpisodeChange = useCallback(
    (index: number, value: string) => {
      const episodeNumber = value === '' ? null : parseInt(value, 10)
      const newFiles = files.map((f, i) =>
        i === index
          ? {
              ...f,
              episodeNumber,
              // Автоматически выбираем при назначении номера
              selected: episodeNumber !== null ? true : f.selected,
            }
          : f
      )
      onFilesChange(newFiles)
    },
    [files, onFilesChange]
  )

  /** Автонумерация всех файлов */
  const handleAutoNumber = useCallback(() => {
    // Определяем начальный номер из спарсенных (если есть 0 — начинаем с 0)
    const parsedNumbers = files.map((f) => f.episodeNumber).filter((n): n is number => n !== null)
    const startFrom = parsedNumbers.length > 0 ? Math.min(...parsedNumbers) : 1
    // Если минимальный номер > 1 (например, сезон начинается с 13), всё равно нумеруем с 1
    const effectiveStart = startFrom === 0 ? 0 : 1

    // Сортируем по имени файла (числовая сортировка)
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    const numbered = sorted.map((file, i) => ({
      ...file,
      episodeNumber: effectiveStart + i,
      selected: true,
    }))
    onFilesChange(numbered)
  }, [files, onFilesChange])

  /** Сканировать папку или создать запись для одиночного файла */
  const scanFolder = useCallback(async () => {
    if (!window.electronAPI) {
      console.error('Electron API недоступен')
      return
    }

    setIsScanning(true)
    try {
      // Режим одиночного файла (фильм)
      if (isFileMode && singleFilePath) {
        const lastSlash = Math.max(singleFilePath.lastIndexOf('/'), singleFilePath.lastIndexOf('\\'))
        const fileName = singleFilePath.substring(lastSlash + 1)
        const stat = await window.electronAPI.fs.stat(singleFilePath)

        const parsed: ParsedFile[] = [
          {
            path: singleFilePath,
            name: fileName,
            size: stat.success ? stat.size : 0,
            extension: fileName.split('.').pop() || '',
            episodeNumber: 1, // Фильм = эпизод 1
            episodeType: 'movie',
            selected: true,
          },
        ]

        onFilesChange(parsed)
        return
      }

      // Обычный режим — сканируем папку
      const result = await window.electronAPI.fs.scanFolder(folderPath, true)
      if (result.success) {
        let parsed: ParsedFile[] = result.files
          .map((file) => {
            const episodeInfo = parseEpisodeInfo(file.name)
            return {
              ...file,
              episodeNumber: episodeInfo?.number ?? null,
              episodeType: episodeInfo?.type ?? 'regular',
              selected: episodeInfo?.type === 'regular', // По умолчанию выбраны только обычные эпизоды
            }
          })
          .sort((a, b) => {
            // Сначала сортируем по типу (regular первые)
            if (a.episodeType !== b.episodeType) {
              return a.episodeType === 'regular' ? -1 : 1
            }
            // Затем по номеру
            if (a.episodeNumber === null && b.episodeNumber === null) {
              return 0
            }
            if (a.episodeNumber === null) {
              return 1
            }
            if (b.episodeNumber === null) {
              return -1
            }
            return a.episodeNumber - b.episodeNumber
          })

        // Автоопределение фильма: если 1 файл без номера эпизода → фильм
        if (parsed.length === 1 && parsed[0].episodeNumber === null) {
          parsed = [
            {
              ...parsed[0],
              episodeNumber: 1,
              episodeType: 'movie',
              selected: true,
            },
          ]
        }

        onFilesChange(parsed)
      }
    } catch (error) {
      console.error('Ошибка сканирования:', error)
    } finally {
      setIsScanning(false)
    }
  }, [folderPath, onFilesChange, isFileMode, singleFilePath])

  /** Автоматическое сканирование при монтировании */
  useEffect(() => {
    if (files.length === 0) {
      scanFolder()
    }
  }, [files.length, scanFolder])

  /** Переключить выбор файла */
  const toggleFile = useCallback(
    (index: number) => {
      const newFiles = files.map((f, i) => (i === index ? { ...f, selected: !f.selected } : f))
      onFilesChange(newFiles)
    },
    [files, onFilesChange]
  )

  /** Выбрать только сериал */
  const selectOnlySeries = useCallback(() => {
    const newFiles = files.map((f) => ({
      ...f,
      selected: f.episodeNumber !== null && f.episodeType === 'regular',
    }))
    onFilesChange(newFiles)
  }, [files, onFilesChange])

  /** Выбрать только спешлы */
  const selectOnlyOva = useCallback(() => {
    const newFiles = files.map((f) => ({
      ...f,
      selected: f.episodeNumber !== null && f.episodeType === 'ova',
    }))
    onFilesChange(newFiles)
  }, [files, onFilesChange])

  const selectedCount = files.filter((f) => f.selected && f.episodeNumber !== null).length
  const totalWithNumbers = files.filter((f) => f.episodeNumber !== null).length

  // Группировка файлов по типу
  const regularFiles = files.filter((f) => f.episodeType === 'regular' && f.episodeNumber !== null)
  const ovaFiles = files.filter((f) => f.episodeType === 'ova' && f.episodeNumber !== null)
  const movieFiles = files.filter((f) => f.episodeType === 'movie' && f.episodeNumber !== null)
  const hasOvaFiles = ovaFiles.length > 0
  const hasRegularFiles = regularFiles.length > 0
  const hasMovieFiles = movieFiles.length > 0

  return (
    <VStack gap={4} align="stretch" py={4}>
      {/* Заголовок */}
      <HStack justify="space-between">
        <VStack align="start" gap={0}>
          <Text fontWeight="medium">Найдено файлов: {files.length}</Text>
          <Text fontSize="sm" color="fg.subtle">
            {hasMovieFiles && `Фильм: ${movieFiles.length}`}
            {hasMovieFiles && (hasRegularFiles || hasOvaFiles) && ' | '}
            {hasRegularFiles && `Сериал: ${regularFiles.length}`}
            {hasRegularFiles && hasOvaFiles && ' | '}
            {hasOvaFiles && `Спешлы: ${ovaFiles.length}`}
            {(hasRegularFiles || hasOvaFiles || hasMovieFiles) && ` | Выбрано: ${selectedCount}`}
          </Text>
        </VStack>

        <HStack gap={2}>
          {/* Быстрое переключение между сериалом и спешлами (не показываем для фильмов) */}
          {!isFileMode && hasRegularFiles && hasOvaFiles && (
            <HStack gap={1} bg="bg.subtle" p={1} borderRadius="md">
              <Button
                size="xs"
                variant={regularFiles.every((f) => f.selected) && !ovaFiles.some((f) => f.selected) ? 'solid' : 'ghost'}
                colorPalette="purple"
                onClick={selectOnlySeries}
              >
                Сериал
              </Button>
              <Button
                size="xs"
                variant={ovaFiles.every((f) => f.selected) && !regularFiles.some((f) => f.selected) ? 'solid' : 'ghost'}
                colorPalette="orange"
                onClick={selectOnlyOva}
              >
                Спешлы
              </Button>
            </HStack>
          )}
          {/* Кнопка автонумерации — не показываем для одиночного файла */}
          {!isFileMode && files.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleAutoNumber} title="Присвоить номера 1, 2, 3...">
              <Icon as={LuHash} mr={1} />
              Автонумерация
            </Button>
          )}
          {/* Кнопки выбрать/снять все — не показываем для одиночного файла */}
          {!isFileMode && (
            <HStack gap={1}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const newFiles = files.map((f) => (f.episodeNumber !== null ? { ...f, selected: true } : f))
                  onFilesChange(newFiles)
                }}
                disabled={totalWithNumbers === 0 || selectedCount === totalWithNumbers}
              >
                Выбрать все
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const newFiles = files.map((f) => ({ ...f, selected: false }))
                  onFilesChange(newFiles)
                }}
                disabled={selectedCount === 0}
              >
                Снять все
              </Button>
            </HStack>
          )}
          {/* Кнопка обновить — не показываем для одиночного файла */}
          {!isFileMode && (
            <Button size="sm" variant="outline" onClick={scanFolder} disabled={isScanning}>
              {isScanning ? <Spinner size="xs" /> : <Icon as={LuRefreshCw} />}
            </Button>
          )}
        </HStack>
      </HStack>

      {/* Подсказка с количеством эпизодов из Shikimori */}
      {episodesCount && episodesCount > 0 && (
        <Text fontSize="sm" color="fg.subtle">
          💡 По Shikimori: {episodesCount} эпизодов
        </Text>
      )}

      {/* Загрузка */}
      {isScanning && (
        <Box textAlign="center" py={8}>
          <Spinner size="lg" color="purple.500" />
          <Text mt={3} color="fg.subtle">
            Сканирование папки...
          </Text>
        </Box>
      )}

      {/* Таблица файлов */}
      {!isScanning && files.length > 0 && (
        <Box maxH="350px" overflowY="auto" borderWidth="1px" borderColor="border.subtle" borderRadius="md">
          <Table.Root size="sm" variant="line">
            <Table.Header>
              <Table.Row bg="bg.subtle">
                <Table.ColumnHeader w="40px" />
                <Table.ColumnHeader w="80px">#</Table.ColumnHeader>
                <Table.ColumnHeader>Файл</Table.ColumnHeader>
                <Table.ColumnHeader w="90px">Размер</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {files.map((file, index) => (
                <Table.Row key={file.path} _hover={{ bg: 'bg.subtle' }}>
                  <Table.Cell>
                    <Checkbox.Root checked={file.selected} onCheckedChange={() => toggleFile(index)}>
                      <Checkbox.HiddenInput />
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Root>
                  </Table.Cell>
                  <Table.Cell>
                    <NativeSelect.Root size="xs" width="70px" variant="outline">
                      <NativeSelect.Field
                        value={file.episodeNumber?.toString() ?? ''}
                        onChange={(e) => handleEpisodeChange(index, e.target.value)}
                      >
                        <option value="">—</option>
                        {/* Генерируем опции 0, 1, 2, ... maxEpisode (0 для прологов/нулевых эпизодов) */}
                        {Array.from({ length: maxEpisode + 1 }, (_, i) => i).map((num) => {
                          const isUsed = usedEpisodes.has(num) && file.episodeNumber !== num
                          return (
                            <option key={num} value={num} disabled={isUsed}>
                              {num === 0 ? '0 (пролог)' : num}
                              {isUsed ? ' ✗' : ''}
                            </option>
                          )
                        })}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Table.Cell>
                  <Table.Cell>
                    <HStack gap={2}>
                      <Icon
                        as={LuFileVideo}
                        color={
                          file.episodeType === 'movie'
                            ? 'blue.400'
                            : file.episodeType === 'ova'
                              ? 'orange.400'
                              : 'purple.400'
                        }
                        flexShrink={0}
                      />
                      <Text truncate maxW="350px" title={file.name}>
                        {file.name}
                      </Text>
                    </HStack>
                  </Table.Cell>
                  <Table.Cell color="fg.muted">{formatFileSize(file.size)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      )}

      {/* Предупреждение о спешлах */}
      {hasOvaFiles && hasRegularFiles && (
        <Box p={3} bg="orange.900/20" borderRadius="md" borderWidth="1px" borderColor="orange.800/50">
          <Text fontSize="sm" color="orange.400">
            ⚠️ В папке найдены и основной сериал, и спешлы (OVA). Спешлы по умолчанию не выбраны — их рекомендуется
            импортировать отдельно как другое аниме.
          </Text>
        </Box>
      )}

      {/* Пусто */}
      {!isScanning && files.length === 0 && (
        <Box textAlign="center" py={8}>
          <Icon as={LuFileVideo} boxSize={10} color="fg.subtle" mb={3} />
          <Text color="fg.subtle">Видеофайлы не найдены</Text>
          <Text fontSize="sm" color="fg.subtle">
            Убедитесь, что папка содержит файлы MKV, MP4 или AVI
          </Text>
        </Box>
      )}

      {/* Подсказка о файлах без номера */}
      {files.some((f) => f.episodeNumber === null) && (
        <Box p={3} bg="blue.900/20" borderRadius="md" borderWidth="1px" borderColor="blue.800/50">
          <Text fontSize="sm" color="blue.400">
            💡 Некоторые файлы не имеют распознанного номера эпизода. Выберите номер вручную в выпадающем списке или
            нажмите «Автонумерация» для присвоения номеров по порядку.
          </Text>
        </Box>
      )}
    </VStack>
  )
}

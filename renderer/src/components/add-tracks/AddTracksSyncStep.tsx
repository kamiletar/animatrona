'use client'

/**
 * Шаг 3: Калибровка синхронизации донора
 *
 * Адаптация SyncCalibrationStep для add-tracks flow.
 * Использует эпизоды из библиотеки (с transcodedPath) и файлы донора.
 */

import { Box, Button, createListCollection, HStack, Icon, Select, Text, VStack } from '@chakra-ui/react'
import { useCallback, useMemo, useState } from 'react'
import { LuInfo, LuPlay, LuRotateCcw } from 'react-icons/lu'

import { OffsetInput } from '../import/OffsetInput'
import { DualVideoPlayer } from '../player/DualVideoPlayer'

import type { LibraryEpisode } from '@/lib/add-tracks'
import type { EpisodeMatch } from '@/lib/add-tracks/episode-matcher'

interface AddTracksSyncStepProps {
  /** Сопоставления донор ↔ эпизод */
  matches: EpisodeMatch[]
  /** Эпизоды из библиотеки */
  libraryEpisodes: LibraryEpisode[]
  /** Текущее смещение в мс */
  syncOffset: number
  /** Callback при изменении смещения */
  onSyncOffsetChange: (offset: number) => void
}

/**
 * Получить URL для локального видеофайла
 * Использует кастомный media:// протокол Electron
 */
function getVideoUrl(filePath: string): string {
  // Кастомный media:// протокол для безопасного доступа к локальным файлам
  return `media://${filePath.replace(/\\/g, '/')}`
}

/**
 * Шаг калибровки синхронизации для add-tracks
 */
export function AddTracksSyncStep({
  matches,
  libraryEpisodes,
  syncOffset,
  onSyncOffsetChange,
}: AddTracksSyncStepProps) {
  // Выбранный эпизод для калибровки
  const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState(0)
  // Показывать плеер
  const [showPlayer, setShowPlayer] = useState(false)

  /**
   * Построить пары оригинал-донор из matches и libraryEpisodes
   */
  const matchedPairs = useMemo(() => {
    const pairs: Array<{
      original: LibraryEpisode
      donor: EpisodeMatch['donorFile']
      episodeNumber: number
    }> = []

    // Фильтруем только сопоставленные матчи
    const matchedOnly = matches.filter((m) => m.targetEpisode !== null)

    for (const match of matchedOnly) {
      // Находим эпизод библиотеки
      const episode = libraryEpisodes.find((e) => e.id === match.targetEpisode?.id)
      if (episode && episode.transcodedPath && match.donorFile.type === 'video') {
        pairs.push({
          original: episode,
          donor: match.donorFile,
          episodeNumber: match.donorFile.episodeNumber ?? 0,
        })
      }
    }

    return pairs.sort((a, b) => a.episodeNumber - b.episodeNumber)
  }, [matches, libraryEpisodes])

  /** Коллекция для Select */
  const episodeCollection = useMemo(() => {
    return createListCollection({
      items: matchedPairs.map((pair, index) => ({
        label: `Эпизод ${pair.episodeNumber}`,
        value: index.toString(),
      })),
    })
  }, [matchedPairs])

  /** Текущая пара */
  const currentPair = matchedPairs[selectedEpisodeIndex]

  /** Обработка изменения эпизода */
  const handleEpisodeChange = useCallback((value: string) => {
    const index = parseInt(value, 10)
    if (!isNaN(index)) {
      setSelectedEpisodeIndex(index)
    }
  }, [])

  /** Сброс смещения */
  const handleReset = useCallback(() => {
    onSyncOffsetChange(0)
  }, [onSyncOffsetChange])

  if (matchedPairs.length === 0) {
    return (
      <VStack gap={6} align="stretch" py={4}>
        <Box p={6} bg="bg.muted" borderRadius="lg" textAlign="center">
          <Icon as={LuInfo} boxSize={10} color="fg.subtle" mb={3} />
          <Text color="fg.muted">Нет видеофайлов для калибровки синхронизации.</Text>
          <Text fontSize="sm" color="fg.subtle" mt={2}>
            Калибровка требует видеофайлы донора и эпизоды с готовым видео в библиотеке.
          </Text>
        </Box>
      </VStack>
    )
  }

  return (
    <VStack gap={4} align="stretch" py={4}>
      {/* Инструкция */}
      <Box p={4} bg="primary.subtle" borderRadius="lg" borderWidth="1px" borderColor="primary.muted">
        <VStack gap={2} align="start">
          <Text fontWeight="medium" color="primary.fg">
            📐 Калибровка синхронизации
          </Text>
          <Text fontSize="sm" color="fg.muted">
            Сравните оригинал и донор визуально. Если они не совпадают, используйте стрелки ←/→ для подстройки смещения
            (±10мс), Shift+←/→ (±100мс), Ctrl+←/→ (±1000мс).
          </Text>
        </VStack>
      </Box>

      {/* Выбор эпизода и управление */}
      <HStack justify="space-between" flexWrap="wrap" gap={3}>
        <HStack gap={3}>
          <Text fontSize="sm" color="fg.muted">
            Эпизод для калибровки:
          </Text>
          <Select.Root
            collection={episodeCollection}
            value={[selectedEpisodeIndex.toString()]}
            onValueChange={(details) => handleEpisodeChange(details.value[0])}
            size="sm"
            width="150px"
          >
            <Select.Trigger>
              <Select.ValueText placeholder="Выберите эпизод" />
            </Select.Trigger>
            <Select.Positioner>
              <Select.Content>
                {episodeCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    <Select.ItemText>{item.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </HStack>

        <HStack gap={2}>
          <Button size="sm" variant="outline" onClick={handleReset} disabled={syncOffset === 0}>
            <Icon as={LuRotateCcw} mr={1} />
            Сбросить
          </Button>
          <Button size="sm" colorPalette="purple" onClick={() => setShowPlayer(!showPlayer)}>
            <Icon as={LuPlay} mr={1} />
            {showPlayer ? 'Скрыть плеер' : 'Открыть плеер'}
          </Button>
        </HStack>
      </HStack>

      {/* Поле ввода смещения */}
      <Box p={4} bg="bg.muted" borderRadius="lg" borderWidth="1px" borderColor="border">
        <OffsetInput
          value={syncOffset}
          onChange={onSyncOffsetChange}
          label="Смещение донора"
          hint={
            syncOffset === 0
              ? 'Синхронизация не требуется'
              : syncOffset > 0
                ? `Донор опережает на ${syncOffset}мс → обрезаем начало дорожек`
                : `Донор отстаёт на ${Math.abs(syncOffset)}мс → добавляем тишину в начало`
          }
          showButtons
        />
      </Box>

      {/* Плеер */}
      {showPlayer && currentPair && currentPair.original.transcodedPath && (
        <Box borderWidth="1px" borderColor="border" borderRadius="lg" overflow="hidden">
          <DualVideoPlayer
            originalPath={getVideoUrl(currentPair.original.transcodedPath)}
            donorPath={getVideoUrl(currentPair.donor.path)}
            offsetMs={syncOffset}
            onOffsetChange={onSyncOffsetChange}
            originalLabel={`Библиотека: Эп. ${currentPair.episodeNumber}`}
            donorLabel={`Донор: Эп. ${currentPair.episodeNumber}`}
          />
        </Box>
      )}

      {/* Информация о файлах */}
      {currentPair && (
        <Box p={3} bg="bg.muted" borderRadius="md">
          <VStack gap={2} align="stretch">
            <HStack justify="space-between">
              <Text fontSize="xs" color="fg.subtle">
                Библиотека:
              </Text>
              <Text fontSize="xs" color="fg.muted" truncate maxW="400px">
                {currentPair.original.transcodedPath?.split(/[/\\]/).pop() || 'Нет видео'}
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text fontSize="xs" color="fg.subtle">
                Донор:
              </Text>
              <Text fontSize="xs" color="primary.fg" truncate maxW="400px">
                {currentPair.donor.name}
              </Text>
            </HStack>
          </VStack>
        </Box>
      )}

      {/* Статистика */}
      <Box p={3} bg="bg.muted" borderRadius="md">
        <HStack justify="center" gap={6}>
          <VStack gap={0}>
            <Text fontSize="2xl" fontWeight="bold" color="status.success">
              {matchedPairs.length}
            </Text>
            <Text fontSize="xs" color="fg.subtle">
              эпизодов для калибровки
            </Text>
          </VStack>
          <VStack gap={0}>
            <Text
              fontSize="2xl"
              fontWeight="bold"
              fontFamily="mono"
              color={syncOffset === 0 ? 'fg.subtle' : syncOffset > 0 ? 'status.success' : 'status.warning'}
            >
              {syncOffset >= 0 ? '+' : ''}
              {syncOffset}
            </Text>
            <Text fontSize="xs" color="fg.subtle">
              мс смещение
            </Text>
          </VStack>
        </HStack>
      </Box>

      {/* Горячие клавиши */}
      {showPlayer && (
        <Box p={3} bg="bg.subtle" borderRadius="md">
          <Text fontSize="xs" color="fg.subtle" textAlign="center">
            <strong>Горячие клавиши:</strong> Space — play/pause • ←/→ — ±10мс • Shift+←/→ — ±100мс • Ctrl+←/→ — ±1000мс
            • Home — сброс • D — скрыть донор • M — звук • F — полноэкранный
          </Text>
        </Box>
      )}
    </VStack>
  )
}

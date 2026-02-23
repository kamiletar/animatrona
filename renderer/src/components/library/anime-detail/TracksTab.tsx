'use client'

/**
 * Вкладка "Дорожки"
 *
 * Пакетное редактирование аудиодорожек и субтитров для всего аниме.
 * Позволяет изменять язык и группу озвучки/субтитров для выбранных дорожек.
 */

import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  createListCollection,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  Select,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState, useTransition } from 'react'
import { LuAudioLines, LuCaptions, LuCheck, LuPencil, LuX } from 'react-icons/lu'

import { batchUpdateAudioTracks } from '@/app/_actions/audio-track.action'
import { batchUpdateSubtitleTracks } from '@/app/_actions/subtitle-track.action'
import { toaster } from '@/components/ui/toaster'
import { formatLanguage, LANGUAGE_OPTIONS, POPULAR_DUB_GROUPS } from '@/constants/dub-groups'
import type { AudioTrack, SubtitleTrack } from '@/generated/prisma'

/** Группа дорожек для отображения */
interface TrackGroupDisplay {
  /** Уникальный идентификатор группы */
  groupKey: string
  /** Тип дорожки */
  type: 'audio' | 'subtitle'
  /** Название группы (язык + dubGroup) */
  displayName: string
  /** Язык */
  language: string
  /** Группа озвучки/субтитров */
  dubGroup: string | null
  /** ID всех дорожек в группе */
  trackIds: string[]
  /** Номера эпизодов */
  episodeNumbers: number[]
}

export interface TracksTabProps {
  /** Аудиодорожки с номерами эпизодов */
  audioTracks: (AudioTrack & { episodeNumber: number })[]
  /** Субтитры с номерами эпизодов */
  subtitleTracks: (SubtitleTrack & { episodeNumber: number })[]
}

/** Коллекция языков для Select */
const languageCollection = createListCollection({
  items: LANGUAGE_OPTIONS.map((opt) => ({
    label: opt.flag ? `${opt.flag} ${opt.label}` : opt.label,
    value: opt.code,
  })),
})

/** Коллекция групп озвучки для Select */
const dubGroupCollection = createListCollection({
  items: [
    { label: '(без группы)', value: '' },
    ...POPULAR_DUB_GROUPS.map((g) => ({ label: g, value: g })),
    { label: '+ Другая...', value: '__custom__' },
  ],
})

/**
 * Вкладка редактирования дорожек
 */
export function TracksTab({ audioTracks, subtitleTracks }: TracksTabProps) {
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()

  // Выбранные группы для редактирования
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())

  // Режим редактирования для группы
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editLanguage, setEditLanguage] = useState('')
  const [editDubGroup, setEditDubGroup] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customDubGroup, setCustomDubGroup] = useState('')

  /**
   * Группировка дорожек по language + dubGroup
   */
  const trackGroups = useMemo(() => {
    const groups: TrackGroupDisplay[] = []

    // Группируем аудиодорожки
    const audioMap = new Map<string, TrackGroupDisplay>()
    for (const track of audioTracks) {
      const key = `audio:${track.language}:${track.dubGroup || ''}`
      const existing = audioMap.get(key)
      if (existing) {
        existing.trackIds.push(track.id)
        if (!existing.episodeNumbers.includes(track.episodeNumber)) {
          existing.episodeNumbers.push(track.episodeNumber)
        }
      } else {
        audioMap.set(key, {
          groupKey: key,
          type: 'audio',
          displayName: track.dubGroup
            ? `${formatLanguage(track.language)} (${track.dubGroup})`
            : formatLanguage(track.language),
          language: track.language,
          dubGroup: track.dubGroup,
          trackIds: [track.id],
          episodeNumbers: [track.episodeNumber],
        })
      }
    }
    groups.push(...audioMap.values())

    // Группируем субтитры
    const subMap = new Map<string, TrackGroupDisplay>()
    for (const track of subtitleTracks) {
      const key = `subtitle:${track.language}:${track.dubGroup || ''}`
      const existing = subMap.get(key)
      if (existing) {
        existing.trackIds.push(track.id)
        if (!existing.episodeNumbers.includes(track.episodeNumber)) {
          existing.episodeNumbers.push(track.episodeNumber)
        }
      } else {
        subMap.set(key, {
          groupKey: key,
          type: 'subtitle',
          displayName: track.dubGroup
            ? `${formatLanguage(track.language)} (${track.dubGroup})`
            : formatLanguage(track.language),
          language: track.language,
          dubGroup: track.dubGroup,
          trackIds: [track.id],
          episodeNumbers: [track.episodeNumber],
        })
      }
    }
    groups.push(...subMap.values())

    // Сортируем эпизоды в каждой группе
    for (const group of groups) {
      group.episodeNumbers.sort((a, b) => a - b)
    }

    return groups
  }, [audioTracks, subtitleTracks])

  // Группы по типу
  const audioGroups = trackGroups.filter((g) => g.type === 'audio')
  const subtitleGroups = trackGroups.filter((g) => g.type === 'subtitle')

  /**
   * Переключить выбор группы
   */
  const toggleGroupSelection = useCallback((groupKey: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }, [])

  /**
   * Начать редактирование группы
   */
  const startEditing = useCallback((group: TrackGroupDisplay) => {
    setEditingGroup(group.groupKey)
    setEditLanguage(group.language)
    setEditDubGroup(group.dubGroup || '')
    setShowCustomInput(false)
    setCustomDubGroup('')
  }, [])

  /**
   * Отменить редактирование
   */
  const cancelEditing = useCallback(() => {
    setEditingGroup(null)
    setShowCustomInput(false)
    setCustomDubGroup('')
  }, [])

  /**
   * Сохранить изменения группы
   */
  const saveGroupChanges = useCallback(
    async (group: TrackGroupDisplay) => {
      const finalDubGroup = showCustomInput ? customDubGroup.trim() : editDubGroup

      startTransition(async () => {
        try {
          const data: { language?: string; dubGroup?: string | null } = {}

          if (editLanguage !== group.language) {
            data.language = editLanguage
          }

          const newDubGroup = finalDubGroup || null
          if (newDubGroup !== group.dubGroup) {
            data.dubGroup = newDubGroup
          }

          if (Object.keys(data).length === 0) {
            cancelEditing()
            return
          }

          if (group.type === 'audio') {
            await batchUpdateAudioTracks(group.trackIds, data)
          } else {
            await batchUpdateSubtitleTracks(group.trackIds, data)
          }

          // Инвалидируем кэш
          await queryClient.invalidateQueries({ queryKey: ['Anime'] })

          toaster.success({
            title: 'Дорожки обновлены',
            description: `Обновлено ${group.trackIds.length} дорожек`,
          })

          cancelEditing()
        } catch (error) {
          toaster.error({
            title: 'Ошибка',
            description: error instanceof Error ? error.message : 'Не удалось обновить дорожки',
          })
        }
      })
    },
    [editLanguage, editDubGroup, showCustomInput, customDubGroup, cancelEditing, queryClient],
  )

  /**
   * Обработчик изменения dubGroup в Select
   */
  const handleDubGroupChange = useCallback((details: { value: string[] }) => {
    const value = details.value[0]
    if (value === '__custom__') {
      setShowCustomInput(true)
    } else {
      setShowCustomInput(false)
      setEditDubGroup(value)
    }
  }, [])

  /**
   * Форматирование диапазона эпизодов
   */
  const formatEpisodeRange = useCallback((numbers: number[]) => {
    if (numbers.length === 0) return ''
    if (numbers.length === 1) return `Серия ${numbers[0]}`

    // Группируем последовательные номера
    const ranges: string[] = []
    let rangeStart = numbers[0]
    let rangeEnd = numbers[0]

    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] === rangeEnd + 1) {
        rangeEnd = numbers[i]
      } else {
        ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`)
        rangeStart = numbers[i]
        rangeEnd = numbers[i]
      }
    }
    ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`)

    return `Серии ${ranges.join(', ')}`
  }, [])

  if (trackGroups.length === 0) {
    return (
      <Card.Root bg="bg.panel" border="1px" borderColor="border.subtle">
        <Card.Body py={8} textAlign="center">
          <Text color="fg.subtle">Дорожки не найдены</Text>
        </Card.Body>
      </Card.Root>
    )
  }

  return (
    <VStack align="stretch" gap={6}>
      {/* Аудиодорожки */}
      {audioGroups.length > 0 && (
        <Box>
          <HStack gap={2} mb={3}>
            <Icon as={LuAudioLines} color="green.400" boxSize={5} />
            <Heading size="md">Аудиодорожки</Heading>
            <Badge colorPalette="green" variant="subtle">
              {audioGroups.length}
            </Badge>
          </HStack>

          <VStack align="stretch" gap={2}>
            {audioGroups.map((group) => (
              <TrackGroupRow
                key={group.groupKey}
                group={group}
                isSelected={selectedGroups.has(group.groupKey)}
                isEditing={editingGroup === group.groupKey}
                isPending={isPending}
                editLanguage={editLanguage}
                editDubGroup={editDubGroup}
                showCustomInput={showCustomInput}
                customDubGroup={customDubGroup}
                onToggleSelect={() => toggleGroupSelection(group.groupKey)}
                onStartEdit={() => startEditing(group)}
                onCancelEdit={cancelEditing}
                onSaveEdit={() => saveGroupChanges(group)}
                onLanguageChange={(v) => setEditLanguage(v)}
                onDubGroupChange={handleDubGroupChange}
                onCustomDubGroupChange={setCustomDubGroup}
                formatEpisodeRange={formatEpisodeRange}
              />
            ))}
          </VStack>
        </Box>
      )}

      {/* Субтитры */}
      {subtitleGroups.length > 0 && (
        <Box>
          <HStack gap={2} mb={3}>
            <Icon as={LuCaptions} color="yellow.400" boxSize={5} />
            <Heading size="md">Субтитры</Heading>
            <Badge colorPalette="yellow" variant="subtle">
              {subtitleGroups.length}
            </Badge>
          </HStack>

          <VStack align="stretch" gap={2}>
            {subtitleGroups.map((group) => (
              <TrackGroupRow
                key={group.groupKey}
                group={group}
                isSelected={selectedGroups.has(group.groupKey)}
                isEditing={editingGroup === group.groupKey}
                isPending={isPending}
                editLanguage={editLanguage}
                editDubGroup={editDubGroup}
                showCustomInput={showCustomInput}
                customDubGroup={customDubGroup}
                onToggleSelect={() => toggleGroupSelection(group.groupKey)}
                onStartEdit={() => startEditing(group)}
                onCancelEdit={cancelEditing}
                onSaveEdit={() => saveGroupChanges(group)}
                onLanguageChange={(v) => setEditLanguage(v)}
                onDubGroupChange={handleDubGroupChange}
                onCustomDubGroupChange={setCustomDubGroup}
                formatEpisodeRange={formatEpisodeRange}
              />
            ))}
          </VStack>
        </Box>
      )}
    </VStack>
  )
}

/** Props для TrackGroupRow */
interface TrackGroupRowProps {
  group: TrackGroupDisplay
  isSelected: boolean
  isEditing: boolean
  isPending: boolean
  editLanguage: string
  editDubGroup: string
  showCustomInput: boolean
  customDubGroup: string
  onToggleSelect: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onLanguageChange: (value: string) => void
  onDubGroupChange: (details: { value: string[] }) => void
  onCustomDubGroupChange: (value: string) => void
  formatEpisodeRange: (numbers: number[]) => string
}

/**
 * Строка группы дорожек
 */
function TrackGroupRow({
  group,
  isSelected,
  isEditing,
  isPending,
  editLanguage,
  editDubGroup,
  showCustomInput,
  customDubGroup,
  onToggleSelect,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onLanguageChange,
  onDubGroupChange,
  onCustomDubGroupChange,
  formatEpisodeRange,
}: TrackGroupRowProps) {
  if (isEditing) {
    return (
      <Box p={3} bg="bg.subtle" borderRadius="md" borderWidth="1px" borderColor="purple.500">
        <VStack align="stretch" gap={3}>
          <HStack justify="space-between">
            <Text fontWeight="medium">{group.displayName}</Text>
            <HStack gap={2}>
              <IconButton
                aria-label="Сохранить"
                size="sm"
                colorPalette="green"
                onClick={onSaveEdit}
                loading={isPending}
              >
                <LuCheck />
              </IconButton>
              <IconButton aria-label="Отмена" size="sm" variant="ghost" onClick={onCancelEdit}>
                <LuX />
              </IconButton>
            </HStack>
          </HStack>

          <HStack gap={4} flexWrap="wrap">
            {/* Язык */}
            <HStack gap={2} minW="180px">
              <Text fontSize="sm" color="fg.muted" whiteSpace="nowrap">
                Язык:
              </Text>
              <Select.Root
                collection={languageCollection}
                value={editLanguage ? [editLanguage] : []}
                onValueChange={(details) => onLanguageChange(details.value[0])}
                size="sm"
              >
                <Select.Trigger>
                  <Select.ValueText placeholder="Выбрать...">{formatLanguage(editLanguage)}</Select.ValueText>
                </Select.Trigger>
                <Select.Positioner>
                  <Select.Content>
                    {languageCollection.items.map((item) => (
                      <Select.Item key={item.value} item={item}>
                        {item.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Select.Root>
            </HStack>

            {/* Группа */}
            <HStack gap={2} flex={1} minW="200px">
              <Text fontSize="sm" color="fg.muted" whiteSpace="nowrap">
                Группа:
              </Text>
              {showCustomInput
                ? (
                  <HStack flex={1}>
                    <Input
                      size="sm"
                      placeholder="Введите название..."
                      value={customDubGroup}
                      onChange={(e) => onCustomDubGroupChange(e.target.value)}
                      autoFocus
                    />
                    <IconButton
                      aria-label="Отмена"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onCustomDubGroupChange('')
                        onDubGroupChange({ value: [editDubGroup] })
                      }}
                    >
                      <LuX />
                    </IconButton>
                  </HStack>
                )
                : (
                  <Select.Root
                    collection={dubGroupCollection}
                    value={editDubGroup ? [editDubGroup] : ['']}
                    onValueChange={onDubGroupChange}
                    size="sm"
                  >
                    <Select.Trigger flex={1}>
                      <Select.ValueText placeholder="(без группы)">{editDubGroup || '(без группы)'}</Select.ValueText>
                    </Select.Trigger>
                    <Select.Positioner>
                      <Select.Content maxH="200px" overflowY="auto">
                        {dubGroupCollection.items.map((item) => (
                          <Select.Item key={item.value || 'empty'} item={item}>
                            {item.label}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Select.Root>
                )}
            </HStack>
          </HStack>
        </VStack>
      </Box>
    )
  }

  return (
    <Box
      p={3}
      bg="bg.subtle"
      borderRadius="md"
      borderWidth="1px"
      borderColor={isSelected ? 'purple.500' : 'border.subtle'}
      transition="border-color 0.2s"
    >
      <HStack justify="space-between">
        <HStack gap={3}>
          <Checkbox.Root checked={isSelected} onCheckedChange={onToggleSelect}>
            <Checkbox.HiddenInput />
            <Checkbox.Control />
          </Checkbox.Root>
          <VStack align="start" gap={0}>
            <Text fontWeight="medium">{group.displayName}</Text>
            <Text fontSize="xs" color="fg.muted">
              {formatEpisodeRange(group.episodeNumbers)} • {group.trackIds.length}{' '}
              {group.trackIds.length === 1 ? 'дорожка' : 'дорожек'}
            </Text>
          </VStack>
        </HStack>

        <Button variant="ghost" size="sm" onClick={onStartEdit}>
          <Icon as={LuPencil} mr={2} />
          Изменить
        </Button>
      </HStack>
    </Box>
  )
}

'use client'

/**
 * TrackSelector - Компонент выбора аудио/субтитров дорожек
 *
 * Позволяет пользователю выбирать:
 * - Аудиодорожку (язык, формат)
 * - Субтитры (или отключить)
 */

import { Badge, Box, Button, HStack, Icon, IconButton, Menu, Portal, Text, VStack } from '@chakra-ui/react'
import { LuCaptions, LuCheck, LuLanguages, LuPencil, LuTrash2, LuVolume2 } from 'react-icons/lu'

import type { AudioTranscodeStatus } from '../../../../shared/types/manifest'

/** Информация о дорожке */
export interface TrackInfo {
  id: string | number
  /** Название дорожки (если нет — используется getLanguageName) */
  label?: string
  /** Код языка (rus, jpn, eng, und) */
  language?: string
  codec?: string
  isDefault?: boolean
  /** Статус транскодирования (только для аудио) */
  transcodeStatus?: AudioTranscodeStatus
  /** Название группы озвучки (имя папки-дублёра) */
  dubGroup?: string
}

/** Пропсы компонента TrackSelector */
export interface TrackSelectorProps {
  /** Доступные аудиодорожки */
  audioTracks: TrackInfo[]
  /** Доступные дорожки субтитров */
  subtitleTracks: TrackInfo[]
  /** ID выбранной аудиодорожки */
  selectedAudioTrack?: string | number
  /** ID выбранной дорожки субтитров (null = выключены) */
  selectedSubtitleTrack?: string | number | null
  /** Обработчик выбора аудиодорожки */
  onAudioTrackChange?: (trackId: string | number) => void
  /** Обработчик выбора субтитров */
  onSubtitleTrackChange?: (trackId: string | number | null) => void
  /** Обработчик редактирования аудиодорожки */
  onEditAudioTrack?: (trackId: string | number) => void
  /** Обработчик удаления аудиодорожки */
  onDeleteAudioTrack?: (trackId: string | number) => void
  /** Обработчик редактирования субтитров */
  onEditSubtitleTrack?: (trackId: string | number) => void
  /** Обработчик удаления субтитров */
  onDeleteSubtitleTrack?: (trackId: string | number) => void
}

/**
 * Получить отображаемое имя языка
 */
function getLanguageName(langCode?: string): string {
  if (!langCode) {
    return 'Неизвестный'
  }

  const languageNames: Record<string, string> = {
    rus: 'Русский',
    ru: 'Русский',
    eng: 'Английский',
    en: 'Английский',
    jpn: 'Японский',
    ja: 'Японский',
    ger: 'Немецкий',
    de: 'Немецкий',
    fre: 'Французский',
    fr: 'Французский',
    spa: 'Испанский',
    es: 'Испанский',
    ita: 'Итальянский',
    it: 'Итальянский',
    chi: 'Китайский',
    zh: 'Китайский',
    kor: 'Корейский',
    ko: 'Корейский',
    und: 'Неопределённый',
  }

  return languageNames[langCode.toLowerCase()] || langCode
}

/**
 * Форматировать название дорожки с учётом dubGroup
 *
 * Примеры:
 * - "Русский (FuegoAlma & Eladiel)" — если есть dubGroup
 * - "Русский — Перевод от Studio" — если есть label
 * - "Русский" — если только язык
 */
function formatTrackLabel(track: TrackInfo): string {
  const langName = getLanguageName(track.language)

  // Если есть dubGroup — показываем в скобках
  if (track.dubGroup && track.dubGroup !== '(root)') {
    if (track.label) {
      return `${langName} — ${track.label} (${track.dubGroup})`
    }
    return `${langName} (${track.dubGroup})`
  }

  // Если есть label — показываем через тире
  if (track.label) {
    return `${langName} — ${track.label}`
  }

  return langName
}

/**
 * Получить badge для статуса транскодирования
 */
function getTranscodeStatusBadge(status?: AudioTranscodeStatus) {
  if (!status) {
    return null
  }

  switch (status) {
    case 'SKIPPED':
      // AAC дорожка использована без транскодирования
      return (
        <Badge colorPalette="green" size="sm" variant="subtle">
          AAC
        </Badge>
      )
    case 'COMPLETED':
      // Транскодирование завершено — нет badge (просто работает)
      return null
    case 'ERROR':
      return (
        <Badge colorPalette="red" size="sm" variant="subtle">
          Ошибка
        </Badge>
      )
    case 'QUEUED':
    case 'PROCESSING':
      return (
        <Badge colorPalette="yellow" size="sm" variant="subtle">
          ...
        </Badge>
      )
    default:
      return null
  }
}

/**
 * Проверяет, доступна ли дорожка для воспроизведения
 */
function isTrackPlayable(status?: AudioTranscodeStatus): boolean {
  if (!status) {
    return true
  } // Без статуса — считаем доступной (legacy)
  return status === 'COMPLETED' || status === 'SKIPPED'
}

/**
 * TrackSelector компонент
 */
export function TrackSelector({
  audioTracks,
  subtitleTracks,
  selectedAudioTrack,
  selectedSubtitleTrack,
  onAudioTrackChange,
  onSubtitleTrackChange,
  onEditAudioTrack,
  onDeleteAudioTrack,
  onEditSubtitleTrack,
  onDeleteSubtitleTrack,
}: TrackSelectorProps) {
  return (
    <HStack gap={1}>
      {/* Аудиодорожки */}
      {audioTracks.length > 1 && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button variant="ghost" colorPalette="whiteAlpha" size="sm" title="Аудиодорожка">
              <Icon as={LuVolume2} color="white" />
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content bg="bg.panel" borderColor="border.subtle">
                <Box px={3} py={2} borderBottom="1px" borderColor="border.subtle">
                  <HStack gap={2}>
                    <Icon as={LuLanguages} color="fg.muted" />
                    <Text fontSize="sm" fontWeight="medium" color="fg.muted">
                      Аудиодорожка
                    </Text>
                  </HStack>
                </Box>
                {audioTracks.map((track) => {
                  const playable = isTrackPlayable(track.transcodeStatus)
                  const badge = getTranscodeStatusBadge(track.transcodeStatus)
                  const isSelected = selectedAudioTrack === track.id

                  return (
                    <Menu.Item
                      key={track.id}
                      value={String(track.id)}
                      onClick={() => playable && onAudioTrackChange?.(track.id)}
                      disabled={!playable}
                      // Используем data-selected для CSS, hover из slot recipe
                      data-selected={isSelected || undefined}
                      css={{
                        '&[data-selected]': {
                          background: 'var(--chakra-colors-purple-700)',
                          color: 'white',
                        },
                        '&[data-selected]:hover': {
                          background: 'var(--chakra-colors-purple-600)',
                        },
                      }}
                    >
                      <HStack justify="space-between" w="full">
                        <VStack align="start" gap={0} flex={1}>
                          <HStack gap={2}>
                            <Text fontSize="sm" color={isSelected ? 'white' : undefined}>{formatTrackLabel(track)}</Text>
                            {badge}
                          </HStack>
                          {track.codec && (
                            <Text fontSize="xs" color={isSelected ? 'whiteAlpha.700' : 'fg.muted'}>
                              {track.codec}
                            </Text>
                          )}
                        </VStack>
                        <HStack gap={1}>
                          {onEditAudioTrack && (
                            <IconButton
                              aria-label="Редактировать"
                              size="xs"
                              variant="ghost"
                              colorPalette="gray"
                              _hover={{ bg: 'whiteAlpha.200' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                onEditAudioTrack(track.id)
                              }}
                            >
                              <Icon as={LuPencil} boxSize={3} />
                            </IconButton>
                          )}
                          {onDeleteAudioTrack && (
                            <IconButton
                              aria-label="Удалить"
                              size="xs"
                              variant="ghost"
                              colorPalette="red"
                              _hover={{ bg: 'red.900/30' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteAudioTrack(track.id)
                              }}
                            >
                              <Icon as={LuTrash2} boxSize={3} />
                            </IconButton>
                          )}
                          {isSelected && <Icon as={LuCheck} color="white" />}
                        </HStack>
                      </HStack>
                    </Menu.Item>
                  )
                })}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      )}

      {/* Субтитры */}
      {subtitleTracks.length > 0 && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button variant="ghost" colorPalette="whiteAlpha" size="sm" title="Субтитры">
              <Icon as={LuCaptions} color={selectedSubtitleTrack !== null ? 'purple.400' : 'white'} />
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content bg="bg.panel" borderColor="border.subtle">
                <Box px={3} py={2} borderBottom="1px" borderColor="border.subtle">
                  <HStack gap={2}>
                    <Icon as={LuCaptions} color="fg.muted" />
                    <Text fontSize="sm" fontWeight="medium" color="fg.muted">
                      Субтитры
                    </Text>
                  </HStack>
                </Box>
                {/* Опция выключения */}
                <Menu.Item
                  value="off"
                  onClick={() => onSubtitleTrackChange?.(null)}
                  data-selected={selectedSubtitleTrack === null || undefined}
                  css={{
                    '&[data-selected]': {
                      background: 'var(--chakra-colors-purple-700)',
                      color: 'white',
                    },
                    '&[data-selected]:hover': {
                      background: 'var(--chakra-colors-purple-600)',
                    },
                  }}
                >
                  <HStack justify="space-between" w="full">
                    <Text fontSize="sm" color={selectedSubtitleTrack === null ? 'white' : undefined}>Выключены</Text>
                    {selectedSubtitleTrack === null && <Icon as={LuCheck} color="white" />}
                  </HStack>
                </Menu.Item>
                {subtitleTracks.map((track) => {
                  const isSelected = selectedSubtitleTrack === track.id
                  return (
                    <Menu.Item
                      key={track.id}
                      value={String(track.id)}
                      onClick={() => onSubtitleTrackChange?.(track.id)}
                      data-selected={isSelected || undefined}
                      css={{
                        '&[data-selected]': {
                          background: 'var(--chakra-colors-purple-700)',
                          color: 'white',
                        },
                        '&[data-selected]:hover': {
                          background: 'var(--chakra-colors-purple-600)',
                        },
                      }}
                    >
                      <HStack justify="space-between" w="full">
                        <VStack align="start" gap={0} flex={1}>
                          <Text fontSize="sm" color={isSelected ? 'white' : undefined}>{formatTrackLabel(track)}</Text>
                          {track.codec && (
                            <Text fontSize="xs" color={isSelected ? 'whiteAlpha.700' : 'fg.muted'}>
                              {track.codec}
                            </Text>
                          )}
                        </VStack>
                        <HStack gap={1}>
                          {onEditSubtitleTrack && (
                            <IconButton
                              aria-label="Редактировать"
                              size="xs"
                              variant="ghost"
                              colorPalette="gray"
                              _hover={{ bg: 'whiteAlpha.200' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                onEditSubtitleTrack(track.id)
                              }}
                            >
                              <Icon as={LuPencil} boxSize={3} />
                            </IconButton>
                          )}
                          {onDeleteSubtitleTrack && (
                            <IconButton
                              aria-label="Удалить"
                              size="xs"
                              variant="ghost"
                              colorPalette="red"
                              _hover={{ bg: 'red.900/30' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteSubtitleTrack(track.id)
                              }}
                            >
                              <Icon as={LuTrash2} boxSize={3} />
                            </IconButton>
                          )}
                          {isSelected && <Icon as={LuCheck} color="white" />}
                        </HStack>
                      </HStack>
                    </Menu.Item>
                  )
                })}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      )}
    </HStack>
  )
}

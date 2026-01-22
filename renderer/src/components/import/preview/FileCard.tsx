'use client'

/**
 * Компонент карточки файла для PreviewStep
 */

import { Badge, Box, Card, Checkbox, HStack, Icon, Spinner, Text, VStack } from '@chakra-ui/react'
import { LuAudioLines, LuCaptions, LuCheck, LuFileVideo, LuVideo, LuX } from 'react-icons/lu'

import type { FileCardProps } from './types'
import { formatBitrate, formatBytes, formatChannels, formatDuration, getRelativePath } from './utils'

/**
 * Компонент карточки файла
 */
export function FileCard({ analysis, folderPath, onToggleTrack, onToggleSubtitle }: FileCardProps) {
  const { file, mediaInfo, isAnalyzing, error, audioRecommendations, subtitleRecommendations } = analysis
  const videoTrack = mediaInfo?.videoTracks[0]

  return (
    <Card.Root bg="bg.subtle" borderColor="border.subtle" variant="outline">
      <Card.Header py={3} px={4}>
        <HStack justify="space-between">
          <HStack gap={3}>
            <Icon as={LuFileVideo} color="purple.400" boxSize={5} />
            <VStack align="start" gap={0}>
              <Text fontWeight="medium" lineClamp={1}>
                {file.name}
              </Text>
              <Text fontSize="xs" color="fg.subtle">
                Эпизод {file.episodeNumber}
              </Text>
            </VStack>
          </HStack>

          {isAnalyzing && (
            <HStack>
              <Spinner size="sm" color="purple.400" />
              <Text fontSize="sm" color="fg.muted">
                Анализ...
              </Text>
            </HStack>
          )}

          {!isAnalyzing && mediaInfo && (
            <Badge colorPalette="green">
              <LuCheck />
              Готов
            </Badge>
          )}

          {error && (
            <Badge colorPalette="red">
              <LuX />
              Ошибка
            </Badge>
          )}
        </HStack>
      </Card.Header>

      {mediaInfo && (
        <Card.Body pt={0} pb={4} px={4}>
          <VStack align="stretch" gap={3}>
            {/* Видео информация */}
            {videoTrack && (
              <HStack p={2} bg="bg.subtle" borderRadius="md" justify="space-between">
                <HStack gap={2}>
                  <Icon as={LuVideo} color="blue.400" boxSize={4} />
                  <Text fontSize="sm">Видео</Text>
                </HStack>
                <HStack gap={4} fontSize="xs" color="fg.muted">
                  <Text>
                    {videoTrack.width}×{videoTrack.height}
                  </Text>
                  <Text>{(videoTrack.codec || 'unknown').toUpperCase()}</Text>
                  <Text>{formatDuration(videoTrack.duration)}</Text>
                  <Text>{formatBytes(mediaInfo.size)}</Text>
                </HStack>
              </HStack>
            )}

            {/* Аудиодорожки */}
            {audioRecommendations.length > 0 && (
              <VStack align="stretch" gap={2}>
                <HStack gap={2}>
                  <Icon as={LuAudioLines} color="green.400" boxSize={4} />
                  <Text fontSize="sm" fontWeight="medium">
                    Аудиодорожки ({audioRecommendations.length})
                  </Text>
                </HStack>

                {audioRecommendations.map((rec) => {
                  // Для внешних аудио используем данные из rec, не из mediaInfo
                  if (rec.isExternal) {
                    return (
                      <HStack
                        key={`external-${rec.trackIndex}`}
                        p={2}
                        bg="bg.subtle"
                        borderRadius="md"
                        justify="space-between"
                      >
                        <HStack gap={3}>
                          <Checkbox.Root
                            checked={rec.enabled}
                            onCheckedChange={(e) =>
                              onToggleTrack(analysis.file.episodeNumber ?? 0, rec.trackIndex, e.checked === true)
                            }
                          >
                            <Checkbox.HiddenInput />
                            <Checkbox.Control />
                          </Checkbox.Root>

                          <VStack align="start" gap={0}>
                            <HStack gap={2}>
                              <Badge size="sm" variant="outline" colorPalette="blue">
                                ВНЕШ
                              </Badge>
                              {rec.groupName && (
                                <Text fontSize="sm" color="fg.muted" lineClamp={1}>
                                  {rec.groupName}
                                </Text>
                              )}
                            </HStack>
                            <HStack gap={3} fontSize="xs" color="fg.subtle">
                              <Text>{rec.reason}</Text>
                              {rec.externalPath && (
                                <Text color="blue.400" lineClamp={1} maxW="200px" title={rec.externalPath}>
                                  📁 {getRelativePath(rec.externalPath, folderPath)}
                                </Text>
                              )}
                            </HStack>
                          </VStack>
                        </HStack>

                        <Badge colorPalette="blue" variant="subtle">
                          Внешний
                        </Badge>
                      </HStack>
                    )
                  }

                  const track = mediaInfo.audioTracks[rec.trackIndex]
                  if (!track) {
                    return null
                  }

                  return (
                    <HStack key={rec.trackIndex} p={2} bg="bg.subtle" borderRadius="md" justify="space-between">
                      <HStack gap={3}>
                        <Checkbox.Root
                          checked={rec.enabled}
                          onCheckedChange={(e) =>
                            onToggleTrack(analysis.file.episodeNumber ?? 0, rec.trackIndex, e.checked === true)
                          }
                        >
                          <Checkbox.HiddenInput />
                          <Checkbox.Control />
                        </Checkbox.Root>

                        <VStack align="start" gap={0}>
                          <HStack gap={2}>
                            <Badge size="sm" variant="outline">
                              {track.language.toUpperCase()}
                            </Badge>
                            {track.title && (
                              <Text fontSize="sm" color="fg.muted" lineClamp={1}>
                                {track.title}
                              </Text>
                            )}
                          </HStack>
                          <HStack gap={3} fontSize="xs" color="fg.subtle">
                            <Text>{(track.codec || 'unknown').toUpperCase()}</Text>
                            <Text>{formatChannels(track.channels || 2)}</Text>
                            <Text>{formatBitrate(track.bitrate)}</Text>
                          </HStack>
                        </VStack>
                      </HStack>

                      <Badge colorPalette={rec.action === 'skip' ? 'green' : 'yellow'} variant="subtle">
                        {rec.action === 'skip' ? 'Пропустить' : 'Транскодировать'}
                      </Badge>
                    </HStack>
                  )
                })}
              </VStack>
            )}

            {/* Субтитры */}
            {subtitleRecommendations.length > 0 && (
              <VStack align="stretch" gap={2}>
                <HStack gap={2}>
                  <Icon as={LuCaptions} color="yellow.400" boxSize={4} />
                  <Text fontSize="sm" fontWeight="medium">
                    Субтитры ({subtitleRecommendations.length})
                  </Text>
                </HStack>

                {subtitleRecommendations.map((rec, idx) => (
                  <HStack key={idx} p={2} bg="bg.subtle" borderRadius="md" justify="space-between">
                    <HStack gap={3}>
                      <Checkbox.Root
                        checked={rec.enabled}
                        onCheckedChange={(e) => onToggleSubtitle(file.episodeNumber ?? 0, idx, e.checked === true)}
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control />
                      </Checkbox.Root>

                      <VStack align="start" gap={0}>
                        <HStack gap={2}>
                          <Badge size="sm" variant="outline">
                            {rec.language.toUpperCase()}
                          </Badge>
                          {rec.title && (
                            <Text fontSize="sm" color="fg.muted" lineClamp={1}>
                              {rec.title}
                            </Text>
                          )}
                        </HStack>
                        <HStack gap={3} fontSize="xs" color="fg.subtle">
                          <Text>{rec.format.toUpperCase()}</Text>
                          {rec.isExternal && rec.externalPath && (
                            <Text color="blue.400" lineClamp={1} maxW="300px" title={rec.externalPath}>
                              📁 {getRelativePath(rec.externalPath, folderPath)}
                            </Text>
                          )}
                          {rec.matchedFonts && rec.matchedFonts.length > 0 && (
                            <Text>🔤 {rec.matchedFonts.length} шрифтов</Text>
                          )}
                        </HStack>
                      </VStack>
                    </HStack>

                    <Badge colorPalette={rec.isExternal ? 'blue' : 'gray'} variant="subtle">
                      {rec.isExternal ? 'Внешний' : 'Встроенный'}
                    </Badge>
                  </HStack>
                ))}
              </VStack>
            )}
          </VStack>
        </Card.Body>
      )}

      {error && (
        <Card.Body pt={0} pb={4} px={4}>
          <Box p={3} bg="red.900/30" borderRadius="md" borderWidth="1px" borderColor="red.800">
            <Text color="red.400" fontSize="sm">
              {error}
            </Text>
          </Box>
        </Card.Body>
      )}
    </Card.Root>
  )
}

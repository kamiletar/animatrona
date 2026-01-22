'use client'

/**
 * Диалог просмотра настроек кодирования эпизода — v0.9.0
 * Показывает информацию о профиле кодирования и размерах файлов
 */

import { Badge, Box, Button, CloseButton, Code, DataList, Dialog, HStack, Icon, Portal, Text, VStack } from '@chakra-ui/react'
import { LuClipboard, LuClock, LuCpu, LuHardDrive, LuLayers, LuMonitor, LuPercent, LuSettings2, LuTarget, LuTerminal, LuVideo } from 'react-icons/lu'

/** Настройки кодирования из JSON */
interface EncodingSettings {
  profileName?: string
  codec?: string
  cq?: number
  preset?: string
  rateControl?: string
  tune?: string
  multipass?: string
  spatialAq?: boolean
  temporalAq?: boolean
  aqStrength?: number
  gopSize?: number
  lookahead?: number
  bRefMode?: string
  force10Bit?: boolean
  // Новые поля v0.10.0
  /** VMAF скор (если был подобран) */
  vmafScore?: number
  /** Тип энкодера: GPU или CPU */
  encoderType?: 'gpu' | 'cpu'
  /** Модель оборудования (RTX 5080, AMD Ryzen 9 7950X и т.д.) */
  hardwareModel?: string
  /** Полная FFmpeg команда для воспроизведения энкода */
  ffmpegCommand?: string
  /** Версия FFmpeg */
  ffmpegVersion?: string
  /** Время транскодирования в миллисекундах */
  transcodeDurationMs?: number
  /** Количество активных GPU потоков во время кодирования */
  activeGpuWorkers?: number
  /** Максимальный лимит видео потоков при кодировании */
  videoMaxConcurrent?: number
  /** Максимальный лимит аудио потоков при кодировании */
  audioMaxConcurrent?: number
}

interface EncodingInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  episode: {
    number: number
    encodingSettingsJson?: string | null
    sourceSize?: bigint | null
    transcodedSize?: bigint | null
    encodingProfile?: { name: string } | null
    /** Источник — BDRemux (lossless качество с Blu-ray) */
    isBdRemux?: boolean
  }
}

/** Форматирование байт в человекочитаемый формат */
function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B'
  }
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/** Цвет для CQ значения */
function getCqColor(cq: number): string {
  if (cq <= 22) {
    return 'green.400'
  }
  if (cq <= 28) {
    return 'yellow.400'
  }
  if (cq <= 32) {
    return 'orange.400'
  }
  return 'red.400'
}

/** Описание качества по CQ */
function getCqQuality(cq: number): string {
  if (cq <= 18) {
    return 'Эталонное'
  }
  if (cq <= 22) {
    return 'Высокое'
  }
  if (cq <= 26) {
    return 'Хорошее'
  }
  if (cq <= 30) {
    return 'Среднее'
  }
  if (cq <= 34) {
    return 'Сжатое'
  }
  return 'Низкое'
}

/** Форматирует время в мс → читаемый вид */
function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000)
  if (sec < 60) {
    return `${sec}с`
  }
  const min = Math.floor(sec / 60)
  const secRem = sec % 60
  if (min < 60) {
    return `${min}м ${secRem}с`
  }
  const hours = Math.floor(min / 60)
  const minRem = min % 60
  return `${hours}ч ${minRem}м`
}

/**
 * Диалог с информацией о кодировании эпизода
 */
export function EncodingInfoDialog({ open, onOpenChange, episode }: EncodingInfoDialogProps) {
  const settings: EncodingSettings | null = episode.encodingSettingsJson
    ? JSON.parse(episode.encodingSettingsJson)
    : null

  // Расчёт экономии
  const sourceSize = episode.sourceSize ? Number(episode.sourceSize) : null
  const transcodedSize = episode.transcodedSize ? Number(episode.transcodedSize) : null
  const savings = sourceSize && transcodedSize ? (((sourceSize - transcodedSize) / sourceSize) * 100).toFixed(1) : null

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="480px">
            <Dialog.Header>
              <Dialog.Title>
                <HStack>
                  <Icon as={LuSettings2} color="purple.400" />
                  <Text>Настройки кодирования</Text>
                </HStack>
              </Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap={6} align="stretch">
                {/* Заголовок эпизода */}
                <Box p={3} bg="bg.subtle" borderRadius="md">
                  <Text fontWeight="bold" fontSize="lg">
                    Эпизод {episode.number}
                  </Text>
                  {settings?.profileName && (
                    <Text color="fg.muted" fontSize="sm">
                      Профиль: {settings.profileName}
                    </Text>
                  )}
                </Box>

                {settings ? (
                  <>
                    {/* Основные параметры */}
                    <Box>
                      <HStack mb={2}>
                        <Icon as={LuVideo} color="purple.400" boxSize={4} />
                        <Text fontWeight="semibold" fontSize="sm">
                          Параметры кодирования
                        </Text>
                      </HStack>
                      <DataList.Root size="sm">
                        <DataList.Item>
                          <DataList.ItemLabel color="fg.muted">Кодек</DataList.ItemLabel>
                          <DataList.ItemValue>
                            <Badge colorPalette="purple">{settings.codec?.toUpperCase() ?? '—'}</Badge>
                          </DataList.ItemValue>
                        </DataList.Item>

                        <DataList.Item>
                          <DataList.ItemLabel color="fg.muted">CQ/QP</DataList.ItemLabel>
                          <DataList.ItemValue>
                            <HStack>
                              <Text fontWeight="bold" color={settings.cq ? getCqColor(settings.cq) : undefined}>
                                {settings.cq ?? '—'}
                              </Text>
                              {settings.cq && (
                                <Badge colorPalette="gray" size="sm">
                                  {getCqQuality(settings.cq)}
                                </Badge>
                              )}
                            </HStack>
                          </DataList.ItemValue>
                        </DataList.Item>

                        <DataList.Item>
                          <DataList.ItemLabel color="fg.muted">Preset</DataList.ItemLabel>
                          <DataList.ItemValue>{settings.preset ?? '—'}</DataList.ItemValue>
                        </DataList.Item>

                        <DataList.Item>
                          <DataList.ItemLabel color="fg.muted">Rate Control</DataList.ItemLabel>
                          <DataList.ItemValue>{settings.rateControl ?? '—'}</DataList.ItemValue>
                        </DataList.Item>

                        {settings.tune && (
                          <DataList.Item>
                            <DataList.ItemLabel color="fg.muted">Tune</DataList.ItemLabel>
                            <DataList.ItemValue>{settings.tune}</DataList.ItemValue>
                          </DataList.Item>
                        )}
                      </DataList.Root>
                    </Box>

                    {/* Расширенные настройки */}
                    <Box>
                      <HStack mb={2}>
                        <Icon as={LuCpu} color="cyan.400" boxSize={4} />
                        <Text fontWeight="semibold" fontSize="sm">
                          Расширенные
                        </Text>
                      </HStack>
                      <DataList.Root size="sm">
                        <DataList.Item>
                          <DataList.ItemLabel color="fg.muted">Spatial AQ</DataList.ItemLabel>
                          <DataList.ItemValue>
                            <Badge colorPalette={settings.spatialAq ? 'green' : 'gray'}>
                              {settings.spatialAq ? 'Вкл' : 'Выкл'}
                            </Badge>
                          </DataList.ItemValue>
                        </DataList.Item>

                        <DataList.Item>
                          <DataList.ItemLabel color="fg.muted">Temporal AQ</DataList.ItemLabel>
                          <DataList.ItemValue>
                            <Badge colorPalette={settings.temporalAq ? 'green' : 'gray'}>
                              {settings.temporalAq ? 'Вкл' : 'Выкл'}
                            </Badge>
                          </DataList.ItemValue>
                        </DataList.Item>

                        {settings.aqStrength !== undefined && (
                          <DataList.Item>
                            <DataList.ItemLabel color="fg.muted">AQ Strength</DataList.ItemLabel>
                            <DataList.ItemValue>{settings.aqStrength}</DataList.ItemValue>
                          </DataList.Item>
                        )}

                        {settings.gopSize !== undefined && (
                          <DataList.Item>
                            <DataList.ItemLabel color="fg.muted">GOP Size</DataList.ItemLabel>
                            <DataList.ItemValue>{settings.gopSize}</DataList.ItemValue>
                          </DataList.Item>
                        )}

                        {settings.lookahead !== undefined && (
                          <DataList.Item>
                            <DataList.ItemLabel color="fg.muted">Lookahead</DataList.ItemLabel>
                            <DataList.ItemValue>{settings.lookahead}</DataList.ItemValue>
                          </DataList.Item>
                        )}

                        <DataList.Item>
                          <DataList.ItemLabel color="fg.muted">10-bit</DataList.ItemLabel>
                          <DataList.ItemValue>
                            <Badge colorPalette={settings.force10Bit ? 'purple' : 'gray'}>
                              {settings.force10Bit ? 'Да' : 'Нет'}
                            </Badge>
                          </DataList.ItemValue>
                        </DataList.Item>
                      </DataList.Root>
                    </Box>

                    {/* Энкодер и VMAF */}
                    {(settings.encoderType || settings.vmafScore !== undefined || settings.transcodeDurationMs !== undefined || settings.activeGpuWorkers !== undefined) && (
                      <Box>
                        <HStack mb={2}>
                          <Icon as={settings.encoderType === 'cpu' ? LuCpu : LuMonitor} color="blue.400" boxSize={4} />
                          <Text fontWeight="semibold" fontSize="sm">
                            Энкодер
                          </Text>
                        </HStack>
                        <DataList.Root size="sm">
                          {settings.encoderType && (
                            <DataList.Item>
                              <DataList.ItemLabel color="fg.muted">Тип</DataList.ItemLabel>
                              <DataList.ItemValue>
                                <Badge colorPalette={settings.encoderType === 'gpu' ? 'purple' : 'blue'}>
                                  {settings.encoderType === 'gpu' ? 'GPU (NVENC)' : 'CPU (libsvtav1)'}
                                </Badge>
                              </DataList.ItemValue>
                            </DataList.Item>
                          )}

                          {settings.hardwareModel && (
                            <DataList.Item>
                              <DataList.ItemLabel color="fg.muted">Оборудование</DataList.ItemLabel>
                              <DataList.ItemValue>{settings.hardwareModel}</DataList.ItemValue>
                            </DataList.Item>
                          )}

                          {settings.vmafScore !== undefined && (
                            <DataList.Item>
                              <DataList.ItemLabel color="fg.muted">
                                <HStack gap={1}>
                                  <Icon as={LuTarget} boxSize={3} />
                                  <Text>VMAF</Text>
                                </HStack>
                              </DataList.ItemLabel>
                              <DataList.ItemValue>
                                <Text fontWeight="bold" color="green.400">
                                  {settings.vmafScore.toFixed(1)}
                                </Text>
                              </DataList.ItemValue>
                            </DataList.Item>
                          )}

                          {settings.ffmpegVersion && (
                            <DataList.Item>
                              <DataList.ItemLabel color="fg.muted">FFmpeg</DataList.ItemLabel>
                              <DataList.ItemValue>
                                <Text fontSize="sm">{settings.ffmpegVersion}</Text>
                              </DataList.ItemValue>
                            </DataList.Item>
                          )}

                          {settings.transcodeDurationMs !== undefined && settings.transcodeDurationMs > 0 && (
                            <DataList.Item>
                              <DataList.ItemLabel color="fg.muted">
                                <HStack gap={1}>
                                  <Icon as={LuClock} boxSize={3} />
                                  <Text>Время кодирования</Text>
                                </HStack>
                              </DataList.ItemLabel>
                              <DataList.ItemValue>
                                <Text fontWeight="bold" color="cyan.400">
                                  {formatDuration(settings.transcodeDurationMs)}
                                </Text>
                              </DataList.ItemValue>
                            </DataList.Item>
                          )}

                          {settings.activeGpuWorkers !== undefined && settings.activeGpuWorkers > 0 && (
                            <DataList.Item>
                              <DataList.ItemLabel color="fg.muted">
                                <HStack gap={1}>
                                  <Icon as={LuLayers} boxSize={3} />
                                  <Text>GPU потоки</Text>
                                </HStack>
                              </DataList.ItemLabel>
                              <DataList.ItemValue>
                                <Badge colorPalette={settings.activeGpuWorkers > 1 ? 'purple' : 'gray'}>
                                  {settings.activeGpuWorkers} {settings.activeGpuWorkers > 1 ? '(Dual Encoder)' : ''}
                                </Badge>
                              </DataList.ItemValue>
                            </DataList.Item>
                          )}

                          {(settings.videoMaxConcurrent !== undefined || settings.audioMaxConcurrent !== undefined) && (
                            <DataList.Item>
                              <DataList.ItemLabel color="fg.muted">
                                Лимиты потоков
                              </DataList.ItemLabel>
                              <DataList.ItemValue>
                                <HStack gap={2}>
                                  {settings.videoMaxConcurrent !== undefined && (
                                    <Badge colorPalette="purple" size="sm">
                                      GPU: {settings.videoMaxConcurrent}
                                    </Badge>
                                  )}
                                  {settings.audioMaxConcurrent !== undefined && (
                                    <Badge colorPalette="cyan" size="sm">
                                      CPU: {settings.audioMaxConcurrent}
                                    </Badge>
                                  )}
                                </HStack>
                              </DataList.ItemValue>
                            </DataList.Item>
                          )}
                        </DataList.Root>
                      </Box>
                    )}

                    {/* FFmpeg команда */}
                    {settings.ffmpegCommand && (
                      <Box>
                        <HStack mb={2} justify="space-between">
                          <HStack>
                            <Icon as={LuTerminal} color="orange.400" boxSize={4} />
                            <Text fontWeight="semibold" fontSize="sm">
                              FFmpeg команда
                            </Text>
                          </HStack>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => navigator.clipboard.writeText(settings.ffmpegCommand ?? '')}
                          >
                            <Icon as={LuClipboard} boxSize={3} mr={1} />
                            Копировать
                          </Button>
                        </HStack>
                        <Code
                          display="block"
                          p={2}
                          bg="bg.subtle"
                          borderRadius="md"
                          fontSize="xs"
                          whiteSpace="pre-wrap"
                          wordBreak="break-all"
                          maxH="120px"
                          overflow="auto"
                        >
                          {settings.ffmpegCommand}
                        </Code>
                      </Box>
                    )}
                  </>
                ) : (
                  <Box p={4} bg="bg.subtle" borderRadius="md" textAlign="center">
                    <Text color="fg.subtle">Нет данных о кодировании</Text>
                    <Text color="fg.subtle" fontSize="sm">
                      Эпизод был импортирован до версии v0.9.0
                    </Text>
                  </Box>
                )}

                {/* Размеры файлов */}
                {(sourceSize || transcodedSize) && (
                  <Box>
                    <HStack mb={2}>
                      <Icon as={LuHardDrive} color="green.400" boxSize={4} />
                      <Text fontWeight="semibold" fontSize="sm">
                        Размеры файлов
                      </Text>
                    </HStack>
                    <DataList.Root size="sm">
                      {sourceSize && (
                        <DataList.Item>
                          <DataList.ItemLabel color="fg.muted">Исходный</DataList.ItemLabel>
                          <DataList.ItemValue>
                            <HStack gap={2}>
                              <Text>{formatBytes(sourceSize)}</Text>
                              {episode.isBdRemux && (
                                <Badge colorPalette="purple" size="sm">
                                  BDRemux
                                </Badge>
                              )}
                            </HStack>
                          </DataList.ItemValue>
                        </DataList.Item>
                      )}

                      {transcodedSize && (
                        <DataList.Item>
                          <DataList.ItemLabel color="fg.muted">После кодирования</DataList.ItemLabel>
                          <DataList.ItemValue>{formatBytes(transcodedSize)}</DataList.ItemValue>
                        </DataList.Item>
                      )}

                      {savings && (
                        <DataList.Item>
                          <DataList.ItemLabel color="fg.muted">
                            <HStack gap={1}>
                              <Icon as={LuPercent} boxSize={3} />
                              <Text>Экономия</Text>
                            </HStack>
                          </DataList.ItemLabel>
                          <DataList.ItemValue>
                            <Text
                              fontWeight="bold"
                              color={
                                Number(savings) > 50 ? 'green.400' : Number(savings) > 30 ? 'yellow.400' : 'orange.400'
                              }
                            >
                              {savings}%
                            </Text>
                          </DataList.ItemValue>
                        </DataList.Item>
                      )}
                    </DataList.Root>
                  </Box>
                )}
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <Button onClick={() => onOpenChange(false)}>Закрыть</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

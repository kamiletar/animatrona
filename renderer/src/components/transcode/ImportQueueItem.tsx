'use client'

/**
 * Карточка элемента очереди импорта
 *
 * Отображает:
 * - Название аниме
 * - Статус и прогресс
 * - Детальный прогресс (fps, speed, аудио-дорожки)
 * - Кнопки управления
 */

import { Badge, Box, Button, Card, Dialog, HStack, Icon, Image, Portal, Progress, Text, VStack } from '@chakra-ui/react'
import { useRouter } from 'next/navigation'
import { memo, useCallback, useState } from 'react'
import { LuCheck, LuClock, LuExternalLink, LuLoader, LuMusic, LuPencil, LuPlay, LuRefreshCw, LuTarget, LuTrash2, LuX, LuZap } from 'react-icons/lu'

import type { ImportQueueEntry, ImportQueueStatus } from '../../../../shared/types/import-queue'

interface ImportQueueItemProps {
  /** Элемент очереди */
  item: ImportQueueEntry
  /** Является ли текущим обрабатываемым */
  isCurrent: boolean
  /** Callback удаления */
  onRemove: () => void
  /** Callback повторной обработки (для error/cancelled) */
  onRetry?: (itemId: string) => void
  /** Callback редактирования (для pending) */
  onEdit?: () => void
  /** Элемент в фокусе (keyboard navigation) */
  isFocused?: boolean
  /** Callback при фокусе */
  onFocus?: () => void
}

/** Цвет бейджа статуса */
const statusColors: Record<ImportQueueStatus, string> = {
  pending: 'gray',
  vmaf: 'yellow',
  preparing: 'blue',
  transcoding: 'purple',
  postprocess: 'cyan',
  completed: 'green',
  error: 'red',
  cancelled: 'orange',
}

/** Названия статусов */
const statusLabels: Record<ImportQueueStatus, string> = {
  pending: 'Ожидает',
  vmaf: 'VMAF подбор',
  preparing: 'Подготовка',
  transcoding: 'Кодирование',
  postprocess: 'Обработка',
  completed: 'Завершён',
  error: 'Ошибка',
  cancelled: 'Отменён',
}

/** Иконка статуса */
const statusIcons: Record<ImportQueueStatus, typeof LuClock> = {
  pending: LuClock,
  vmaf: LuZap,
  preparing: LuLoader,
  transcoding: LuPlay,
  postprocess: LuLoader,
  completed: LuCheck,
  error: LuX,
  cancelled: LuX,
}

/** Названия стадий обработки */
const stageLabels: Record<string, string> = {
  idle: '',
  creating_anime: 'Создание аниме',
  creating_season: 'Создание сезона',
  demuxing: 'Демуксинг',
  creating_episodes: 'Создание эпизодов',
  transcoding_video: 'Кодирование видео',
  transcoding_audio: 'Кодирование аудио',
  generating_manifests: 'Генерация манифестов',
  syncing_relations: 'Синхронизация связей',
  done: 'Готово',
  error: 'Ошибка',
  cancelled: 'Отменено',
}

/** Форматирует скорость */
function formatSpeed(speed: number | undefined): string {
  if (!speed || speed === 0) {return 'N/A'}
  return `${speed.toFixed(2)}x`
}

/** Форматирует размер */
function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes === 0) {return ''}
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

/**
 * Мемоизированный компонент элемента очереди
 *
 * Сравнивает только критичные поля для предотвращения лишних re-renders:
 * - id и статус
 * - прогресс (с допуском 1%)
 * - isCurrent
 */
export const ImportQueueItem = memo(function ImportQueueItem({
  item,
  isCurrent,
  onRemove,
  onRetry,
  onEdit,
  isFocused,
  onFocus,
}: ImportQueueItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const router = useRouter()

  const StatusIcon = statusIcons[item.status]
  const isFinished = ['completed', 'error', 'cancelled'].includes(item.status)
  const selectedFilesCount = item.files.filter((f) => f.selected).length
  const animeName = item.selectedAnime.russian || item.selectedAnime.name

  const handleDelete = () => {
    setShowDeleteDialog(false)
    onRemove()
  }

  /** Переход на страницу аниме в библиотеке */
  const handleCardClick = useCallback(() => {
    if (item.status === 'completed' && item.createdAnimeId) {
      router.push(`/library/${item.createdAnimeId}`)
    }
  }, [item.status, item.createdAnimeId, router])

  /** Можно ли кликнуть на карточку */
  const isClickable = item.status === 'completed' && !!item.createdAnimeId

  return (
    <>
      {/* Диалог подтверждения удаления */}
      <Dialog.Root open={showDeleteDialog} onOpenChange={(e) => setShowDeleteDialog(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Удалить из очереди?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>Вы уверены, что хотите удалить "{animeName}" из очереди?</Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Отмена</Button>
                </Dialog.ActionTrigger>
                <Button colorPalette="red" onClick={handleDelete}>
                  Удалить
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

    <Card.Root
      bg="bg.panel"
      border="1px"
      borderColor={isFocused ? 'purple.500' : isCurrent ? 'purple.500' : 'border.subtle'}
      boxShadow={isCurrent ? 'md' : 'none'}
      cursor={isClickable ? 'pointer' : 'default'}
      onClick={isClickable ? handleCardClick : onFocus}
      role="listitem"
      tabIndex={isFocused ? 0 : -1}
      outline={isFocused ? '2px solid' : 'none'}
      outlineColor="purple.500"
      outlineOffset="2px"
      _hover={isClickable ? { borderColor: 'green.500', bg: 'green.950/20' } : undefined}
      transition="all 0.15s"
    >
      <Card.Body py={3}>
        <HStack gap={4} align="start">
          {/* Постер */}
          {item.selectedAnime.posterUrl && (
            <Image
              src={item.selectedAnime.posterUrl}
              alt={item.selectedAnime.name}
              w="60px"
              h="84px"
              objectFit="cover"
              borderRadius="md"
              flexShrink={0}
            />
          )}

          {/* Информация */}
          <VStack align="start" gap={1} flex={1}>
            {/* Название и статус */}
            <HStack justify="space-between" w="full">
              <Text fontWeight="semibold" lineClamp={1}>
                {item.selectedAnime.russian || item.selectedAnime.name}
              </Text>

              <HStack gap={2}>
                <Badge colorPalette={statusColors[item.status]} variant="subtle">
                  <Icon as={StatusIcon} boxSize={3} mr={1} />
                  {statusLabels[item.status]}
                </Badge>
                {isClickable && (
                  <Icon as={LuExternalLink} boxSize={4} color="green.400" />
                )}
              </HStack>
            </HStack>

            {/* Мета-информация */}
            <HStack gap={4} fontSize="sm" color="fg.muted">
              <Text>{selectedFilesCount} эп.</Text>
              {item.selectedAnime.kind && <Text>{item.selectedAnime.kind}</Text>}
              {item.parsedInfo.quality && <Text>{item.parsedInfo.quality}</Text>}
            </HStack>

            {/* VMAF подбор CQ */}
            {item.status === 'vmaf' && item.vmafProgress && (
              <Box w="full" mt={1}>
                <Progress.Root
                  value={(item.vmafProgress.currentIteration / item.vmafProgress.totalIterations) * 100}
                  size="sm"
                  colorPalette="yellow"
                >
                  <Progress.Track>
                    <Progress.Range />
                  </Progress.Track>
                </Progress.Root>
                <HStack justify="space-between" mt={1}>
                  <HStack gap={2}>
                    <Icon as={LuTarget} color="yellow.400" boxSize={3} />
                    <Text fontSize="xs" color="fg.muted">
                      Итерация {item.vmafProgress.currentIteration}/{item.vmafProgress.totalIterations}
                      {item.vmafProgress.currentCq !== undefined && ` • CQ ${item.vmafProgress.currentCq}`}
                    </Text>
                  </HStack>
                  {item.vmafProgress.lastVmaf !== undefined && (
                    <Text fontSize="xs" color="yellow.400" fontWeight="medium">
                      VMAF {item.vmafProgress.lastVmaf.toFixed(1)}
                    </Text>
                  )}
                </HStack>
                {/* История итераций (последние 3) */}
                {item.vmafProgress.lastIteration && (
                  <Text fontSize="xs" color="fg.muted" mt={1}>
                    {item.vmafProgress.stage === 'extracting' && 'Извлечение сэмплов...'}
                    {item.vmafProgress.stage === 'encoding' && 'Кодирование...'}
                    {item.vmafProgress.stage === 'calculating' && 'Расчёт VMAF...'}
                  </Text>
                )}
              </Box>
            )}

            {/* VMAF результат (после подбора, показываем во время кодирования) */}
            {item.vmafResult && item.status !== 'vmaf' && !isFinished && (
              <HStack gap={2} mt={1}>
                <Icon as={LuCheck} color="green.400" boxSize={3} />
                <Text fontSize="xs" color="green.400">
                  CQ {item.vmafResult.optimalCq} (VMAF {item.vmafResult.vmafScore.toFixed(1)})
                </Text>
              </HStack>
            )}

            {/* Прогресс (для активных статусов) */}
            {!isFinished && item.status !== 'vmaf' && item.progress !== undefined && item.progress > 0 && (
              <Box w="full" mt={1}>
                <Progress.Root value={item.progress} size="sm" colorPalette="purple">
                  <Progress.Track>
                    <Progress.Range />
                  </Progress.Track>
                </Progress.Root>
                <HStack justify="space-between" mt={1}>
                  <Text fontSize="xs" color="fg.muted">
                    {(item.currentStage && stageLabels[item.currentStage]) || item.currentFileName || ''}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    {item.progress.toFixed(0)}%
                  </Text>
                </HStack>

                {/* Детальный прогресс */}
                {item.detailProgress && (
                  <VStack gap={2} mt={2} align="stretch">
                    {/* FPS, скорость, размер */}
                    <HStack gap={4} fontSize="xs" color="fg.muted" flexWrap="wrap">
                      {item.detailProgress.fps !== undefined && item.detailProgress.fps > 0 && (
                        <HStack gap={1}>
                          <Text fontWeight="medium" color="green.400">
                            {item.detailProgress.fps.toFixed(0)}
                          </Text>
                          <Text>fps</Text>
                        </HStack>
                      )}
                      {item.detailProgress.speed !== undefined && item.detailProgress.speed > 0 && (
                        <HStack gap={1}>
                          <Icon as={LuZap} color="yellow.400" boxSize={3} />
                          <Text fontWeight="medium" color="yellow.400">
                            {formatSpeed(item.detailProgress.speed)}
                          </Text>
                        </HStack>
                      )}
                      {item.detailProgress.outputSize !== undefined && item.detailProgress.outputSize > 0 && (
                        <Text>{formatBytes(item.detailProgress.outputSize)}</Text>
                      )}
                    </HStack>

                    {/* Аудио-дорожки (компактно) */}
                    {item.detailProgress.audioTracks && item.detailProgress.audioTracks.length > 0 && (
                      <HStack gap={2} flexWrap="wrap">
                        {item.detailProgress.audioTracks.map((track) => (
                          <HStack
                            key={track.index}
                            gap={1}
                            px={2}
                            py={0.5}
                            bg={track.progress >= 100 ? 'green.900/30' : 'purple.900/30'}
                            borderRadius="sm"
                            fontSize="xs"
                          >
                            <Icon
                              as={track.progress >= 100 ? LuCheck : LuMusic}
                              color={track.progress >= 100 ? 'green.400' : 'purple.400'}
                              boxSize={3}
                            />
                            <Text color={track.progress >= 100 ? 'green.400' : 'purple.400'}>{track.name}</Text>
                            {track.progress < 100 && (
                              <Text color="purple.400" fontWeight="medium">
                                {track.progress}%
                              </Text>
                            )}
                          </HStack>
                        ))}
                      </HStack>
                    )}
                  </VStack>
                )}
              </Box>
            )}

            {/* Ошибка */}
            {item.status === 'error' && item.error && (
              <Text fontSize="sm" color="red.500">
                {item.error}
              </Text>
            )}
          </VStack>

          {/* Кнопки */}
          <VStack gap={1} onClick={(e) => e.stopPropagation()}>
            {/* Редактировать (только для pending) */}
            {item.status === 'pending' && onEdit && (
              <Button
                size="sm"
                variant="ghost"
                colorPalette="purple"
                onClick={onEdit}
                aria-label="Редактировать"
                minW="40px"
                minH="40px"
              >
                <Icon as={LuPencil} />
              </Button>
            )}
            {/* Повторить (только для error и cancelled) */}
            {(item.status === 'error' || item.status === 'cancelled') && onRetry && (
              <Button
                size="sm"
                variant="ghost"
                colorPalette="green"
                onClick={() => onRetry(item.id)}
                aria-label="Повторить обработку"
                minW="40px"
                minH="40px"
              >
                <Icon as={LuRefreshCw} />
              </Button>
            )}
            {/* Удалить (только для pending и завершённых) */}
            {(item.status === 'pending' || isFinished) && (
              <Button
                size="sm"
                variant="ghost"
                colorPalette="red"
                onClick={() => setShowDeleteDialog(true)}
                aria-label="Удалить элемент"
                minW="40px"
                minH="40px"
              >
                <Icon as={LuTrash2} />
              </Button>
            )}
          </VStack>
        </HStack>
      </Card.Body>
    </Card.Root>
    </>
  )
}, (prev, next) => {
  // Custom comparator: пропускаем render если критичные поля не изменились

  // ID и статус — всегда проверяем
  if (prev.item.id !== next.item.id) {return false}
  if (prev.item.status !== next.item.status) {return false}
  if (prev.isCurrent !== next.isCurrent) {return false}
  if (prev.isFocused !== next.isFocused) {return false}

  // Прогресс — с допуском 1% для снижения re-renders
  const prevProgress = prev.item.progress ?? 0
  const nextProgress = next.item.progress ?? 0
  if (Math.abs(prevProgress - nextProgress) >= 1) {return false}

  // VMAF прогресс — проверяем итерацию
  if (prev.item.vmafProgress?.currentIteration !== next.item.vmafProgress?.currentIteration) {return false}

  // Ошибка — для отображения сообщения
  if (prev.item.error !== next.item.error) {return false}

  // Если дошли сюда — props равны, пропускаем render
  return true
})

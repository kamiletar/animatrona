'use client'

/**
 * Панель активных воркеров
 *
 * Показывает сетку GPU и CPU воркеров с их текущим состоянием.
 * Используется внутри карточки текущего элемента очереди.
 */

import { Badge, Box, Card, Grid, HStack, Icon, Text, VStack, Wrap } from '@chakra-ui/react'
import { LuCpu, LuMonitor } from 'react-icons/lu'

import type { ImportQueueDetailProgress } from '../../../../shared/types/import-queue'
import { CpuWorkerCard } from './CpuWorkerCard'
import { GpuWorkerCard } from './GpuWorkerCard'

interface ActiveWorkersPanelProps {
  /** Детальный прогресс с данными о воркерах */
  progress: ImportQueueDetailProgress
}

export function ActiveWorkersPanel({ progress }: ActiveWorkersPanelProps) {
  const {
    videoWorkers = [],
    audioWorkers = [],
    videoTotal = 0,
    videoCompleted = 0,
    audioTotal = 0,
    audioCompleted = 0,
  } = progress

  // Фильтруем только активные воркеры
  const activeVideoWorkers = videoWorkers.filter((w) => w.progress < 100)
  const activeAudioWorkers = audioWorkers.filter((w) => w.status === 'running')
  const completedAudioWorkers = audioWorkers.filter((w) => w.status === 'completed').slice(0, 3)

  // Если нет воркеров — не показываем панель
  if (activeVideoWorkers.length === 0 && activeAudioWorkers.length === 0) {
    return null
  }

  return (
    <Card.Root bg="bg.subtle" variant="outline" borderColor="border.subtle">
      <Card.Header py={2} px={3}>
        <HStack justify="space-between">
          <Text fontSize="sm" fontWeight="medium" color="fg.muted">
            Активные воркеры
          </Text>
          <HStack gap={3}>
            {videoTotal > 0 && (
              <HStack gap={1}>
                <Icon as={LuMonitor} boxSize={3} color="purple.400" />
                <Badge colorPalette="purple" variant="subtle" size="sm">
                  {videoCompleted}/{videoTotal} видео
                </Badge>
              </HStack>
            )}
            {audioTotal > 0 && (
              <HStack gap={1}>
                <Icon as={LuCpu} boxSize={3} color="green.400" />
                <Badge colorPalette="green" variant="subtle" size="sm">
                  {audioCompleted}/{audioTotal} аудио
                </Badge>
              </HStack>
            )}
          </HStack>
        </HStack>
      </Card.Header>

      <Card.Body pt={0} pb={3} px={3}>
        <VStack gap={3} align="stretch">
          {/* GPU воркеры (видео) */}
          {activeVideoWorkers.length > 0 && (
            <Box role="region" aria-label={`GPU воркеры: ${activeVideoWorkers.length} активных`}>
              <HStack gap={1} mb={2}>
                <Icon as={LuMonitor} boxSize={3} color="purple.400" />
                <Text fontSize="xs" color="fg.muted">
                  Видео-потоки
                </Text>
              </HStack>
              <Grid
                templateColumns={{
                  base: '1fr',
                  sm: activeVideoWorkers.length > 1 ? 'repeat(2, 1fr)' : '1fr',
                  lg:
                    activeVideoWorkers.length > 2
                      ? 'repeat(3, 1fr)'
                      : activeVideoWorkers.length > 1
                        ? 'repeat(2, 1fr)'
                        : '1fr',
                }}
                gap={2}
              >
                {activeVideoWorkers.map((worker, idx) => (
                  <GpuWorkerCard key={`video-${idx}`} worker={worker} index={idx} />
                ))}
              </Grid>
            </Box>
          )}

          {/* CPU воркеры (аудио) */}
          {(activeAudioWorkers.length > 0 || completedAudioWorkers.length > 0) && (
            <Box
              role="region"
              aria-label={`CPU воркеры: ${activeAudioWorkers.length} активных, ${completedAudioWorkers.length} завершённых`}
            >
              <HStack gap={1} mb={2}>
                <Icon as={LuCpu} boxSize={3} color="green.400" />
                <Text fontSize="xs" color="fg.muted">
                  Аудио-дорожки
                </Text>
              </HStack>
              <Wrap gap={2} role="list">
                {/* Активные */}
                {activeAudioWorkers.map((worker) => (
                  <CpuWorkerCard key={worker.workerId} worker={worker} />
                ))}
                {/* Последние завершённые (для контекста) */}
                {completedAudioWorkers.map((worker) => (
                  <CpuWorkerCard key={worker.workerId} worker={worker} />
                ))}
              </Wrap>
            </Box>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}

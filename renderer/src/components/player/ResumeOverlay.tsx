/**
 * ResumeOverlay — оверлей для выбора продолжить просмотр или начать сначала
 *
 * Показывается если есть сохранённый прогресс > 10 секунд.
 * Автоматически выбирает "Продолжить" через 5 секунд.
 */

'use client'

import { Box, Button, HStack, Icon, Text, VStack } from '@chakra-ui/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LuPlay, LuRotateCcw } from 'react-icons/lu'

/** Минимальное время для показа overlay (секунды) */
const MIN_TIME_FOR_RESUME = 10

/** Время автовыбора "Продолжить" (секунды) */
const AUTO_SELECT_DELAY = 5

export interface ResumeOverlayProps {
  /** Сохранённое время просмотра (секунды) */
  savedTime: number
  /** Callback при выборе "Продолжить" */
  onResume: () => void
  /** Callback при выборе "Сначала" */
  onStartOver: () => void
  /** Показывать overlay */
  isOpen: boolean
}

/**
 * Форматирует время в MM:SS или HH:MM:SS
 */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Компонент оверлея для выбора — продолжить или начать сначала
 */
export function ResumeOverlay({ savedTime, onResume, onStartOver, isOpen }: ResumeOverlayProps) {
  const [countdown, setCountdown] = useState(AUTO_SELECT_DELAY)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Очистка таймера
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Запуск обратного отсчёта
  useEffect(() => {
    if (!isOpen || savedTime < MIN_TIME_FOR_RESUME) {
      return
    }

    // Сброс countdown при открытии
    setCountdown(AUTO_SELECT_DELAY)

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearTimer()
          // Автоматический выбор "Продолжить"
          onResume()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return clearTimer
  }, [isOpen, savedTime, onResume, clearTimer])

  // Не показывать если закрыт или время слишком маленькое
  if (!isOpen || savedTime < MIN_TIME_FOR_RESUME) {
    return null
  }

  const handleResume = () => {
    clearTimer()
    onResume()
  }

  const handleStartOver = () => {
    clearTimer()
    onStartOver()
  }

  // Процент прогресса обратного отсчёта (для визуализации)
  const progressPercent = (countdown / AUTO_SELECT_DELAY) * 100

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="blackAlpha.800"
      zIndex={50}
    >
      <VStack gap={6} p={8} borderRadius="xl" bg="bg.panel" shadow="2xl" maxW="400px">
        <Text fontSize="lg" color="white" textAlign="center">
          Продолжить просмотр?
        </Text>

        <Text fontSize="sm" color="fg.muted" textAlign="center">
          Вы остановились на <strong>{formatTime(savedTime)}</strong>
        </Text>

        <HStack gap={4} width="100%">
          {/* Кнопка "Сначала" */}
          <Button flex={1} variant="outline" colorPalette="gray" size="lg" onClick={handleStartOver}>
            <Icon as={LuRotateCcw} mr={2} />
            Сначала
          </Button>

          {/* Кнопка "Продолжить" с обратным отсчётом */}
          <Button flex={1} colorPalette="purple" size="lg" onClick={handleResume} position="relative" overflow="hidden">
            {/* Прогресс-бар обратного отсчёта */}
            <Box
              position="absolute"
              left={0}
              top={0}
              bottom={0}
              width={`${progressPercent}%`}
              bg="purple.400"
              opacity={0.3}
              transition="width 1s linear"
            />
            <Icon as={LuPlay} mr={2} zIndex={1} />
            <Text zIndex={1}>Продолжить ({countdown})</Text>
          </Button>
        </HStack>

        <Text fontSize="xs" color="fg.subtle" textAlign="center">
          Автоматически продолжится через {countdown} сек.
        </Text>
      </VStack>
    </Box>
  )
}

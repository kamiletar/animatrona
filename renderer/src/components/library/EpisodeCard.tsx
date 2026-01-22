'use client'

/**
 * Карточка эпизода с hover preview скриншотов и лайтбоксом
 * v0.9.0 — добавлена кнопка информации о кодировании
 */

import { Badge, Box, Card, HStack, Icon, IconButton, Image, Text } from '@chakra-ui/react'
import { LightboxViewer } from '@lena/ui'
import { useRouter } from 'next/navigation'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuCheck, LuClock, LuExpand, LuInfo, LuPlay } from 'react-icons/lu'

import { toMediaUrl } from '@/lib/media-url'

import { EncodingInfoDialog } from './EncodingInfoDialog'

interface EpisodeCardProps {
  id: string
  number: number
  name?: string | null
  durationMs?: number | null
  /** JSON массив путей к thumbnail-ам (320px) */
  thumbnailPaths?: string | null
  /** JSON массив путей к полноразмерным скриншотам (1280px) */
  screenshotPaths?: string | null
  /** Статус просмотра */
  watchStatus: 'unwatched' | 'in_progress' | 'completed'
  /** Прогресс просмотра (0-100) */
  watchProgress?: number
  /** JSON с настройками кодирования */
  encodingSettingsJson?: string | null
  /** Размер исходного файла в байтах */
  sourceSize?: bigint | null
  /** Размер транскодированного файла в байтах */
  transcodedSize?: bigint | null
  /** Источник — BDRemux (lossless качество с Blu-ray) */
  isBdRemux?: boolean
}

/**
 * Парсит JSON строку путей в массив
 */
function parsePathsJson(json: string | null | undefined): string[] {
  if (!json) {
    return []
  }
  try {
    const paths = JSON.parse(json)
    return Array.isArray(paths) ? paths : []
  } catch {
    return []
  }
}

/**
 * Форматирует длительность в минуты
 */
function formatDuration(ms: number | null | undefined): string {
  if (!ms) {
    return ''
  }
  return `${Math.floor(ms / 60000)} мин`
}

/** Конфигурация бейджей статуса — вынесена за пределы компонента */
const STATUS_BADGE_CONFIG = {
  completed: { icon: LuCheck, label: 'Просмотрено', color: 'green' },
  in_progress: { icon: LuClock, label: 'В процессе', color: 'blue' },
  unwatched: null,
} as const

/**
 * Карточка эпизода с hover preview
 * Обёрнута в React.memo для предотвращения лишних ререндеров
 */
export const EpisodeCard = memo(function EpisodeCard({
  id,
  number,
  name,
  durationMs,
  thumbnailPaths,
  screenshotPaths,
  watchStatus,
  watchProgress = 0,
  encodingSettingsJson,
  sourceSize,
  transcodedSize,
  isBdRemux,
}: EpisodeCardProps) {
  const router = useRouter()

  // Мемоизация парсинга JSON путей — избегаем повторного парсинга при каждом рендере
  const thumbnails = useMemo(() => parsePathsJson(thumbnailPaths), [thumbnailPaths])
  const fullScreenshots = useMemo(() => parsePathsJson(screenshotPaths), [screenshotPaths])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [encodingInfoOpen, setEncodingInfoOpen] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Hover preview — переключаем скриншоты каждые 500ms
  useEffect(() => {
    if (isHovering && thumbnails.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % thumbnails.length)
      }, 500)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setCurrentIndex(0)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isHovering, thumbnails.length])

  // Перейти к просмотру
  const handlePlayClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      router.push(`/watch/${id}`)
    },
    [router, id]
  )

  // Открыть лайтбокс
  const handleScreenshotClick = useCallback(
    (e: React.MouseEvent) => {
      if (fullScreenshots.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        setLightboxIndex(currentIndex)
        setLightboxOpen(true)
      }
    },
    [currentIndex, fullScreenshots.length]
  )

  // Открыть диалог информации о кодировании
  const handleEncodingInfoClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEncodingInfoOpen(true)
  }, [])

  // Текущий thumbnail для отображения
  const currentThumbnail = thumbnails[currentIndex] || thumbnails[0]

  // Мемоизация слайдов для лайтбокса — пересчитываем только при изменении скриншотов
  const lightboxSlides = useMemo(
    () =>
      fullScreenshots.map((path, i) => ({
        src: toMediaUrl(path) || '',
        alt: `Эпизод ${number} — кадр ${i + 1}`,
      })),
    [fullScreenshots, number]
  )

  // Бейдж статуса — используем константу вместо создания объекта
  const statusBadge = STATUS_BADGE_CONFIG[watchStatus]

  return (
    <>
      <Card.Root
        bg="bg.panel"
        border="1px"
        borderColor="border.subtle"
        overflow="hidden"
        _hover={{
          borderColor: 'purple.500',
          shadow: 'xl',
        }}
        _active={{
          transform: 'scale(0.98)',
          shadow: 'md',
        }}
        transition="all 0.15s ease-out"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Thumbnail (16:9) */}
        <Box position="relative" aspectRatio={16 / 9} cursor="pointer" onClick={handlePlayClick}>
          {currentThumbnail ? (
            <Image
              src={toMediaUrl(currentThumbnail) || undefined}
              alt={`Эпизод ${number}`}
              objectFit="cover"
              w="full"
              h="full"
            />
          ) : (
            <Box w="full" h="full" bg="bg.subtle" display="flex" alignItems="center" justifyContent="center">
              <Icon as={LuPlay} boxSize={10} color="fg.subtle" />
            </Box>
          )}

          {/* Overlay с кнопками при hover */}
          {isHovering && (
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              bg="blackAlpha.500"
              display="flex"
              alignItems="center"
              justifyContent="center"
              gap={3}
            >
              {/* Кнопка Play (главная) */}
              <IconButton
                aria-label="Смотреть"
                size="lg"
                colorPalette="purple"
                borderRadius="full"
                onClick={handlePlayClick}
              >
                <Icon as={LuPlay} boxSize={6} />
              </IconButton>

              {/* Кнопка Развернуть (лайтбокс) — только если есть скриншоты */}
              {fullScreenshots.length > 0 && (
                <IconButton
                  aria-label="Скриншоты"
                  size="sm"
                  variant="outline"
                  colorPalette="whiteAlpha"
                  borderRadius="full"
                  onClick={handleScreenshotClick}
                >
                  <Icon as={LuExpand} boxSize={4} />
                </IconButton>
              )}

              {/* Кнопка информации о кодировании — только если есть данные */}
              {encodingSettingsJson && (
                <IconButton
                  aria-label="Настройки кодирования"
                  size="sm"
                  variant="outline"
                  colorPalette="whiteAlpha"
                  borderRadius="full"
                  onClick={handleEncodingInfoClick}
                >
                  <Icon as={LuInfo} boxSize={4} />
                </IconButton>
              )}
            </Box>
          )}

          {/* Индикаторы скриншотов */}
          {thumbnails.length > 1 && (
            <HStack position="absolute" bottom={2} left="50%" transform="translateX(-50%)" gap={1}>
              {thumbnails.map((_, i) => (
                <Box
                  key={i}
                  w={1.5}
                  h={1.5}
                  borderRadius="full"
                  bg={i === currentIndex ? 'white' : 'whiteAlpha.500'}
                  transition="background 0.2s"
                />
              ))}
            </HStack>
          )}

          {/* Бейдж статуса */}
          {statusBadge && (
            <Badge
              position="absolute"
              top={2}
              right={2}
              colorPalette={statusBadge.color}
              display="flex"
              alignItems="center"
              gap={1}
            >
              <Icon as={statusBadge.icon} boxSize={3} />
              {statusBadge.label}
            </Badge>
          )}

          {/* Прогресс просмотра */}
          {watchStatus === 'in_progress' && watchProgress > 0 && (
            <Box position="absolute" bottom={0} left={0} right={0} h={1} bg="blackAlpha.700">
              <Box h="full" bg="purple.500" w={`${watchProgress}%`} transition="width 0.3s" />
            </Box>
          )}

          {/* Оверлей с номером и длительностью */}
          <Box position="absolute" bottom={0} left={0} right={0} bg="blackAlpha.800" py={1} px={2}>
            <HStack justify="space-between">
              <Text fontSize="xs" fontWeight="bold" color="white">
                Эпизод {number}
              </Text>
              {durationMs && (
                <Text fontSize="xs" color="fg.muted">
                  {formatDuration(durationMs)}
                </Text>
              )}
            </HStack>
          </Box>
        </Box>

        {/* Название */}
        {name && (
          <Card.Body py={2} px={3}>
            <Text fontSize="sm" lineClamp={1} color="fg.muted">
              {name}
            </Text>
          </Card.Body>
        )}
      </Card.Root>

      {/* Лайтбокс для полноэкранного просмотра скриншотов */}
      {lightboxSlides.length > 0 && (
        <LightboxViewer
          open={lightboxOpen}
          index={lightboxIndex}
          close={() => setLightboxOpen(false)}
          slides={lightboxSlides}
        />
      )}

      {/* Диалог информации о кодировании */}
      <EncodingInfoDialog
        open={encodingInfoOpen}
        onOpenChange={setEncodingInfoOpen}
        episode={{
          number,
          encodingSettingsJson,
          sourceSize,
          transcodedSize,
          isBdRemux,
        }}
      />
    </>
  )
})

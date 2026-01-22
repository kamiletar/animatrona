'use client'

/**
 * Hero секция страницы аниме
 *
 * Включает:
 * - Размытый постер как background с gradient overlay
 * - Постер с progress bar (кликабельный для лайтбокса)
 * - Название, год, эпизоды, жанры
 * - Primary CTA "Продолжить Эп.X — XX:XX"
 * - ActionMenu dropdown
 */

import type {
  AgeRating,
  AnimeSource,
  AnimeStatus,
  Genre,
  GenreOnAnime,
  Theme,
  ThemeOnAnime,
  WatchProgress,
  WatchStatus,
} from '@/generated/prisma'
import { toMediaUrl } from '@/lib/media-url'
import {
  Badge,
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  Heading,
  HStack,
  Icon,
  Image,
  Portal,
  Text,
  VStack,
} from '@chakra-ui/react'
import Link from 'next/link'
import { useState } from 'react'
import { LuCalendar, LuCheck, LuClock, LuPause, LuPlay, LuShield, LuStar, LuX } from 'react-icons/lu'

import { ActionMenu, type ActionMenuProps } from './ActionMenu'

/** Конфигурация статусов */
const statusLabels: Record<AnimeStatus, { label: string; color: string }> = {
  ONGOING: { label: 'Выходит', color: 'green' },
  COMPLETED: { label: 'Завершён', color: 'blue' },
  ANNOUNCED: { label: 'Анонс', color: 'yellow' },
}

/** Конфигурация возрастных рейтингов */
const ageRatingLabels: Record<AgeRating, { label: string; color: string }> = {
  G: { label: '0+', color: 'green' },
  PG: { label: '6+', color: 'teal' },
  PG_13: { label: '12+', color: 'blue' },
  R_17: { label: '16+', color: 'orange' },
  R_PLUS: { label: '18+', color: 'red' },
  RX: { label: '18+', color: 'red' },
}

/** Конфигурация первоисточников */
const sourceLabels: Record<AnimeSource, string> = {
  MANGA: 'Манга',
  LIGHT_NOVEL: 'Ранобэ',
  ORIGINAL: 'Оригинал',
  VISUAL_NOVEL: 'VN',
  GAME: 'Игра',
  WEB_MANGA: 'Веб-манга',
  OTHER: 'Другое',
}

/** Конфигурация статусов просмотра */
const watchStatusLabels: Record<WatchStatus, { label: string; color: string; icon: React.ElementType }> = {
  NOT_STARTED: { label: 'Не начато', color: 'gray', icon: LuPlay },
  WATCHING: { label: 'Смотрю', color: 'blue', icon: LuClock },
  COMPLETED: { label: 'Просмотрено', color: 'green', icon: LuCheck },
  ON_HOLD: { label: 'Отложено', color: 'yellow', icon: LuPause },
  DROPPED: { label: 'Брошено', color: 'red', icon: LuX },
  PLANNED: { label: 'Запланировано', color: 'purple', icon: LuCalendar },
}

export interface AnimeHeroProps {
  /** Название аниме */
  name: string
  /** Оригинальное название */
  originalName?: string | null
  /** Год выхода */
  year?: number | null
  /** Статус аниме */
  status: AnimeStatus
  /** Статус просмотра */
  watchStatus?: WatchStatus
  /** Рейтинг */
  rating?: number | null
  /** Возрастной рейтинг */
  ageRating?: AgeRating | null
  /** Первоисточник */
  source?: AnimeSource | null
  /** Длительность эпизода в минутах */
  duration?: number | null
  /** Количество эпизодов */
  episodeCount: number
  /** Загруженные эпизоды */
  loadedEpisodeCount: number
  /** Жанры */
  genres?: (GenreOnAnime & { genre: Genre })[]
  /** Темы */
  themes?: (ThemeOnAnime & { theme: Theme })[]
  /** Путь к постеру */
  posterPath?: string | null
  /** Прогресс просмотра */
  watchProgress?: WatchProgress[]
  /** Эпизоды для определения куда вести кнопку */
  episodes?: Array<{ id: string; number: number; durationMs: number | null }>
  /** Callbacks для ActionMenu */
  actionMenuProps: Omit<ActionMenuProps, 'hasEpisodes'>
}

/**
 * Форматирует время в MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Определяет целевой эпизод и информацию для CTA
 */
function getPlayTarget(
  episodes: AnimeHeroProps['episodes'],
  watchProgress: AnimeHeroProps['watchProgress'],
): {
  episodeId: string
  label: string
  isContinue: boolean
} | null {
  if (!episodes || episodes.length === 0) {return null}

  // Находим последний незавершённый прогресс (>10 сек)
  const lastInProgress = watchProgress?.find((p) => !p.completed && p.currentTime > 10)

  if (lastInProgress) {
    const episode = episodes.find((ep) => ep.id === lastInProgress.episodeId)
    if (episode) {
      return {
        episodeId: episode.id,
        label: `Продолжить Эп.${episode.number} — ${formatTime(lastInProgress.currentTime)}`,
        isContinue: true,
      }
    }
  }

  // Находим первый непросмотренный эпизод
  const firstUnwatched = episodes.find((ep) => !watchProgress?.find((p) => p.episodeId === ep.id)?.completed)

  if (firstUnwatched) {
    // Если это первый эпизод — "Начать смотреть"
    if (firstUnwatched.number === 1 && !watchProgress?.length) {
      return {
        episodeId: firstUnwatched.id,
        label: 'Начать смотреть',
        isContinue: false,
      }
    }
    return {
      episodeId: firstUnwatched.id,
      label: `Смотреть Эп.${firstUnwatched.number}`,
      isContinue: false,
    }
  }

  // Все просмотрены — предлагаем пересмотреть первый
  return {
    episodeId: episodes[0].id,
    label: 'Пересмотреть',
    isContinue: false,
  }
}

export function AnimeHero({
  name,
  originalName,
  year,
  status,
  watchStatus,
  rating,
  ageRating,
  source,
  duration,
  episodeCount,
  loadedEpisodeCount,
  genres,
  themes,
  posterPath,
  watchProgress,
  episodes,
  actionMenuProps,
}: AnimeHeroProps) {
  const statusInfo = statusLabels[status]
  const watchStatusInfo = watchStatus ? watchStatusLabels[watchStatus] : null
  const ageRatingInfo = ageRating ? ageRatingLabels[ageRating] : null
  const sourceLabel = source ? sourceLabels[source] : null
  const posterUrl = posterPath ? toMediaUrl(posterPath) : null

  // Лайтбокс для просмотра постера в полном размере
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  // Вычисляем общий прогресс (% просмотренных эпизодов)
  const watchedCount = watchProgress?.filter((p) => p.completed).length || 0
  const totalCount = loadedEpisodeCount || episodeCount || 1
  const overallProgress = (watchedCount / totalCount) * 100

  // Определяем куда вести кнопку
  const playTarget = getPlayTarget(episodes, watchProgress)

  // Жанры и темы как строка
  const genreNames = genres?.map((g) => g.genre.name) ?? []
  const themeNames = themes?.map((t) => t.theme.name) ?? []
  const allTagsText = [...genreNames, ...themeNames].join(', ')

  return (
    <Box position="relative" minH="280px" overflow="hidden">
      {/* Blurred background — "wow" эффект с несколькими слоями */}
      {posterUrl && (
        <>
          {/* Базовый размытый слой — более яркий */}
          <Image
            src={posterUrl}
            position="absolute"
            inset={0}
            w="full"
            h="full"
            objectFit="cover"
            filter="blur(60px) saturate(1.8) brightness(1.1)"
            transform="scale(1.4)"
            opacity={0.5}
            alt=""
          />
          {/* Дополнительный слой для глубины цвета */}
          <Image
            src={posterUrl}
            position="absolute"
            inset={0}
            w="full"
            h="full"
            objectFit="cover"
            filter="blur(100px) saturate(2) brightness(0.8)"
            transform="scale(1.6)"
            opacity={0.3}
            alt=""
          />
        </>
      )}

      {/* Gradient overlay — более плавный переход */}
      <Box
        position="absolute"
        inset={0}
        bgGradient="to-t"
        gradientFrom="bg"
        gradientVia="bg/80"
        gradientTo="bg/30"
      />
      {/* Дополнительный боковой градиент для глубины */}
      <Box
        position="absolute"
        inset={0}
        bgGradient="to-r"
        gradientFrom="bg/60"
        gradientVia="transparent"
        gradientTo="bg/40"
      />

      {/* Content */}
      <Flex
        position="relative"
        h="full"
        minH="280px"
        align="center"
        px={{ base: 4, md: 6, lg: 8 }}
        py={6}
        gap={{ base: 4, md: 6 }}
        flexDir={{ base: 'column', sm: 'row' }}
      >
        {/* Poster с progress bar (кликабельный для лайтбокса) */}
        <Box position="relative" flexShrink={0}>
          {posterUrl
            ? (
              <Image
                src={posterUrl}
                w={{ base: '140px', md: '160px', lg: '180px' }}
                borderRadius="lg"
                shadow="2xl"
                alt={name}
                cursor="pointer"
                onClick={() => setIsLightboxOpen(true)}
                transition="transform 0.2s, box-shadow 0.2s"
                _hover={{ transform: 'scale(1.02)', shadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' }}
                title="Нажмите для просмотра в полном размере"
              />
            )
            : (
              <Box
                w={{ base: '140px', md: '160px', lg: '180px' }}
                aspectRatio={2 / 3}
                bg="bg.subtle"
                borderRadius="lg"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Icon as={LuPlay} boxSize={12} color="fg.subtle" />
              </Box>
            )}

          {/* Progress bar на постере */}
          {overallProgress > 0 && (
            <Box position="absolute" bottom={0} left={0} right={0} h="4px" bg="blackAlpha.600" borderBottomRadius="lg">
              <Box
                w={`${overallProgress}%`}
                h="full"
                bg="purple.500"
                borderBottomRadius={overallProgress >= 100 ? 'lg' : undefined}
                borderBottomLeftRadius="lg"
                transition="width 0.3s ease-out"
              />
            </Box>
          )}
        </Box>

        {/* Info */}
        <VStack align={{ base: 'center', sm: 'start' }} gap={2} flex={1} textAlign={{ base: 'center', sm: 'left' }}>
          {/* Badges */}
          <HStack gap={2} flexWrap="wrap" justify={{ base: 'center', sm: 'start' }}>
            <Badge colorPalette={statusInfo.color} size="md">
              {statusInfo.label}
            </Badge>
            {rating && (
              <Badge colorPalette="yellow" display="flex" alignItems="center" gap={1}>
                <Icon as={LuStar} boxSize={3} />
                {rating.toFixed(1)}
              </Badge>
            )}
            {ageRatingInfo && (
              <Badge colorPalette={ageRatingInfo.color} display="flex" alignItems="center" gap={1}>
                <Icon as={LuShield} boxSize={3} />
                {ageRatingInfo.label}
              </Badge>
            )}
            {sourceLabel && (
              <Badge colorPalette="gray" variant="subtle">
                {sourceLabel}
              </Badge>
            )}
            {/* Статус просмотра (не показываем NOT_STARTED) */}
            {watchStatusInfo && watchStatus !== 'NOT_STARTED' && (
              <Badge colorPalette={watchStatusInfo.color} display="flex" alignItems="center" gap={1}>
                <Icon as={watchStatusInfo.icon} boxSize={3} />
                {watchStatusInfo.label}
              </Badge>
            )}
          </HStack>

          {/* Название */}
          <Heading size={{ base: 'lg', md: 'xl', lg: '2xl' }} lineClamp={2}>
            {name}
          </Heading>

          {originalName && (
            <Text color="fg.muted" fontSize={{ base: 'sm', md: 'md' }} lineClamp={1}>
              {originalName}
            </Text>
          )}

          {/* Метаданные */}
          <HStack gap={2} color="fg.subtle" fontSize="sm" flexWrap="wrap" justify={{ base: 'center', sm: 'start' }}>
            {year && <Text>{year}</Text>}
            {year && <Text>•</Text>}
            <Text>
              {loadedEpisodeCount}
              {episodeCount > 0 && loadedEpisodeCount !== episodeCount && ` / ${episodeCount}`} эп.
            </Text>
            {duration && (
              <>
                <Text>•</Text>
                <HStack gap={1}>
                  <Icon as={LuClock} boxSize={3} />
                  <Text>~{duration} мин</Text>
                </HStack>
              </>
            )}
            {allTagsText && (
              <>
                <Text>•</Text>
                <Text lineClamp={1}>{allTagsText}</Text>
              </>
            )}
          </HStack>

          {/* Actions */}
          <HStack mt={3} gap={2} flexWrap="wrap" justify={{ base: 'center', sm: 'start' }}>
            {playTarget
              ? (
                <Link href={`/watch/${playTarget.episodeId}`}>
                  <Button colorPalette="purple" size={{ base: 'md', md: 'lg' }}>
                    <Icon as={LuPlay} />
                    {playTarget.label}
                  </Button>
                </Link>
              )
              : (
                <Button colorPalette="purple" size={{ base: 'md', md: 'lg' }} disabled>
                  <Icon as={LuPlay} />
                  Нет эпизодов
                </Button>
              )}

            <ActionMenu {...actionMenuProps} hasEpisodes={!!episodes && episodes.length > 0} />
          </HStack>
        </VStack>
      </Flex>

      {/* Лайтбокс для просмотра постера в полном размере */}
      {posterUrl && (
        <Dialog.Root
          open={isLightboxOpen}
          onOpenChange={(e) => setIsLightboxOpen(e.open)}
          size="cover"
          placement="center"
          motionPreset="scale"
        >
          <Portal>
            <Dialog.Backdrop bg="blackAlpha.900" />
            <Dialog.Positioner>
              <Dialog.Content
                bg="transparent"
                shadow="none"
                maxW="90vw"
                maxH="90vh"
                p={0}
                onClick={() => setIsLightboxOpen(false)}
              >
                <Dialog.CloseTrigger asChild position="fixed" top={4} right={4}>
                  <CloseButton
                    size="lg"
                    colorPalette="whiteAlpha"
                    bg="blackAlpha.600"
                    _hover={{ bg: 'blackAlpha.700' }}
                  />
                </Dialog.CloseTrigger>
                <Image
                  src={posterUrl}
                  maxH="90vh"
                  maxW="90vw"
                  objectFit="contain"
                  borderRadius="lg"
                  shadow="2xl"
                  alt={name}
                />
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      )}
    </Box>
  )
}

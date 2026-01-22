'use client'

import { Badge, Box, Collapsible, HStack, Icon, Image, Text, VStack } from '@chakra-ui/react'
import Link from 'next/link'
import { LuChevronDown, LuChevronRight, LuFilm, LuPlay, LuTv } from 'react-icons/lu'

/** Маппинг типов аниме на иконки */
const KIND_ICONS: Record<string, typeof LuTv> = {
  tv: LuTv,
  movie: LuFilm,
  ova: LuPlay,
  ona: LuPlay,
  special: LuPlay,
}

interface FranchiseAnime {
  id: string
  title: string
  posterUrl?: string | null
  kind?: string | null
  year?: number | null
  episodesTotal?: number | null
  episodesLoaded?: number
}

/** Незагруженное аниме из связей */
interface MissingAnime {
  shikimoriId: number
  title: string
  posterUrl?: string | null
  kind?: string | null
  year?: number | null
}

interface FranchiseCardProps {
  /** Название франшизы */
  name: string
  /** Главное аниме (первое в списке) */
  mainAnime: FranchiseAnime
  /** Связанные аниме */
  relatedAnimes: FranchiseAnime[]
  /** Незагруженные аниме франшизы */
  missingAnimes?: MissingAnime[]
  /** Открыта ли карточка по умолчанию */
  defaultOpen?: boolean
}

/**
 * Карточка франшизы с раскрывающимся списком связанных аниме
 * Используется в библиотеке при группировке по франшизам
 */
export function FranchiseCard({
  name,
  mainAnime,
  relatedAnimes,
  missingAnimes = [],
  defaultOpen = false,
}: FranchiseCardProps) {
  // Общее количество включая незагруженные
  const totalCount = relatedAnimes.length + 1 + missingAnimes.length
  const loadedCount = relatedAnimes.filter((a) => a.episodesLoaded && a.episodesLoaded > 0).length + 1

  const KindIcon = mainAnime.kind ? KIND_ICONS[mainAnime.kind] || LuPlay : LuPlay

  return (
    <Collapsible.Root defaultOpen={defaultOpen}>
      <Box
        bg="bg.panel"
        borderRadius="lg"
        border="1px"
        borderColor="border.subtle"
        overflow="hidden"
        _hover={{ borderColor: 'purple.600' }}
        transition="border-color 0.2s"
      >
        {/* Заголовок — кликабельный для раскрытия */}
        <Collapsible.Trigger asChild>
          <HStack
            p={3}
            cursor="pointer"
            _hover={{ bg: 'bg.subtle' }}
            _active={{ transform: 'scale(0.99)', bg: 'bg.muted' }}
            transition="all 0.1s ease-out"
          >
            {/* Постер главного аниме */}
            <Box w="60px" h="84px" flexShrink={0} borderRadius="md" overflow="hidden" bg="bg.subtle">
              {mainAnime.posterUrl ? (
                <Image src={mainAnime.posterUrl} alt={mainAnime.title} w="full" h="full" objectFit="cover" />
              ) : (
                <Box w="full" h="full" display="flex" alignItems="center" justifyContent="center">
                  <Icon as={KindIcon} boxSize={6} color="fg.subtle" />
                </Box>
              )}
            </Box>

            {/* Информация */}
            <VStack align="start" gap={1} flex={1} minW={0}>
              <Text fontWeight="bold" fontSize="md" lineClamp={1}>
                {name}
              </Text>
              <HStack gap={2}>
                <Badge size="sm" colorPalette={loadedCount === totalCount ? 'green' : 'gray'} variant="subtle">
                  {loadedCount}/{totalCount} загружено
                </Badge>
                {mainAnime.year && (
                  <Text fontSize="xs" color="fg.subtle">
                    с {mainAnime.year}
                  </Text>
                )}
              </HStack>
            </VStack>

            {/* Индикатор раскрытия */}
            <Collapsible.Context>
              {({ open }) => <Icon as={open ? LuChevronDown : LuChevronRight} boxSize={5} color="fg.muted" />}
            </Collapsible.Context>
          </HStack>
        </Collapsible.Trigger>

        {/* Содержимое — список всех аниме */}
        <Collapsible.Content>
          <VStack align="stretch" gap={0} borderTop="1px" borderColor="border.subtle">
            {/* Главное аниме */}
            <FranchiseAnimeRow anime={mainAnime} isMain />

            {/* Связанные */}
            {relatedAnimes.map((anime) => (
              <FranchiseAnimeRow key={anime.id} anime={anime} />
            ))}

            {/* Незагруженные */}
            {missingAnimes.length > 0 && (
              <>
                {/* Разделитель */}
                <Box px={3} py={2} bg="bg.muted">
                  <Text fontSize="xs" color="fg.subtle" fontWeight="medium">
                    Не импортировано ({missingAnimes.length})
                  </Text>
                </Box>
                {missingAnimes.map((anime) => (
                  <MissingAnimeRow key={anime.shikimoriId} anime={anime} />
                ))}
              </>
            )}
          </VStack>
        </Collapsible.Content>
      </Box>
    </Collapsible.Root>
  )
}

/** Строка одного аниме внутри FranchiseCard */
function FranchiseAnimeRow({ anime, isMain = false }: { anime: FranchiseAnime; isMain?: boolean }) {
  const KindIcon = anime.kind ? KIND_ICONS[anime.kind] || LuPlay : LuPlay
  const hasEpisodes = anime.episodesLoaded && anime.episodesLoaded > 0

  return (
    <Link href={`/library/${anime.id}`}>
      <HStack
        p={3}
        pl={isMain ? 3 : 6}
        bg={isMain ? 'bg.subtle' : 'transparent'}
        _hover={{ bg: 'bg.subtle' }}
        _active={{ transform: 'scale(0.98)', bg: 'bg.muted' }}
        transition="all 0.1s ease-out"
        cursor="pointer"
        borderBottom="1px"
        borderColor="border.subtle"
        _last={{ borderBottom: 'none' }}
      >
        {/* Миниатюра */}
        <Box w="32px" h="44px" flexShrink={0} borderRadius="sm" overflow="hidden" bg="bg.subtle">
          {anime.posterUrl ? (
            <Image src={anime.posterUrl} alt={anime.title} w="full" h="full" objectFit="cover" />
          ) : (
            <Box w="full" h="full" display="flex" alignItems="center" justifyContent="center">
              <Icon as={KindIcon} boxSize={3} color="fg.subtle" />
            </Box>
          )}
        </Box>

        {/* Информация */}
        <VStack align="start" gap={0} flex={1} minW={0}>
          <HStack gap={2}>
            <Text fontSize="sm" fontWeight={isMain ? 'bold' : 'medium'} lineClamp={1}>
              {anime.title}
            </Text>
            {isMain && (
              <Badge size="xs" colorPalette="purple" variant="subtle">
                Главное
              </Badge>
            )}
          </HStack>
          <HStack gap={2}>
            {anime.kind && (
              <Text fontSize="xs" color="fg.subtle" textTransform="uppercase">
                {anime.kind}
              </Text>
            )}
            {anime.year && (
              <Text fontSize="xs" color="fg.subtle">
                {anime.year}
              </Text>
            )}
            {anime.episodesTotal && (
              <Text fontSize="xs" color="fg.subtle">
                {anime.episodesLoaded || 0}/{anime.episodesTotal} эп.
              </Text>
            )}
          </HStack>
        </VStack>

        {/* Статус загрузки */}
        <Box w={2} h={2} borderRadius="full" bg={hasEpisodes ? 'green.500' : 'fg.subtle'} flexShrink={0} />
      </HStack>
    </Link>
  )
}

/** Строка незагруженного аниме (grayscale) */
function MissingAnimeRow({ anime }: { anime: MissingAnime }) {
  const KindIcon = anime.kind ? KIND_ICONS[anime.kind] || LuPlay : LuPlay

  return (
    <HStack
      p={3}
      pl={6}
      bg="transparent"
      opacity={0.5}
      borderBottom="1px"
      borderColor="border.subtle"
      _last={{ borderBottom: 'none' }}
    >
      {/* Миниатюра в grayscale */}
      <Box w="32px" h="44px" flexShrink={0} borderRadius="sm" overflow="hidden" bg="bg.subtle" filter="grayscale(100%)">
        {anime.posterUrl ? (
          <Image src={anime.posterUrl} alt={anime.title} w="full" h="full" objectFit="cover" />
        ) : (
          <Box w="full" h="full" display="flex" alignItems="center" justifyContent="center">
            <Icon as={KindIcon} boxSize={3} color="fg.subtle" />
          </Box>
        )}
      </Box>

      {/* Информация */}
      <VStack align="start" gap={0} flex={1} minW={0}>
        <HStack gap={2}>
          <Text fontSize="sm" fontWeight="medium" lineClamp={1} color="fg.subtle">
            {anime.title}
          </Text>
        </HStack>
        <HStack gap={2}>
          {anime.kind && (
            <Text fontSize="xs" color="fg.subtle" textTransform="uppercase">
              {anime.kind}
            </Text>
          )}
          {anime.year && (
            <Text fontSize="xs" color="fg.subtle">
              {anime.year}
            </Text>
          )}
        </HStack>
      </VStack>

      {/* Индикатор — не загружено */}
      <Badge size="xs" colorPalette="gray" variant="subtle">
        Нет
      </Badge>
    </HStack>
  )
}

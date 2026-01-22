'use client'

import { AspectRatio, Box, Grid, Icon, Text, VStack } from '@chakra-ui/react'
import { memo } from 'react'
import { LuFilm } from 'react-icons/lu'

import type { WatchStatus } from '@/generated/prisma'

import { AnimeCard } from './AnimeCard'

interface Anime {
  id: string
  name: string
  originalName?: string | null
  year?: number | null
  status: 'ONGOING' | 'COMPLETED' | 'ANNOUNCED'
  episodeCount: number
  rating?: number | null
  poster?: { path: string } | null
  genres?: { genre: { name: string } }[]
  /** Статус просмотра */
  watchStatus?: WatchStatus
}

interface AnimeGridProps {
  animes: Anime[]
  isLoading?: boolean
  /** Колбэк для продолжения просмотра */
  onPlay?: (id: string) => void
  /** Колбэк для экспорта */
  onExport?: (id: string) => void
  /** Колбэк для обновления метаданных */
  onRefreshMetadata?: (id: string) => void
  /** Колбэк для удаления */
  onDelete?: (id: string) => void
  /** Колбэк для изменения статуса просмотра */
  onWatchStatusChange?: (id: string, status: WatchStatus) => void
}

/**
 * Сетка карточек аниме
 * Обёрнута в React.memo для предотвращения лишних ререндеров
 */
export const AnimeGrid = memo(function AnimeGrid({
  animes,
  isLoading,
  onPlay,
  onExport,
  onRefreshMetadata,
  onDelete,
  onWatchStatusChange,
}: AnimeGridProps) {
  if (isLoading) {
    return (
      <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={4} alignItems="start">
        {Array.from({ length: 8 }).map((_, i) => (
          <AspectRatio key={i} ratio={2 / 3}>
            <Box bg="bg.panel" borderRadius="lg" animation="pulse 2s infinite" />
          </AspectRatio>
        ))}
      </Grid>
    )
  }

  if (animes.length === 0) {
    return (
      <Box textAlign="center" py={16} px={4} borderRadius="xl" border="2px dashed" borderColor="border.subtle">
        <VStack gap={4}>
          <Icon as={LuFilm} boxSize={16} color="fg.subtle" />
          <Box>
            <Text fontSize="xl" fontWeight="semibold" color="fg.muted">
              Аниме не найдено
            </Text>
            <Text color="fg.subtle">Попробуйте изменить параметры поиска или добавьте новое аниме</Text>
          </Box>
        </VStack>
      </Box>
    )
  }

  return (
    <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={4} alignItems="stretch">
      {animes.map((anime) => (
        <AnimeCard
          key={anime.id}
          id={anime.id}
          name={anime.name}
          originalName={anime.originalName}
          year={anime.year}
          status={anime.status}
          episodeCount={anime.episodeCount}
          rating={anime.rating}
          posterPath={anime.poster?.path}
          genres={anime.genres?.map((g) => g.genre.name)}
          watchStatus={anime.watchStatus}
          onPlay={onPlay}
          onExport={onExport}
          onRefreshMetadata={onRefreshMetadata}
          onDelete={onDelete}
          onWatchStatusChange={onWatchStatusChange}
        />
      ))}
    </Grid>
  )
})

'use client'

/**
 * Компонент для отображения аниме сгруппированных по франшизам
 */

import { Box, Icon, Text, VStack } from '@chakra-ui/react'
import { LuLayers } from 'react-icons/lu'

import { AnimeGrid, FranchiseCard } from '@/components/library'
import type { WatchStatus } from '@/generated/prisma'
import { toMediaUrl } from '@/lib/media-url'

import type { AnimeWithFranchise, FranchiseGroup } from './types'

/** Пропсы для FranchiseView */
export interface FranchiseViewProps {
  franchiseGroups: FranchiseGroup[]
  standAloneAnimes: AnimeWithFranchise[]
  isLoading?: boolean
  /** Колбэки для меню карточек */
  onPlay?: (id: string) => void
  onExport?: (id: string) => void
  onRefreshMetadata?: (id: string) => void
  onDelete?: (id: string) => void
  /** Колбэк для изменения статуса просмотра */
  onWatchStatusChange?: (id: string, status: WatchStatus) => void
}

/**
 * Скелетон загрузки
 */
function LoadingSkeleton() {
  return (
    <VStack gap={4} align="stretch">
      {Array.from({ length: 4 }).map((_, i) => (
        <Box key={i} bg="bg.panel" borderRadius="lg" h="100px" animation="pulse 2s infinite" />
      ))}
    </VStack>
  )
}

/**
 * Пустое состояние (нет контента)
 */
function EmptyState() {
  return (
    <Box textAlign="center" py={16} px={4} borderRadius="xl" border="2px dashed" borderColor="border.subtle">
      <VStack gap={4}>
        <Icon as={LuLayers} boxSize={16} color="fg.subtle" />
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

export function FranchiseView({
  franchiseGroups,
  standAloneAnimes,
  isLoading,
  onPlay,
  onExport,
  onRefreshMetadata,
  onDelete,
  onWatchStatusChange,
}: FranchiseViewProps) {
  if (isLoading) {
    return <LoadingSkeleton />
  }

  const hasContent = franchiseGroups.length > 0 || standAloneAnimes.length > 0

  if (!hasContent) {
    return <EmptyState />
  }

  return (
    <VStack gap={4} align="stretch">
      {/* Франшизы */}
      {franchiseGroups.map((group) => {
        // Первое аниме — главное (может быть TV сериал)
        const mainAnime = group.animes[0]
        const relatedAnimes = group.animes.slice(1)

        return (
          <FranchiseCard
            key={group.franchise.id}
            name={group.franchise.name}
            mainAnime={{
              id: mainAnime.id,
              title: mainAnime.name,
              posterUrl: toMediaUrl(mainAnime.poster?.path) || undefined,
              year: mainAnime.year,
              episodesTotal: mainAnime.episodeCount,
              episodesLoaded: mainAnime.episodeCount,
            }}
            relatedAnimes={relatedAnimes.map((anime) => ({
              id: anime.id,
              title: anime.name,
              posterUrl: toMediaUrl(anime.poster?.path) || undefined,
              year: anime.year,
              episodesTotal: anime.episodeCount,
              episodesLoaded: anime.episodeCount,
            }))}
            missingAnimes={group.missingAnimes.map((rel) => ({
              shikimoriId: rel.targetShikimoriId,
              title: rel.targetName || 'Без названия',
              posterUrl: rel.targetPosterUrl,
              year: rel.targetYear,
              kind: rel.targetKind,
            }))}
            defaultOpen={false}
          />
        )
      })}

      {/* Одиночные аниме без франшизы */}
      {standAloneAnimes.length > 0 && (
        <>
          {franchiseGroups.length > 0 && (
            <Text color="fg.subtle" fontSize="sm" mt={4}>
              Без франшизы ({standAloneAnimes.length})
            </Text>
          )}
          <AnimeGrid
            animes={standAloneAnimes}
            onPlay={onPlay}
            onExport={onExport}
            onRefreshMetadata={onRefreshMetadata}
            onDelete={onDelete}
            onWatchStatusChange={onWatchStatusChange}
          />
        </>
      )}
    </VStack>
  )
}

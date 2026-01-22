'use client'

/**
 * Табы для страницы аниме
 *
 * - Эпизоды (default) — сразу после hero
 * - О сериале — описание + метаданные
 * - Связанные — RelatedAnimeList
 * - Франшиза — интерактивный граф (если есть shikimoriId)
 * - Видео — опенинги, эндинги, трейлеры (если есть)
 */

import { Badge, Box, Tabs } from '@chakra-ui/react'
import { type ReactNode } from 'react'

export interface AnimeDetailTabsProps {
  /** Количество эпизодов для badge */
  episodeCount: number
  /** Есть ли видео */
  hasVideos: boolean
  /** Показывать таб франшизы (требует shikimoriId) */
  hasFranchise?: boolean
  /** Контент табов */
  children: {
    episodes: ReactNode
    about: ReactNode
    related: ReactNode
    franchise?: ReactNode
    videos?: ReactNode
  }
}

export function AnimeDetailTabs({ episodeCount, hasVideos, hasFranchise, children }: AnimeDetailTabsProps) {
  return (
    <Tabs.Root defaultValue="episodes" lazyMount unmountOnExit={false}>
      <Tabs.List mb={4}>
        <Tabs.Trigger value="episodes">
          Эпизоды
          <Badge ml={2} size="sm" colorPalette="purple" variant="subtle">
            {episodeCount}
          </Badge>
        </Tabs.Trigger>
        <Tabs.Trigger value="about">О сериале</Tabs.Trigger>
        <Tabs.Trigger value="related">Связанные</Tabs.Trigger>
        {hasFranchise && <Tabs.Trigger value="franchise">Франшиза</Tabs.Trigger>}
        {hasVideos && <Tabs.Trigger value="videos">Видео</Tabs.Trigger>}
      </Tabs.List>

      <Box>
        <Tabs.Content value="episodes">{children.episodes}</Tabs.Content>

        <Tabs.Content value="about">{children.about}</Tabs.Content>

        <Tabs.Content value="related">{children.related}</Tabs.Content>

        {hasFranchise && <Tabs.Content value="franchise">{children.franchise}</Tabs.Content>}

        {hasVideos && <Tabs.Content value="videos">{children.videos}</Tabs.Content>}
      </Box>
    </Tabs.Root>
  )
}

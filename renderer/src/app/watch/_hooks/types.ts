'use client'

/**
 * Типы для хуков страницы просмотра
 */

import type { AudioTrack, Chapter as DbChapter, Episode, SubtitleFont, SubtitleTrack } from '@/generated/prisma'

/** Тип SubtitleTrack с включёнными шрифтами */
export type SubtitleTrackWithFonts = SubtitleTrack & {
  fonts: SubtitleFont[]
}

/** Тип Episode с включёнными дорожками и главами */
export type EpisodeWithTracks = Episode & {
  audioTracks: AudioTrack[]
  subtitleTracks: SubtitleTrackWithFonts[]
  chapters: DbChapter[]
  /** Путь к манифесту (для определения папки эпизода при записи progress.meta.json) */
  manifestPath: string | null
  anime: {
    id: string
    name: string
    originalName: string | null
    year: number | null
    folderPath: string | null
    shikimoriId: number | null
    watchStatus: string
    userRating: number | null
    isBdRemux: boolean
    lastSelectedAudioDubGroup: string | null
    lastSelectedSubtitleDubGroup: string | null
    lastSelectedAudioLanguage: string | null
    lastSelectedSubtitleLanguage: string | null
    poster: { path: string } | null
  }
  season: { id: string; number: number } | null
}

/** Минимальная информация об эпизоде для навигации */
export interface EpisodeNavInfo {
  id: string
  number: number
  name?: string | null
  /** JSON массив путей к thumbnail-ам для UpNext overlay */
  thumbnailPaths?: string | null
}

/** Интервал сохранения прогресса (мс) */
export const SAVE_INTERVAL = 5000

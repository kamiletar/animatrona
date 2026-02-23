/**
 * Типы для страницы библиотеки
 */

import type { WatchStatus } from '@/generated/prisma'

/** Тип режима отображения */
export type ViewMode = 'individual' | 'franchise'

/** Ключ localStorage для сохранения режима */
export const VIEW_MODE_STORAGE_KEY = 'animatrona:library:viewMode'

/** Связь с незагруженным аниме */
export interface MissingAnimeRelation {
  id: string
  targetShikimoriId: number
  targetName: string | null
  targetPosterUrl: string | null
  targetYear: number | null
  targetKind: string | null
  relationKind: string
}

/** Тип аниме с данными франшизы */
export interface AnimeWithFranchise {
  id: string
  name: string
  originalName?: string | null
  year?: number | null
  status: 'ONGOING' | 'COMPLETED' | 'ANNOUNCED'
  episodeCount: number
  rating?: number | null
  poster?: { path: string } | null
  genres?: { genre: { name: string } }[]
  franchise?: { id: string; name: string } | null
  /** Статус просмотра */
  watchStatus?: WatchStatus
  /** Связи с другими аниме (для определения отсутствующих) */
  sourceRelations?: MissingAnimeRelation[]
  /** Путь к папке аниме в библиотеке */
  folderPath?: string | null
  /** Shikimori ID для сверки с незагруженными */
  shikimoriId?: number | null
}

/** Группа аниме по франшизе */
export interface FranchiseGroup {
  franchise: { id: string; name: string }
  animes: AnimeWithFranchise[]
  /** Незагруженные аниме франшизы (только для отображения) */
  missingAnimes: MissingAnimeRelation[]
}

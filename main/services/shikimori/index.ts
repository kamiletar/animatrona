/**
 * Shikimori GraphQL сервис
 * Экспорт публичного API
 */

export { downloadPoster, getAnimeDetails, getAnimeExtended, getAnimeWithRelated, searchAnime } from './client'
export type {
  PosterDownloadResult,
  ShikimoriAnimeDetails,
  ShikimoriAnimeExtended,
  ShikimoriAnimePreview,
  ShikimoriAnimeWithRelated,
  ShikimoriCharacter,
  ShikimoriCharacterRole,
  ShikimoriExternalLink,
  // Типы для REST API графа франшизы
  ShikimoriFranchiseGraph,
  ShikimoriFranchiseLink,
  ShikimoriFranchiseNode,
  ShikimoriPerson,
  ShikimoriPersonRole,
  ShikimoriRelatedAnime,
  ShikimoriRelationKind,
  ShikimoriScoreStat,
  ShikimoriSearchOptions,
  ShikimoriStatusStat,
  ShikimoriStudio,
  ShikimoriVideo,
} from './types'

/**
 * Модуль импорта аниме
 *
 * Разбит на логические части:
 * - types.ts — типы и интерфейсы
 * - helpers.ts — чистые функции (утилиты)
 * - use-import-state.ts — управление состоянием (reducer)
 * - use-import-events.ts — подписки на Electron события
 * - use-import-mutations.ts — 13 мутаций TanStack Query
 * - import-processor.ts — основная логика импорта (класс)
 * - use-import-flow.ts — координатор (React хук)
 */

// Типы
export type {
  AnimeRelation,
  AudioTrackProgress,
  DonorMatchInfo,
  ExtendedTranscodeProgress,
  ExternalTrack,
  ImportAction,
  ImportOptions,
  ImportRefs,
  ImportResult,
  ImportState,
  PostProcessData,
  ProcessingStage,
} from './types'

export { initialImportState } from './types'

// Helpers (чистые функции)
export {
  createConcurrencyLimiter,
  detectChapterType,
  formatChannels,
  getPosterUrl,
  isChapterSkippable,
  mapSeasonType,
  mapShikimoriStatus,
  needsAudioTranscode,
} from './helpers'

// State management
export { importActions, importReducer, useImportState } from './use-import-state'

// Event subscriptions
export { useImportProgressEvents, useParallelTranscodeEvents } from './use-import-events'

// Mutations
export { useImportMutations } from './use-import-mutations'
export type { ImportMutations } from './use-import-mutations'

// Processor
export { ImportProcessor } from './import-processor'

// Main hook (координатор)
export { useImportFlow } from './use-import-flow'

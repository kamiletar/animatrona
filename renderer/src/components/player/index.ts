/**
 * Компоненты плеера
 */

export { VideoPlayer } from './VideoPlayer'

// Типы из types.ts
export type { AudioTrackInfo, PlayerState, SubtitleFormat, VideoPlayerProps, VideoPlayerRef } from './types'

// Константы
export { AUDIO_SYNC_THRESHOLD, HIDE_CONTROLS_TIMEOUT, SKIP_TIME, VOLUME_STEP } from './constants'

// Хуки (для расширения плеера)
export {
  useAudioSync,
  useAutoHideControls,
  useKeyboardShortcuts,
  usePlayerControls,
  usePlayerState,
  useSubtitleManagement,
} from './_hooks'

// Подкомпоненты (для кастомизации)
export { PlayerControls, PlayerHeader, PlayerLoadingOverlay } from './_components'

export { SubtitleOverlay } from './SubtitleOverlay'
export type { SubtitleOverlayProps } from './SubtitleOverlay'

export { TrackSelector } from './TrackSelector'
export type { TrackInfo, TrackSelectorProps } from './TrackSelector'

export { TrackEditDialog } from './TrackEditDialog'
export type { TrackEditDialogProps } from './TrackEditDialog'

export { ChapterMarkers, detectChapterTypes } from './ChapterMarkers'
export type { Chapter, ChapterMarkersProps } from './ChapterMarkers'

export { ChapterEditor } from './ChapterEditor'
export type { ChapterEditorProps, EpisodeBrief } from './ChapterEditor'

// ChapterType теперь экспортируется из @/generated/prisma

export { ComparePlayer } from './ComparePlayer'

export { ResumeOverlay } from './ResumeOverlay'
export type { ResumeOverlayProps } from './ResumeOverlay'

export { UpNextOverlay } from './UpNextOverlay'
export type { UpNextContent, UpNextOverlayProps } from './UpNextOverlay'

export { CompletionOverlay } from './CompletionOverlay'
export type { CompletionOverlayProps } from './CompletionOverlay'

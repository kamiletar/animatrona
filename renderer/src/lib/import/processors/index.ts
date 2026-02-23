/**
 * Процессоры импорта — модули для декомпозиции import-processor.ts
 *
 * Эти модули можно использовать для постепенного рефакторинга
 * основного ImportProcessor класса.
 */

export { type AudioTrackToTranscode, createAudioTracks } from '../audio-track-creator'
export { createChapters } from '../chapter-creator'
export { createSubtitleTracks } from '../subtitle-track-creator'
export { buildVideoOptions, getProfileName } from '../video-options-builder'

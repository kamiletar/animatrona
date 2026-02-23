/**
 * API клиент для Mobile Server
 */

// Базовый URL — в dev режиме проксируется через Vite, в prod — относительный
const API_BASE = '/api'

/** Статус сервера */
export interface ServerStatus {
  version: string
  libraryPath: string | null
  animeCount: number
  server: {
    isRunning: boolean
    port: number | null
    localIp: string | null
    url: string | null
    requestCount: number
  }
}

/** Аниме в списке */
export interface AnimeListItem {
  id: string
  name: string
  originalName: string | null
  year: number | null
  status: string
  episodeCount: number
  description: string | null
  rating: number | null
  posterPath: string | null
  watchStatus: string
  watchedEpisodes: number
  lastWatchedEpisode: number | null
}

/** Аудиодорожка */
export interface AudioTrack {
  id: string
  language: string
  title: string | null
  dubGroup: string | null
  codec: string
  channels: string
  isDefault: boolean
  /** CID транскодированного аудио в IPFS */
  audioCid: string | null
}

/** Субтитры */
export interface SubtitleTrack {
  id: string
  language: string
  title: string | null
  dubGroup: string | null
  format: string
  isDefault: boolean
  /** CID файла в IPFS */
  fileCid: string | null
  /** CID шрифтов для ASS субтитров */
  fontCids: string[]
}

/** Тип главы */
export type ChapterType = 'CHAPTER' | 'OP' | 'ED' | 'RECAP' | 'PREVIEW'

/** Глава эпизода */
export interface Chapter {
  id: string
  startMs: number
  endMs: number
  title: string | null
  type: ChapterType
  skippable: boolean
}

/** Прогресс просмотра */
export interface WatchProgress {
  currentTime: number
  completed: boolean
  lastWatchedAt: string
}

/** Эпизод */
export interface Episode {
  id: string
  number: number
  name: string | null
  durationMs: number | null
  seasonNumber: number
  seasonName: string | null
  videoPath: string | null
  videoCid: string | null
  progress: WatchProgress | null
  audioTracks: AudioTrack[]
  subtitleTracks: SubtitleTrack[]
  chapters: Chapter[]
}

/** Сезон */
export interface Season {
  number: number
  name: string | null
  type: string
  episodeCount: number
}

/** Детали аниме */
export interface AnimeDetails {
  id: string
  name: string
  originalName: string | null
  year: number | null
  status: string
  episodeCount: number
  description: string | null
  rating: number | null
  posterPath: string | null
  watchStatus: string
  genres: string[]
  seasons: Season[]
  episodes: Episode[]
}

/** Последний просмотренный эпизод */
export interface LastWatched {
  anime: {
    id: string
    name: string
    posterPath: string | null
  }
  episode: {
    id: string
    number: number
    name: string | null
    durationMs: number | null
  }
  progress: WatchProgress
}

/** Получить статус сервера */
export async function getStatus(): Promise<ServerStatus> {
  const response = await fetch(`${API_BASE}/status`)
  if (!response.ok) {
    throw new Error('Failed to fetch status')
  }
  return response.json()
}

/** Получить список аниме */
export async function getLibrary(): Promise<AnimeListItem[]> {
  const response = await fetch(`${API_BASE}/library`)
  if (!response.ok) {
    throw new Error('Failed to fetch library')
  }
  return response.json()
}

/** Получить детали аниме */
export async function getAnimeDetails(animeId: string): Promise<AnimeDetails> {
  const response = await fetch(`${API_BASE}/library/${animeId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch anime details')
  }
  return response.json()
}

/** Получить URL постера */
export function getPosterUrl(animeId: string): string {
  return `${API_BASE}/poster/${animeId}`
}

/** Получить URL видео для стриминга (локальный файл) */
export function getMediaUrl(videoPath: string): string {
  return `${API_BASE}/media?path=${encodeURIComponent(videoPath)}`
}

/** Получить URL видео из IPFS CID */
export function getVideoCidUrl(cid: string): string {
  return `${API_BASE}/ipfs/${cid}`
}

/** Получить URL аудио из CID */
export function getAudioCidUrl(cid: string): string {
  return `${API_BASE}/ipfs/${cid}`
}

/** Получить URL видео эпизода (автоматически выбирает источник) */
export function getEpisodeVideoUrl(episode: { videoCid: string | null; videoPath: string | null }): string | null {
  if (episode.videoCid) {
    return getVideoCidUrl(episode.videoCid)
  }
  if (episode.videoPath) {
    return getMediaUrl(episode.videoPath)
  }
  return null
}

/** Получить URL субтитров (конвертируется в VTT) */
export function getSubtitlesUrl(subtitlePath: string): string {
  return `${API_BASE}/subtitles?path=${encodeURIComponent(subtitlePath)}`
}

/** Получить URL для IPFS контента (субтитры, шрифты) */
export function getIpfsUrl(cid: string): string {
  return `${API_BASE}/ipfs/${cid}`
}

/** Получить URL субтитров из CID */
export function getSubtitleUrlFromCid(track: SubtitleTrack): string | null {
  if (!track.fileCid) return null
  return getIpfsUrl(track.fileCid)
}

/**
 * Получить URL субтитров в VTT формате (конвертируется на сервере)
 * Для использования с нативным <track> элементом
 */
export function getSubtitleVttUrl(track: SubtitleTrack): string | null {
  if (!track.fileCid) return null
  return `${API_BASE}/subtitles/cid/${track.fileCid}?format=${track.format}`
}

/** Получить прогресс эпизода */
export async function getProgress(episodeId: string): Promise<WatchProgress | null> {
  const response = await fetch(`${API_BASE}/progress/${episodeId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch progress')
  }
  return response.json()
}

/** Сохранить прогресс эпизода */
export async function saveProgress(
  episodeId: string,
  data: { currentTime: number; completed?: boolean },
): Promise<WatchProgress> {
  const response = await fetch(`${API_BASE}/progress/${episodeId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error('Failed to save progress')
  }
  return response.json()
}

/** Получить последний просмотренный эпизод */
export async function getLastWatched(): Promise<LastWatched | null> {
  const response = await fetch(`${API_BASE}/last-watched`)
  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    throw new Error('Failed to fetch last watched')
  }
  return response.json()
}

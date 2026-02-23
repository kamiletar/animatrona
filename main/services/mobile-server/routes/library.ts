/**
 * Library API routes для Mobile Server
 *
 * GET /api/library — список аниме
 * GET /api/library/:animeId — детали аниме с эпизодами
 * GET /api/poster/:animeId — постер аниме
 */

import { createReadStream, existsSync, readdirSync, statSync } from 'fs'
import type { IncomingMessage, ServerResponse } from 'http'
import path from 'path'

import { createModuleLogger } from '../../../utils/logger'
import { getDb } from '../../database'
import type { MobileAnime, MobileAudioTrack, MobileChapter, MobileEpisode, MobileSubtitleTrack } from '../types'

const log = createModuleLogger('MobileLibrary')

type RouteAction = 'list' | 'details' | 'poster'

/**
 * Обработчик запросов к библиотеке
 */
export async function handleLibraryRequest(
  _req: IncomingMessage,
  res: ServerResponse,
  action: RouteAction,
  animeId?: string
): Promise<void> {
  const db = getDb()

  try {
    switch (action) {
      case 'list':
        await handleListAnime(res, db)
        break
      case 'details':
        if (!animeId) {
          sendError(res, 400, 'Missing animeId')
          return
        }
        await handleAnimeDetails(res, db, animeId)
        break
      case 'poster':
        if (!animeId) {
          sendError(res, 400, 'Missing animeId')
          return
        }
        await handleAnimePoster(res, db, animeId)
        break
    }
  } catch (error) {
    log.error('Library request error', { action, animeId, error: String(error) })
    sendError(res, 500, 'Internal server error')
  }
}

/**
 * Список аниме с базовой информацией
 */
async function handleListAnime(res: ServerResponse, db: ReturnType<typeof getDb>): Promise<void> {
  const animeList = await db.anime.findMany({
    include: {
      poster: true,
      watchProgress: {
        orderBy: { lastWatchedAt: 'desc' },
        take: 1,
      },
      episodes: {
        select: { id: true },
      },
      _count: {
        select: {
          watchProgress: {
            where: { completed: true },
          },
        },
      },
    },
    orderBy: [{ watchStatus: 'asc' }, { updatedAt: 'desc' }],
  })

  const response: MobileAnime[] = animeList.map((anime) => ({
    id: anime.id,
    name: anime.name,
    originalName: anime.originalName,
    year: anime.year,
    status: anime.status,
    episodeCount: anime.episodeCount,
    description: anime.description,
    rating: anime.rating,
    posterPath: anime.poster?.path ?? null,
    watchStatus: anime.watchStatus,
    watchedEpisodes: anime._count.watchProgress,
    lastWatchedEpisode: anime.watchProgress[0] ? parseInt(anime.watchProgress[0].episodeId, 10) : null,
  }))

  sendJson(res, response)
}

/**
 * Детали аниме с сезонами и эпизодами
 */
async function handleAnimeDetails(res: ServerResponse, db: ReturnType<typeof getDb>, animeId: string): Promise<void> {
  const anime = await db.anime.findUnique({
    where: { id: animeId },
    include: {
      poster: true,
      seasons: {
        orderBy: { number: 'asc' },
      },
      episodes: {
        include: {
          audioTracks: true,
          subtitleTracks: {
            include: { fonts: true },
          },
          chapters: {
            orderBy: { startMs: 'asc' },
          },
          watchProgress: true,
          season: true,
        },
        orderBy: { number: 'asc' },
      },
      genres: {
        include: { genre: true },
      },
    },
  })

  if (!anime) {
    sendError(res, 404, 'Anime not found')
    return
  }

  // Формируем эпизоды с путями к видео
  const settings = await db.settings.findUnique({ where: { id: 'default' } })
  const libraryPath = settings?.libraryPath

  const episodes: MobileEpisode[] = anime.episodes.map((ep) => {
    // Видео: приоритет transcodedCid (IPFS), иначе ищем локальный файл
    let videoPath: string | null = null
    const videoCid: string | null = ep.transcodedCid ?? null

    // Если нет CID, ищем локальный файл
    if (!videoCid && libraryPath && ep.folderPath) {
      const episodePath = ep.folderPath
      if (existsSync(episodePath)) {
        const files = readdirSync(episodePath)
        const videoFile = files.find((f) =>
          ['.mkv', '.mp4', '.webm', '.avi'].some((ext) => f.toLowerCase().endsWith(ext))
        )
        if (videoFile) {
          videoPath = path.join(episodePath, videoFile)
        }
      }
    }

    const audioTracks: MobileAudioTrack[] = ep.audioTracks.map((at) => {
      // Вычисляем отображаемое имя: title || "Язык (dubGroup)" || язык
      const name =
        at.title || (at.dubGroup ? `${at.language.toUpperCase()} (${at.dubGroup})` : null) || at.language.toUpperCase()

      return {
        id: at.id,
        language: at.language,
        title: at.title,
        name,
        dubGroup: at.dubGroup,
        codec: at.codec,
        channels: at.channels,
        isDefault: at.isDefault,
        audioCid: at.transcodedCid ?? null,
      }
    })

    const subtitleTracks: MobileSubtitleTrack[] = ep.subtitleTracks.map((st) => {
      // Вычисляем отображаемое имя: title || "Язык (dubGroup)" || язык
      const name =
        st.title || (st.dubGroup ? `${st.language.toUpperCase()} (${st.dubGroup})` : null) || st.language.toUpperCase()

      return {
        id: st.id,
        language: st.language,
        title: st.title,
        name,
        dubGroup: st.dubGroup,
        format: st.format,
        isDefault: st.isDefault,
        fileCid: st.fileCid,
        fontCids:
          (st as { fonts?: { fileCid: string | null }[] }).fonts
            ?.filter((f) => f.fileCid)
            .map((f) => f.fileCid as string) ?? [],
      }
    })

    const chapters: MobileChapter[] = ep.chapters.map((ch) => ({
      id: ch.id,
      startMs: ch.startMs,
      endMs: ch.endMs,
      title: ch.title,
      type: ch.type,
      skippable: ch.skippable,
    }))

    const progress = ep.watchProgress[0]

    return {
      id: ep.id,
      number: ep.number,
      name: ep.name,
      durationMs: ep.durationMs,
      seasonNumber: ep.season?.number ?? 1,
      seasonName: ep.season?.name ?? null,
      videoPath,
      videoCid,
      progress: progress
        ? {
            currentTime: progress.currentTime,
            completed: progress.completed,
            lastWatchedAt: progress.lastWatchedAt.toISOString(),
          }
        : null,
      audioTracks,
      subtitleTracks,
      chapters,
    }
  })

  const response = {
    id: anime.id,
    name: anime.name,
    originalName: anime.originalName,
    year: anime.year,
    status: anime.status,
    episodeCount: anime.episodeCount,
    description: anime.description,
    rating: anime.rating,
    posterPath: anime.poster?.path ?? null,
    watchStatus: anime.watchStatus,
    genres: anime.genres.map((g) => g.genre.name),
    seasons: anime.seasons.map((s) => ({
      number: s.number,
      name: s.name,
      type: s.type,
      episodeCount: s.episodeCount,
    })),
    episodes,
  }

  sendJson(res, response)
}

/**
 * Стриминг постера аниме
 */
async function handleAnimePoster(res: ServerResponse, db: ReturnType<typeof getDb>, animeId: string): Promise<void> {
  const anime = await db.anime.findUnique({
    where: { id: animeId },
    include: { poster: true },
  })

  if (!anime?.poster?.path) {
    sendError(res, 404, 'Poster not found')
    return
  }

  const posterPath = anime.poster.path
  if (!existsSync(posterPath)) {
    log.warn('Poster file not found', { path: posterPath })
    sendError(res, 404, 'Poster file not found')
    return
  }

  try {
    const stat = statSync(posterPath)
    const mimeType = getMimeType(posterPath)

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=86400', // Кэш на 24 часа
    })

    const stream = createReadStream(posterPath)
    stream.pipe(res)
  } catch (error) {
    log.error('Error streaming poster', { error: String(error) })
    sendError(res, 500, 'Error streaming poster')
  }
}

/** Определить MIME-тип по расширению */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

/** Отправить JSON ответ */
function sendJson(res: ServerResponse, data: unknown): void {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

/** Отправить ошибку */
function sendError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: message }))
}

/**
 * Сервис восстановления библиотеки из метафайлов
 *
 * Алгоритм:
 * 1. Сканирование папки библиотеки
 * 2. Поиск всех anime.meta.json (релизные данные)
 * 3. Сбор данных из episode-N-manifest.json
 * 4. Чтение пользовательских данных из _user/
 * 5. Возврат структурированных данных для создания записей в БД
 *
 * Создание записей в БД происходит в renderer через ZenStack хуки
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import type { AnimeMeta } from '../../../shared/types/backup'
import type { UserAnimeData, UserEpisodeData } from '../../../shared/types/user-data'
import type { EpisodeManifest } from '../../../shared/types/manifest'
import { getAnimeExtended } from '../shikimori'
import { readUserAnimeData } from './user-data-service'
import { getEpisodeRelativePath } from '../../../shared/utils/folder-hash'

/** Информация об аудиодорожке из манифеста */
export interface ManifestAudioTrackData {
  streamIndex: number
  language: string
  title: string
  codec: string
  channels: string
  bitrate?: number
  isDefault: boolean
  /** Путь к m4a файлу (вычисляется из episodeFolder) */
  filePath: string | null
}

/** Информация о субтитрах из манифеста */
export interface ManifestSubtitleTrackData {
  streamIndex: number
  language: string
  title: string
  format: string
  filePath: string
  isDefault: boolean
  fonts: Array<{ name: string; path: string }>
}

/** Информация о главе из манифеста */
export interface ManifestChapterData {
  startMs: number
  endMs: number
  title: string | null
  type: 'chapter' | 'op' | 'ed' | 'recap' | 'preview'
  skippable: boolean
}

/** Данные эпизода для восстановления */
export interface EpisodeRestoreData {
  /** Папка эпизода (Season N/Episode M) */
  folder: string
  /** Номер эпизода */
  number: number
  /** Номер сезона */
  seasonNumber: number
  /** Название эпизода */
  name?: string
  /** Путь к видео */
  videoPath: string | null
  /** Длительность (мс) */
  durationMs: number
  /** Путь к манифесту */
  manifestPath: string
  /** Аудиодорожки */
  audioTracks: ManifestAudioTrackData[]
  /** Субтитры */
  subtitleTracks: ManifestSubtitleTrackData[]
  /** Главы */
  chapters: ManifestChapterData[]
  /** Прогресс просмотра из _user/ (если есть) */
  userProgress: UserEpisodeData | null
}

/** Данные аниме для восстановления */
export interface AnimeRestoreData {
  /** Папка аниме */
  folder: string
  /** Метаданные из anime.meta.json (релизные) */
  meta: AnimeMeta
  /** Путь к постеру (если есть) */
  posterPath: string | null
  /** Эпизоды */
  episodes: EpisodeRestoreData[]
  /** Пользовательские данные из _user/ (если есть) */
  userData: UserAnimeData | null
  /** Данные из Shikimori (если удалось загрузить) */
  shikimoriData?: {
    name: string
    russian: string | null
    description: string | null
    score: number | null
    status: string
    kind: string | null
    episodes: number
    airedOn: { year: number | null; month: number | null; day: number | null } | null
    releasedOn: { year: number | null; month: number | null; day: number | null } | null
    poster: { mainUrl: string; originalUrl: string } | null
    genres: Array<{ id: string; name: string; russian: string }>
    studios: Array<{ id: string; name: string }>
    rating: string | null
    duration: number | null
    /** Альтернативные названия */
    synonyms: string[]
  }
}

/** Результат сканирования библиотеки */
export interface LibraryScanResult {
  success: boolean
  /** Найденные аниме */
  animes: AnimeRestoreData[]
  /** Общая статистика */
  stats: {
    totalAnimes: number
    totalEpisodes: number
    withShikimoriId: number
  }
  /** Ошибки при сканировании (не критичные) */
  warnings: string[]
  error?: string
}

/**
 * Читает anime.meta.json из папки
 */
async function readAnimeMeta(animeFolder: string): Promise<AnimeMeta | null> {
  const metaPath = path.join(animeFolder, 'anime.meta.json')

  if (!fs.existsSync(metaPath)) {
    return null
  }

  try {
    const content = fs.readFileSync(metaPath, 'utf-8')
    return JSON.parse(content) as AnimeMeta
  } catch (err) {
    console.warn('[RestoreLibrary] Failed to read anime.meta.json:', metaPath, err)
    return null
  }
}

/**
 * Читает манифест эпизода
 */
async function readEpisodeManifest(manifestPath: string): Promise<EpisodeManifest | null> {
  if (!fs.existsSync(manifestPath)) {
    return null
  }

  try {
    const content = fs.readFileSync(manifestPath, 'utf-8')
    return JSON.parse(content) as EpisodeManifest
  } catch (err) {
    console.warn('[RestoreLibrary] Failed to read manifest:', manifestPath, err)
    return null
  }
}

/**
 * Находит все манифесты в папке аниме
 */
function findEpisodeManifests(animeFolder: string): string[] {
  const manifests: string[] = []

  const scanDir = (dir: string) => {
    if (!fs.existsSync(dir)) return

    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        scanDir(fullPath)
      } else if (entry.name.match(/^episode-\d+-manifest\.json$/)) {
        manifests.push(fullPath)
      }
    }
  }

  scanDir(animeFolder)
  return manifests
}

/**
 * Извлекает номер сезона из пути
 */
function extractSeasonNumber(episodePath: string): number {
  const seasonMatch = episodePath.match(/Season\s+(\d+)/i)
  return seasonMatch ? parseInt(seasonMatch[1], 10) : 1
}

/**
 * Находит постер в папке аниме
 */
function findPoster(animeFolder: string): string | null {
  const posterNames = ['poster.jpeg', 'poster.jpg', 'poster.png', 'poster.webp', 'cover.jpeg', 'cover.jpg']

  for (const name of posterNames) {
    const posterPath = path.join(animeFolder, name)
    if (fs.existsSync(posterPath)) {
      return posterPath
    }
  }

  return null
}

/**
 * Загружает данные из Shikimori API
 */
async function fetchShikimoriData(shikimoriId: number): Promise<AnimeRestoreData['shikimoriData'] | null> {
  try {
    const result = await getAnimeExtended(shikimoriId)

    if (!result.success || !result.data) {
      return null
    }

    const data = result.data

    return {
      name: data.name,
      russian: data.russian,
      description: data.description,
      score: data.score,
      status: data.status,
      kind: data.kind,
      episodes: data.episodes,
      airedOn: data.airedOn,
      releasedOn: data.releasedOn,
      poster: data.poster,
      genres: data.genres,
      studios: data.studios,
      rating: data.rating,
      duration: data.duration,
      synonyms: data.synonyms ?? [],
    }
  } catch (err) {
    console.warn('[RestoreLibrary] Failed to fetch Shikimori data:', shikimoriId, err)
    return null
  }
}

/**
 * Сканирует папку аниме и собирает данные для восстановления
 */
async function scanAnimeFolder(
  libraryPath: string,
  animeFolder: string,
  loadShikimori: boolean
): Promise<{ data: AnimeRestoreData | null; warnings: string[] }> {
  const warnings: string[] = []

  // 1. Читаем anime.meta.json
  const meta = await readAnimeMeta(animeFolder)

  if (!meta) {
    // Нет метафайла — пропускаем
    return { data: null, warnings: [] }
  }

  // 2. Находим постер
  const posterPath = findPoster(animeFolder)

  // 3. Читаем пользовательские данные из _user/
  const userData = await readUserAnimeData(libraryPath, animeFolder)

  // 4. Находим все манифесты эпизодов
  const manifestPaths = findEpisodeManifests(animeFolder)

  if (manifestPaths.length === 0) {
    warnings.push(`Аниме "${meta.fallbackInfo.name}" не имеет эпизодов`)
  }

  // 5. Собираем данные эпизодов
  const episodes: EpisodeRestoreData[] = []

  for (const manifestPath of manifestPaths) {
    const manifest = await readEpisodeManifest(manifestPath)

    if (!manifest) {
      warnings.push(`Не удалось прочитать манифест: ${manifestPath}`)
      continue
    }

    const episodeFolder = path.dirname(manifestPath)

    // Получаем прогресс из _user/ (если есть)
    let userProgress: UserEpisodeData | null = null
    if (userData) {
      const episodeKey = getEpisodeRelativePath(animeFolder, episodeFolder)
      userProgress = userData.episodes[episodeKey] ?? null
    }

    // Преобразуем аудиодорожки
    const audioTracks: ManifestAudioTrackData[] = manifest.audioTracks.map((track) => ({
      ...track,
      // Вычисляем путь к m4a файлу
      filePath: fs.existsSync(path.join(episodeFolder, `audio_${track.streamIndex}_${track.language}.m4a`))
        ? path.join(episodeFolder, `audio_${track.streamIndex}_${track.language}.m4a`)
        : null,
    }))

    // Преобразуем субтитры (пути уже абсолютные в манифесте)
    const subtitleTracks: ManifestSubtitleTrackData[] = manifest.subtitleTracks.map((track) => ({
      streamIndex: track.streamIndex,
      language: track.language,
      title: track.title,
      format: track.format,
      filePath: track.filePath,
      isDefault: track.isDefault,
      fonts: track.fonts ?? [],
    }))

    // Преобразуем главы
    const chapters: ManifestChapterData[] = manifest.chapters.map((ch) => ({
      startMs: ch.startMs,
      endMs: ch.endMs,
      title: ch.title,
      type: ch.type as ManifestChapterData['type'],
      skippable: ch.skippable,
    }))

    episodes.push({
      folder: episodeFolder,
      number: manifest.info.episodeNumber,
      seasonNumber: extractSeasonNumber(episodeFolder) || manifest.info.seasonNumber,
      name: manifest.info.episodeName,
      videoPath: fs.existsSync(manifest.video.path) ? manifest.video.path : null,
      durationMs: manifest.video.durationMs,
      manifestPath,
      audioTracks,
      subtitleTracks,
      chapters,
      userProgress,
    })
  }

  // Сортируем эпизоды по номеру сезона и эпизода
  episodes.sort((a, b) => a.seasonNumber - b.seasonNumber || a.number - b.number)

  // 6. Загружаем данные из Shikimori (если нужно)
  let shikimoriData: AnimeRestoreData['shikimoriData'] | undefined

  if (loadShikimori && meta.shikimoriId) {
    shikimoriData = (await fetchShikimoriData(meta.shikimoriId)) ?? undefined
  }

  return {
    data: {
      folder: animeFolder,
      meta,
      posterPath,
      episodes,
      userData,
      shikimoriData,
    },
    warnings,
  }
}

/**
 * Сканирует библиотеку и возвращает данные для восстановления
 *
 * @param libraryPath - Путь к корневой папке библиотеки
 * @param loadShikimori - Загружать ли данные из Shikimori API
 */
export async function scanLibraryForRestore(libraryPath: string, loadShikimori = true): Promise<LibraryScanResult> {
  if (!fs.existsSync(libraryPath)) {
    return {
      success: false,
      animes: [],
      stats: { totalAnimes: 0, totalEpisodes: 0, withShikimoriId: 0 },
      warnings: [],
      error: `Папка не существует: ${libraryPath}`,
    }
  }

  const animes: AnimeRestoreData[] = []
  const warnings: string[] = []

  // Сканируем корневые папки (каждая папка — потенциальное аниме)
  const entries = fs.readdirSync(libraryPath, { withFileTypes: true })

  for (const entry of entries) {
    // Пропускаем _user и скрытые папки
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) {
      continue
    }

    const animeFolder = path.join(libraryPath, entry.name)
    const result = await scanAnimeFolder(libraryPath, animeFolder, loadShikimori)

    if (result.data) {
      animes.push(result.data)
    }

    warnings.push(...result.warnings)
  }

  // Собираем статистику
  const stats = {
    totalAnimes: animes.length,
    totalEpisodes: animes.reduce((sum, a) => sum + a.episodes.length, 0),
    withShikimoriId: animes.filter((a) => a.meta.shikimoriId !== null).length,
  }

  return {
    success: true,
    animes,
    stats,
    warnings,
  }
}

/**
 * Быстрое сканирование — только статистика без загрузки Shikimori
 */
export async function quickScanLibrary(
  libraryPath: string
): Promise<{ success: boolean; stats: LibraryScanResult['stats']; error?: string }> {
  const result = await scanLibraryForRestore(libraryPath, false)

  return {
    success: result.success,
    stats: result.stats,
    error: result.error,
  }
}

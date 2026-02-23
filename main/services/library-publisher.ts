/**
 * Library Publisher — Публикация библиотеки в IPFS/IPNS
 *
 * Сервис для генерации PublishedLibrary из БД и публикации через IPNS.
 * Позволяет другим пользователям подписаться на вашу библиотеку.
 *
 * После миграции в IPFS весь контент уже имеет CID — не нужно добавлять файлы.
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import type { PublishedAnime, PublishedEpisode, PublishedLibrary } from '../../shared/types/ipfs'
import { prisma } from '../utils/db'
import { createModuleLogger } from '../utils/logger'
import { getIpnsService } from './ipfs'
import { getKuboService } from './kubo'

const log = createModuleLogger('LibraryPublisher')

const PUBLISHER_CONFIG_FILE = 'publisher-config.json'

/**
 * Конфигурация публикации
 */
export interface PublisherConfig {
  /** Имя библиотеки (отображается подписчикам) */
  libraryName: string
  /** Включена ли публикация */
  enabled: boolean
  /** Последний опубликованный CID */
  lastPublishedCid: string | null
  /** Когда последний раз публиковали */
  lastPublishedAt: string | null
  /** Автопубликация при изменениях */
  autoPublish: boolean
}

const DEFAULT_CONFIG: PublisherConfig = {
  libraryName: 'My Anime Library',
  enabled: false,
  lastPublishedCid: null,
  lastPublishedAt: null,
  autoPublish: false,
}

/**
 * Результат публикации
 */
export interface PublishResult {
  /** CID опубликованной библиотеки */
  cid: string
  /** IPNS имя */
  ipnsName: string
  /** Когда опубликовано */
  publishedAt: string
  /** Количество аниме */
  animeCount: number
  /** Количество эпизодов */
  episodeCount: number
}

/**
 * Получить путь к файлу конфигурации
 */
function getConfigPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, PUBLISHER_CONFIG_FILE)
}

/**
 * Загрузить конфигурацию
 */
export function loadPublisherConfig(): PublisherConfig {
  try {
    const filePath = getConfigPath()
    if (!fs.existsSync(filePath)) {
      return { ...DEFAULT_CONFIG }
    }
    const data = fs.readFileSync(filePath, 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) }
  } catch (error) {
    log.error('Ошибка загрузки конфигурации', { error: error instanceof Error ? error.message : String(error) })
    return { ...DEFAULT_CONFIG }
  }
}

/**
 * Сохранить конфигурацию
 */
export function savePublisherConfig(config: PublisherConfig): void {
  try {
    const filePath = getConfigPath()
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8')
  } catch (error) {
    log.error('Ошибка сохранения конфигурации', { error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

/**
 * Обновить конфигурацию
 */
export function updatePublisherConfig(updates: Partial<PublisherConfig>): PublisherConfig {
  const config = loadPublisherConfig()
  const updated = { ...config, ...updates }
  savePublisherConfig(updated)
  return updated
}

/**
 * Данные аниме из БД для публикации
 */
export interface AnimeData {
  id: string
  name: string
  originalName: string | null
  year: number | null
  /** CID постера (если загружен в IPFS) */
  posterCid: string | null
  /** CID манифеста AnimeManifest в IPFS (полные метаданные) */
  manifestCid: string | null
  episodes: EpisodeData[]
}

/**
 * Данные эпизода из БД для публикации
 */
export interface EpisodeData {
  id: string
  number: number
  name: string | null
  /** CID транскодированного видео */
  transcodedCid: string
  /** Размер в байтах (из transcodedSize в БД) */
  transcodedSize: bigint | null
  durationMs: number | null
}

/**
 * Генерировать PublishedLibrary из данных БД
 *
 * После миграции в IPFS все CID уже есть в БД — не нужны маппинги.
 *
 * @param libraryName Название библиотеки
 * @param peerId PeerId владельца
 * @param animes Список аниме с эпизодами (уже с CID)
 */
export function generatePublishedLibrary(libraryName: string, peerId: string, animes: AnimeData[]): PublishedLibrary {
  const publishedAnimes: PublishedAnime[] = []

  for (const anime of animes) {
    // Эпизоды уже отфильтрованы — все имеют transcodedCid
    const episodes: PublishedEpisode[] = anime.episodes.map((ep) => ({
      number: ep.number,
      name: ep.name || undefined,
      cid: ep.transcodedCid,
      size: ep.transcodedSize ? Number(ep.transcodedSize) : 0,
      duration: ep.durationMs ? Math.floor(ep.durationMs / 1000) : 0,
    }))

    // Пропускаем аниме без эпизодов
    if (episodes.length === 0) continue

    publishedAnimes.push({
      name: anime.name,
      originalName: anime.originalName || undefined,
      year: anime.year || undefined,
      posterCid: anime.posterCid || undefined,
      manifestCid: anime.manifestCid || undefined,
      episodes: episodes.sort((a, b) => a.number - b.number),
    })
  }

  return {
    version: 1,
    peerId,
    name: libraryName,
    updatedAt: new Date().toISOString(),
    animes: publishedAnimes.sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/**
 * Получить аниме из БД для публикации
 *
 * Выбирает эпизоды у которых есть transcodedCid или manifestCid (контент в IPFS).
 */
export async function getAnimesForPublishing(): Promise<AnimeData[]> {
  const animes = await prisma.anime.findMany({
    where: {
      episodes: {
        some: {
          OR: [{ transcodedCid: { not: null } }, { manifestCid: { not: null } }],
        },
      },
    },
    select: {
      id: true,
      name: true,
      originalName: true,
      year: true,
      manifestCid: true, // AnimeManifest CID для полных метаданных
      poster: {
        select: { cid: true },
      },
      episodes: {
        where: {
          OR: [{ transcodedCid: { not: null } }, { manifestCid: { not: null } }],
        },
        select: {
          id: true,
          number: true,
          name: true,
          transcodedCid: true,
          manifestCid: true,
          transcodedSize: true,
          durationMs: true,
        },
        orderBy: { number: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Логируем найденные аниме
  log.info('Найдено аниме для публикации', { count: animes.length })
  for (const anime of animes) {
    log.debug('Аниме для публикации', { name: anime.name, episodes: anime.episodes.length })
  }

  return animes.map((anime) => ({
    id: anime.id,
    name: anime.name,
    originalName: anime.originalName,
    year: anime.year,
    posterCid: anime.poster?.cid || null,
    manifestCid: anime.manifestCid,
    episodes: anime.episodes.map((ep) => ({
      id: ep.id,
      number: ep.number,
      name: ep.name,
      // Используем transcodedCid или manifestCid (для импортированного контента)
      transcodedCid: ep.transcodedCid || ep.manifestCid || '',
      transcodedSize: ep.transcodedSize,
      durationMs: ep.durationMs,
    })),
  }))
}

/**
 * Опубликовать библиотеку в IPFS/IPNS
 *
 * После миграции в IPFS весь контент уже имеет CID — просто генерируем манифест.
 *
 * @param options Опции публикации
 */
export async function publishLibrary(options?: {
  /** Callback прогресса */
  onProgress?: (stage: string, current: number, total: number) => void
}): Promise<PublishResult> {
  const config = loadPublisherConfig()
  const kuboService = getKuboService()
  const ipnsService = getIpnsService()

  if (!kuboService.isRunning()) {
    throw new Error('IPFS нода не запущена')
  }

  const peerId = kuboService.getPeerId()
  if (!peerId) {
    throw new Error('PeerId не доступен')
  }

  const onProgress = options?.onProgress

  // Шаг 1: Получаем аниме с CID из БД
  onProgress?.('loading', 1, 1)
  const animes = await getAnimesForPublishing()

  if (animes.length === 0) {
    throw new Error(
      'Нет аниме для публикации. Импортируйте контент через очередь кодирования.',
    )
  }

  // Шаг 2: Генерируем PublishedLibrary
  onProgress?.('generating', 1, 1)
  const library = generatePublishedLibrary(config.libraryName, peerId, animes)

  // Шаг 3: Добавляем JSON в IPFS
  onProgress?.('publishing', 1, 2)

  const libraryJson = JSON.stringify(library, null, 2)
  const libraryBuffer = Buffer.from(libraryJson, 'utf-8')

  // Добавляем через UnixFS
  const { addBytes } = await import('./ipfs')
  const libraryCid = await addBytes(libraryBuffer)

  // Шаг 4: Публикуем через IPNS
  onProgress?.('publishing', 2, 2)

  const ipnsResult = await ipnsService.publish(libraryCid)

  // Обновляем конфигурацию
  const now = new Date().toISOString()
  updatePublisherConfig({
    lastPublishedCid: libraryCid,
    lastPublishedAt: now,
  })

  const episodeCount = library.animes.reduce((sum, a) => sum + a.episodes.length, 0)
  log.info('Библиотека опубликована', { animeCount: library.animes.length, episodeCount })

  return {
    cid: libraryCid,
    ipnsName: ipnsResult.name,
    publishedAt: now,
    animeCount: library.animes.length,
    episodeCount,
  }
}

/**
 * Результат миграции эпизода в IPFS
 */
export interface MigrationResult {
  /** Общее количество эпизодов для миграции */
  total: number
  /** Успешно мигрировано */
  migrated: number
  /** С ошибками */
  failed: number
  /** Список ошибок */
  errors: Array<{ episodeId: string; animeName: string; episodeNumber: number; error: string }>
}

/**
 * Получить эпизоды, требующие миграции в IPFS
 * (есть folderPath, но нет transcodedCid)
 */
export async function getEpisodesNeedingMigration(): Promise<
  Array<{
    id: string
    number: number
    folderPath: string
    animeName: string
    animeId: string
  }>
> {
  const episodes = await prisma.episode.findMany({
    where: {
      folderPath: { not: null },
      transcodedCid: null,
    },
    select: {
      id: true,
      number: true,
      folderPath: true,
      anime: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ anime: { name: 'asc' } }, { number: 'asc' }],
  })

  return episodes
    .filter((ep): ep is typeof ep & { folderPath: string } => ep.folderPath !== null)
    .map((ep) => ({
      id: ep.id,
      number: ep.number,
      folderPath: ep.folderPath,
      animeName: ep.anime.name,
      animeId: ep.anime.id,
    }))
}

/**
 * Мигрировать существующий контент в IPFS
 *
 * Находит эпизоды с folderPath но без transcodedCid,
 * загружает video.webm в IPFS и обновляет БД.
 */
export async function migrateContentToIpfs(options?: {
  onProgress?: (current: number, total: number, animeName: string, episodeNumber: number) => void
}): Promise<MigrationResult> {
  const { addFile } = await import('./ipfs')
  const path = await import('path')
  const fs = await import('fs/promises')

  const episodes = await getEpisodesNeedingMigration()
  const result: MigrationResult = {
    total: episodes.length,
    migrated: 0,
    failed: 0,
    errors: [],
  }

  if (episodes.length === 0) {
    log.info('Нет эпизодов для миграции')
    return result
  }

  log.info('Начинаю миграцию контента в IPFS', { total: episodes.length })

  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i]
    options?.onProgress?.(i + 1, episodes.length, ep.animeName, ep.number)

    try {
      // Ищем video.webm в папке эпизода
      const videoPath = path.join(ep.folderPath, 'video.webm')

      // Проверяем существование файла
      try {
        await fs.access(videoPath)
      } catch {
        throw new Error(`Файл не найден: ${videoPath}`)
      }

      // Загружаем в IPFS
      log.debug('Загружаю видео в IPFS', { episodeId: ep.id, videoPath })
      const cid = await addFile(videoPath)

      if (!cid) {
        throw new Error('addFile вернул null')
      }

      // Получаем размер файла
      const stat = await fs.stat(videoPath)
      const sizeBytes = stat.size

      // Обновляем БД
      await prisma.episode.update({
        where: { id: ep.id },
        data: {
          transcodedCid: cid,
          transcodedSize: BigInt(sizeBytes),
        },
      })

      result.migrated++
      log.info('Эпизод мигрирован', { episodeId: ep.id, cid, animeName: ep.animeName, number: ep.number })
    } catch (error) {
      result.failed++
      const errorMessage = error instanceof Error ? error.message : String(error)
      result.errors.push({
        episodeId: ep.id,
        animeName: ep.animeName,
        episodeNumber: ep.number,
        error: errorMessage,
      })
      log.error('Ошибка миграции эпизода', { episodeId: ep.id, error: errorMessage })
    }
  }

  log.info('Миграция завершена', { migrated: result.migrated, failed: result.failed, total: result.total })
  return result
}

/**
 * Результат удаления контента аниме из IPFS
 */
export interface DeleteAnimeContentResult {
  /** Количество удалённых CID */
  deletedCids: number
  /** Список CID которые были удалены */
  cids: string[]
  /** CID пропущенные (используются другими аниме) */
  skippedCids: number
}

/**
 * Удалить контент конкретного аниме из IPFS
 *
 * Собирает ВСЕ CID аниме (видео, аудио, субтитры, шрифты, скриншоты, thumbnails, постер).
 * Перед удалением проверяет — не используется ли CID другими аниме (особенно важно для шрифтов).
 * Вызывать ПЕРЕД удалением аниме из БД!
 *
 * @param animeId ID аниме
 */
export async function deleteAnimeContent(animeId: string): Promise<DeleteAnimeContentResult> {
  log.info('Удаление контента аниме из IPFS', { animeId })

  // Получаем ВСЕ CID аниме из БД
  const anime = await prisma.anime.findUnique({
    where: { id: animeId },
    select: {
      name: true,
      poster: {
        select: { cid: true },
      },
      episodes: {
        select: {
          transcodedCid: true,
          manifestCid: true,
          thumbnailCids: true,
          screenshotCids: true,
          audioTracks: {
            select: { transcodedCid: true },
          },
          subtitleTracks: {
            select: {
              fileCid: true,
              fonts: {
                select: { fileCid: true },
              },
            },
          },
        },
      },
    },
  })

  if (!anime) {
    log.warn('Аниме не найдено', { animeId })
    return { deletedCids: 0, cids: [], skippedCids: 0 }
  }

  // Собираем все CID
  const allCids: string[] = []

  // CID постера
  if (anime.poster?.cid) {
    allCids.push(anime.poster.cid)
  }

  // CID эпизодов и связанного контента
  for (const ep of anime.episodes) {
    // Видео
    if (ep.transcodedCid) {
      allCids.push(ep.transcodedCid)
    }
    if (ep.manifestCid) {
      allCids.push(ep.manifestCid)
    }

    // Thumbnails (JSON массив)
    if (ep.thumbnailCids) {
      try {
        const thumbs = JSON.parse(ep.thumbnailCids) as string[]
        allCids.push(...thumbs)
      } catch { /* игнорируем ошибки парсинга */ }
    }

    // Screenshots (JSON массив)
    if (ep.screenshotCids) {
      try {
        const screens = JSON.parse(ep.screenshotCids) as string[]
        allCids.push(...screens)
      } catch { /* игнорируем ошибки парсинга */ }
    }

    // Аудиодорожки
    for (const audio of ep.audioTracks) {
      if (audio.transcodedCid) {
        allCids.push(audio.transcodedCid)
      }
    }

    // Субтитры и шрифты
    for (const sub of ep.subtitleTracks) {
      if (sub.fileCid) {
        allCids.push(sub.fileCid)
      }
      for (const font of sub.fonts) {
        if (font.fileCid) {
          allCids.push(font.fileCid)
        }
      }
    }
  }

  // Убираем дубликаты
  const uniqueCids = [...new Set(allCids)]

  if (uniqueCids.length === 0) {
    log.info('Нет CID для удаления', { animeId, animeName: anime.name })
    return { deletedCids: 0, cids: [], skippedCids: 0 }
  }

  log.info('Собрано CID для проверки', { animeId, animeName: anime.name, count: uniqueCids.length })

  // Проверяем каждый CID — используется ли в других аниме
  const cidsToDelete: string[] = []
  let skippedCids = 0

  for (const cid of uniqueCids) {
    const isUsedElsewhere = await isCidUsedByOtherAnime(cid, animeId)
    if (isUsedElsewhere) {
      log.debug('CID используется другим аниме, пропускаем', { cid })
      skippedCids++
    } else {
      cidsToDelete.push(cid)
    }
  }

  if (cidsToDelete.length === 0) {
    log.info('Все CID используются другими аниме', { animeId, animeName: anime.name, skippedCids })
    return { deletedCids: 0, cids: [], skippedCids }
  }

  log.info('CID для удаления', { count: cidsToDelete.length, skipped: skippedCids })

  // Удаляем из PinManager
  try {
    const { getPinManager } = await import('./ipfs')
    const pinManager = getPinManager()
    for (const cid of cidsToDelete) {
      await pinManager.unpin(cid)
    }
    log.debug('CID откреплены из PinManager', { count: cidsToDelete.length })
  } catch (error) {
    log.warn('Ошибка открепления из PinManager', { error: String(error) })
  }

  // Блоки будут удалены Kubo через garbage collection после unpin
  // (см. выше: pinManager.removePins)

  log.info('Контент аниме удалён из IPFS', {
    animeId,
    animeName: anime.name,
    deletedCids: cidsToDelete.length,
    skippedCids,
  })

  return { deletedCids: cidsToDelete.length, cids: cidsToDelete, skippedCids }
}

/**
 * Проверить, используется ли CID в других аниме (кроме указанного)
 *
 * Проверяет все таблицы с CID: Anime (posterCid), Episode, AudioTrack, SubtitleTrack, SubtitleFont
 */
async function isCidUsedByOtherAnime(cid: string, excludeAnimeId: string): Promise<boolean> {
  // Проверяем Anime (постеры)
  const posterUsage = await prisma.anime.count({
    where: {
      posterCid: cid,
      id: { not: excludeAnimeId },
    },
  })
  if (posterUsage > 0) return true

  // Проверяем Episode (видео, манифест)
  const episodeUsage = await prisma.episode.count({
    where: {
      OR: [
        { transcodedCid: cid },
        { manifestCid: cid },
        { thumbnailCids: { contains: cid } },
        { screenshotCids: { contains: cid } },
      ],
      anime: { id: { not: excludeAnimeId } },
    },
  })
  if (episodeUsage > 0) return true

  // Проверяем AudioTrack
  const audioUsage = await prisma.audioTrack.count({
    where: {
      transcodedCid: cid,
      episode: { anime: { id: { not: excludeAnimeId } } },
    },
  })
  if (audioUsage > 0) return true

  // Проверяем SubtitleTrack
  const subtitleUsage = await prisma.subtitleTrack.count({
    where: {
      fileCid: cid,
      episode: { anime: { id: { not: excludeAnimeId } } },
    },
  })
  if (subtitleUsage > 0) return true

  // Проверяем SubtitleFont (самое важное — шрифты часто переиспользуются)
  const fontUsage = await prisma.subtitleFont.count({
    where: {
      fileCid: cid,
      subtitleTrack: { episode: { anime: { id: { not: excludeAnimeId } } } },
    },
  })
  if (fontUsage > 0) return true

  return false
}

/**
 * Очистить библиотеку — удалить все аниме из БД и контент из IPFS
 *
 * ВНИМАНИЕ: Удаляет ВСЕ данные из БД (аниме, эпизоды, треки, прогресс)
 * и ВСЕ данные из IPFS blockstore. Файлы на диске НЕ удаляются.
 */
export async function clearLibrary(): Promise<{ deletedCount: number; deletedBytes: number }> {
  log.warn('Очистка библиотеки — удаление всех аниме из БД и IPFS')

  // Считаем количество аниме перед удалением
  const count = await prisma.anime.count()

  // Удаляем все аниме (каскадно удалит episodes, tracks, etc.)
  await prisma.anime.deleteMany({})

  // Очищаем IPFS blockstore и PinManager
  const deletedBytes = 0
  try {
    const { getPinManager } = await import('./ipfs')
    const pinManager = getPinManager()
    await pinManager.clear()
    log.info('PinManager очищен')

    // После unpin блоки будут удалены Kubo через garbage collection
    // Для форсированной очистки можно вызвать: kuboService.getClient().repo.gc()
    const kuboService = getKuboService()
    if (kuboService.isRunning()) {
      const client = kuboService.getClient()
      if (client) {
        // Запускаем сборку мусора
        for await (const _result of client.repo.gc()) {
          // GC работает инкрементально
        }
        log.info('Kubo garbage collection завершена')
      }
    }
  } catch (error) {
    log.error('Ошибка очистки IPFS', { error: error instanceof Error ? error.message : String(error) })
    // Продолжаем — БД уже очищена
  }

  log.info('Библиотека очищена', { deletedCount: count, deletedBytes })
  return { deletedCount: count, deletedBytes }
}

/**
 * Получить последнюю опубликованную библиотеку
 */
export async function getPublishedLibrary(): Promise<PublishedLibrary | null> {
  const config = loadPublisherConfig()

  if (!config.lastPublishedCid) {
    return null
  }

  try {
    const { cat } = await import('./ipfs')
    const content = await cat(config.lastPublishedCid)
    return JSON.parse(content.toString('utf-8')) as PublishedLibrary
  } catch (error) {
    log.error('Ошибка получения опубликованной библиотеки', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

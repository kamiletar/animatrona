/**
 * AnimeManifest Generator — Генерация манифестов аниме для IPFS
 *
 * Собирает метаданные из БД и Shikimori API, публикует в IPFS как JSON.
 * CID манифеста сохраняется в поле Anime.manifestCid.
 *
 * Workflow:
 * 1. Загружает базовые данные аниме из БД
 * 2. Если есть shikimoriId — дозапрашивает расширенные данные из Shikimori API
 * 3. Собирает AnimeManifest (БД + Shikimori)
 * 4. Публикует JSON в IPFS
 * 5. Возвращает CID
 */

import type {
  ANIME_MANIFEST_VERSION,
  AnimeManifest,
  AnimeManifestCharacter,
  AnimeManifestEpisode,
  AnimeManifestExternalIds,
  AnimeManifestExternalLink,
  AnimeManifestGenre,
  AnimeManifestPerson,
  AnimeManifestStudio,
  AnimeManifestVideo,
  GenerateAnimeManifestInput,
  GenerateAnimeManifestResult,
} from '../../shared/types/anime-manifest'
import { prisma } from '../utils/db'
import { createModuleLogger } from '../utils/logger'
import { addBytes, cat } from './ipfs/unixfs-service'
import { getKuboService } from './kubo'
import { getAnimeExtended } from './shikimori'
import type { ShikimoriAnimeExtended } from './shikimori/types'

const log = createModuleLogger('AnimeManifestGenerator')

// === Маппинг данных из Shikimori API в формат манифеста ===

/**
 * Конвертирует студии из Shikimori в формат манифеста
 */
function mapStudios(shikimori: ShikimoriAnimeExtended): AnimeManifestStudio[] | undefined {
  if (!shikimori.studios || shikimori.studios.length === 0) return undefined
  return shikimori.studios.map((s) => ({
    name: s.name,
    imageUrl: s.imageUrl ?? undefined,
  }))
}

/**
 * Конвертирует персонал (режиссёры, сценаристы) из Shikimori в формат манифеста
 */
function mapStaff(shikimori: ShikimoriAnimeExtended): AnimeManifestPerson[] | undefined {
  if (!shikimori.personRoles || shikimori.personRoles.length === 0) return undefined
  return shikimori.personRoles.map((pr) => ({
    name: pr.person.name,
    nameRu: pr.person.russian ?? undefined,
    role: pr.rolesRu[0] ?? pr.rolesEn[0] ?? 'Staff',
    imageUrl: pr.person.poster?.mainUrl ?? undefined,
  }))
}

/**
 * Конвертирует персонажей из Shikimori в формат манифеста
 */
function mapCharacters(shikimori: ShikimoriAnimeExtended): AnimeManifestCharacter[] | undefined {
  if (!shikimori.characterRoles || shikimori.characterRoles.length === 0) return undefined
  return shikimori.characterRoles.map((cr) => ({
    name: cr.character.name,
    nameRu: cr.character.russian ?? undefined,
    role: cr.rolesRu[0] ?? cr.rolesEn[0] ?? undefined,
    imageUrl: cr.character.poster?.mainUrl ?? undefined,
    // Примечание: в GraphQL API нет данных о сейю в characterRoles
    // Они есть только в personRoles с ролью "сейю" (seiyuu)
  }))
}

/**
 * Конвертирует внешние ссылки из Shikimori в формат манифеста
 */
function mapExternalLinks(shikimori: ShikimoriAnimeExtended): AnimeManifestExternalLink[] | undefined {
  if (!shikimori.externalLinks || shikimori.externalLinks.length === 0) return undefined
  return shikimori.externalLinks.map((link) => ({
    kind: link.kind,
    url: link.url,
  }))
}

/**
 * Конвертирует видео (трейлеры, OP, ED) из Shikimori в формат манифеста
 */
function mapVideos(shikimori: ShikimoriAnimeExtended): AnimeManifestVideo[] | undefined {
  if (!shikimori.videos || shikimori.videos.length === 0) return undefined
  return shikimori.videos.map((v) => ({
    kind: v.kind ?? 'pv',
    name: v.name ?? undefined,
    url: v.playerUrl ?? v.url,
    imageUrl: v.imageUrl ?? undefined,
  }))
}

/**
 * Извлекает внешние ID из ссылок Shikimori
 */
function extractExternalIds(
  shikimoriId: number | null | undefined,
  externalLinks: ShikimoriAnimeExtended['externalLinks'] | undefined,
): AnimeManifestExternalIds {
  const ids: AnimeManifestExternalIds = {}

  if (shikimoriId) {
    ids.shikimori = shikimoriId
  }

  if (externalLinks) {
    for (const link of externalLinks) {
      // Извлекаем MAL ID из ссылки типа myanimelist
      if (link.kind === 'myanimelist' && link.url) {
        const malMatch = link.url.match(/myanimelist\.net\/anime\/(\d+)/)
        if (malMatch) {
          ids.mal = Number.parseInt(malMatch[1], 10)
        }
      }
      // AniList
      if (link.kind === 'anilist' && link.url) {
        const anilistMatch = link.url.match(/anilist\.co\/anime\/(\d+)/)
        if (anilistMatch) {
          ids.anilist = Number.parseInt(anilistMatch[1], 10)
        }
      }
      // AniDB
      if (link.kind === 'anidb' && link.url) {
        const anidbMatch = link.url.match(/anidb\.net\/(?:anime\/|a)(\d+)/)
        if (anidbMatch) {
          ids.anidb = Number.parseInt(anidbMatch[1], 10)
        }
      }
      // World-Art
      if (link.kind === 'world_art' && link.url) {
        const worldArtMatch = link.url.match(/world-art\.ru\/animation\/animation\.php\?id=(\d+)/)
        if (worldArtMatch) {
          ids.worldArt = Number.parseInt(worldArtMatch[1], 10)
        }
      }
      // Кинопоиск
      if (link.kind === 'kinopoisk' && link.url) {
        const kinopoiskMatch = link.url.match(/kinopoisk\.ru\/(?:film|series)\/(\d+)/)
        if (kinopoiskMatch) {
          ids.kinopoisk = Number.parseInt(kinopoiskMatch[1], 10)
        }
      }
    }
  }

  return ids
}

/**
 * Генерировать AnimeManifest из данных БД и опубликовать в IPFS
 *
 * @param input - Параметры генерации
 * @returns Результат с CID манифеста
 */
export async function generateAnimeManifest(input: GenerateAnimeManifestInput): Promise<GenerateAnimeManifestResult> {
  const { animeId, creatorPeerId } = input

  try {
    log.info('Генерация AnimeManifest', { animeId })

    // Загружаем данные аниме из БД
    // Примечание: модели studios, staff, characters, fandubbers, fansubbers,
    // externalLinks, videos удалены из БД (Фаза 3 минимизации)
    // Эти данные теперь хранятся только в IPFS манифесте
    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      include: {
        poster: true,
        genres: { include: { genre: true } },
        themes: { include: { theme: true } },
        episodes: {
          orderBy: { number: 'asc' },
          include: {
            season: true,
          },
        },
      },
    })

    if (!anime) {
      return { success: false, error: 'Аниме не найдено' }
    }

    // === Запрашиваем расширенные данные из Shikimori API ===
    let shikimoriData: ShikimoriAnimeExtended | null = null
    if (anime.shikimoriId) {
      try {
        log.info('Запрос расширенных данных из Shikimori', { shikimoriId: anime.shikimoriId })
        shikimoriData = await getAnimeExtended(anime.shikimoriId)
        if (shikimoriData) {
          log.info('Получены данные из Shikimori', {
            studios: shikimoriData.studios?.length ?? 0,
            staff: shikimoriData.personRoles?.length ?? 0,
            characters: shikimoriData.characterRoles?.length ?? 0,
            videos: shikimoriData.videos?.length ?? 0,
          })
        }
      } catch (error) {
        log.warn('Не удалось получить данные из Shikimori, продолжаем без них', {
          shikimoriId: anime.shikimoriId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Собираем жанры (из БД, т.к. они используются для фильтрации)
    const genres: AnimeManifestGenre[] = anime.genres.map((g) => ({
      name: g.genre.slug,
      nameRu: g.genre.name,
    }))

    // Собираем темы (из БД)
    const themes: AnimeManifestGenre[] = anime.themes.map((t) => ({
      name: t.theme.name,
      nameRu: t.theme.nameRu ?? undefined,
    }))

    // External IDs — из shikimoriId + извлекаем из ссылок Shikimori
    const externalIds = extractExternalIds(anime.shikimoriId, shikimoriData?.externalLinks)

    // Данные из Shikimori API (студии, стафф, персонажи, видео, ссылки)
    const studios = shikimoriData ? mapStudios(shikimoriData) : undefined
    const staff = shikimoriData ? mapStaff(shikimoriData) : undefined
    const characters = shikimoriData ? mapCharacters(shikimoriData) : undefined
    const videos = shikimoriData ? mapVideos(shikimoriData) : undefined
    const externalLinks = shikimoriData ? mapExternalLinks(shikimoriData) : undefined
    const fandubbers = shikimoriData?.fandubbers?.length ? shikimoriData.fandubbers : undefined
    const fansubbers = shikimoriData?.fansubbers?.length ? shikimoriData.fansubbers : undefined

    // Собираем эпизоды
    const episodes: AnimeManifestEpisode[] = anime.episodes
      .filter((ep) => ep.manifestCid || ep.transcodedCid) // Только эпизоды с контентом
      .map((ep) => ({
        number: ep.number,
        season: ep.season?.number ?? undefined,
        name: ep.name ?? undefined,
        manifestCid: ep.manifestCid ?? '',
        videoCid: ep.transcodedCid ?? undefined,
        size: ep.transcodedSize ? Number(ep.transcodedSize) : 0,
        durationMs: ep.durationMs ?? undefined,
      }))

    // Получаем PeerId создателя
    let manifestCreatorPeerId = creatorPeerId
    if (!manifestCreatorPeerId) {
      const kuboService = getKuboService()
      if (kuboService.isRunning()) {
        manifestCreatorPeerId = kuboService.getPeerId() ?? undefined
      }
    }

    // Собираем манифест
    const now = new Date().toISOString()
    const manifest: AnimeManifest = {
      version: 1 as typeof ANIME_MANIFEST_VERSION,

      // Базовое
      name: anime.name,
      originalName: anime.originalName ?? undefined,
      nameEn: anime.nameEn ?? undefined,
      synonyms: anime.synonyms ? JSON.parse(anime.synonyms) : undefined,
      year: anime.year ?? undefined,

      // Полные данные
      description: anime.description ?? undefined,
      ageRating: anime.ageRating ?? undefined,
      duration: anime.duration ?? undefined,
      episodeCount: anime.episodeCount,
      status: anime.status,
      source: anime.source ?? undefined,
      licensor: anime.licensor ?? undefined,
      rating: anime.rating ?? undefined,

      // Медиа
      posterCid: anime.posterCid ?? anime.poster?.cid ?? undefined,

      // Классификация
      genres: genres.length > 0 ? genres : undefined,
      themes: themes.length > 0 ? themes : undefined,

      // Производство (из Shikimori API)
      studios,
      staff,
      characters,

      // Озвучка (из Shikimori API)
      fandubbers,
      fansubbers,

      // Внешние ID и ссылки
      externalIds,
      externalLinks,

      // Видео материалы (из Shikimori API)
      videos,

      // Эпизоды
      episodes,

      // Метаданные
      isBdRemux: anime.isBdRemux || undefined,
      creatorPeerId: manifestCreatorPeerId,
      createdAt: now,
      updatedAt: now,
    }

    // Публикуем в IPFS
    const manifestJson = JSON.stringify(manifest, null, 2)
    const manifestBuffer = Buffer.from(manifestJson, 'utf-8')
    const manifestCid = await addBytes(manifestBuffer)

    log.info('AnimeManifest опубликован', {
      animeId,
      animeName: anime.name,
      manifestCid,
      episodeCount: episodes.length,
      hasShikimoriData: !!shikimoriData,
      studiosCount: studios?.length ?? 0,
      staffCount: staff?.length ?? 0,
      charactersCount: characters?.length ?? 0,
      videosCount: videos?.length ?? 0,
    })

    return {
      success: true,
      manifestCid,
      manifest,
    }
  } catch (error) {
    log.error('Ошибка генерации AnimeManifest', {
      animeId,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Обновить манифест аниме и сохранить CID в БД
 *
 * @param animeId - ID аниме
 * @returns Результат с новым CID
 */
export async function updateAnimeManifest(animeId: string): Promise<GenerateAnimeManifestResult> {
  const result = await generateAnimeManifest({ animeId })

  if (result.success && result.manifestCid) {
    // Сохраняем CID в БД
    await prisma.anime.update({
      where: { id: animeId },
      data: { manifestCid: result.manifestCid },
    })

    log.info('manifestCid сохранён в БД', { animeId, manifestCid: result.manifestCid })
  }

  return result
}

/**
 * Получить AnimeManifest из IPFS по CID
 *
 * @param manifestCid - CID манифеста
 * @returns AnimeManifest или null
 */
export async function getAnimeManifestFromIpfs(manifestCid: string): Promise<AnimeManifest | null> {
  try {
    const { cat } = await import('./ipfs/unixfs-service')
    const content = await cat(manifestCid)
    return JSON.parse(content.toString('utf-8')) as AnimeManifest
  } catch (error) {
    log.error('Ошибка получения AnimeManifest из IPFS', {
      manifestCid,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Импортировать аниме из IPFS манифеста
 *
 * Создаёт минимальные записи в БД для списка библиотеки.
 * Эпизоды создаются без локальных файлов — для стриминга из IPFS.
 *
 * @param manifestCid - CID манифеста в IPFS
 * @returns Результат импорта
 */
export async function importAnimeFromManifest(
  manifestCid: string,
): Promise<{ success: boolean; animeId?: string; animeName?: string; episodeCount?: number; error?: string }> {
  try {
    log.info('Импорт аниме из манифеста', { manifestCid })

    // 1. Получаем манифест из IPFS
    const manifest = await getAnimeManifestFromIpfs(manifestCid)
    if (!manifest) {
      return { success: false, error: 'Не удалось загрузить манифест из IPFS' }
    }

    // 2. Проверяем нет ли уже такого аниме (по shikimoriId или manifestCid)
    const existingByManifest = await prisma.anime.findFirst({
      where: { manifestCid },
      select: { id: true, name: true },
    })

    if (existingByManifest) {
      return {
        success: false,
        error: `Аниме уже импортировано: ${existingByManifest.name}`,
        animeId: existingByManifest.id,
      }
    }

    if (manifest.externalIds?.shikimori) {
      const existingByShikimori = await prisma.anime.findUnique({
        where: { shikimoriId: manifest.externalIds.shikimori },
        select: { id: true, name: true },
      })

      if (existingByShikimori) {
        // Обновляем manifestCid у существующего
        await prisma.anime.update({
          where: { id: existingByShikimori.id },
          data: { manifestCid },
        })
        log.info('Обновлён manifestCid у существующего аниме', {
          animeId: existingByShikimori.id,
          animeName: existingByShikimori.name,
        })
        return {
          success: true,
          animeId: existingByShikimori.id,
          animeName: existingByShikimori.name,
          episodeCount: manifest.episodes.length,
        }
      }
    }

    // 3. Создаём аниме с минимальными данными
    const anime = await prisma.anime.create({
      data: {
        name: manifest.name,
        originalName: manifest.originalName,
        nameEn: manifest.nameEn,
        synonyms: manifest.synonyms ? JSON.stringify(manifest.synonyms) : null,
        year: manifest.year,
        status: (manifest.status as 'ONGOING' | 'COMPLETED' | 'ANNOUNCED') || 'COMPLETED',
        episodeCount: manifest.episodeCount || manifest.episodes.length,
        description: manifest.description,
        rating: manifest.rating,
        posterCid: manifest.posterCid,
        manifestCid,
        shikimoriId: manifest.externalIds?.shikimori,
        isBdRemux: manifest.isBdRemux,
        source: manifest.source as
          | 'MANGA'
          | 'LIGHT_NOVEL'
          | 'ORIGINAL'
          | 'VISUAL_NOVEL'
          | 'GAME'
          | 'WEB_MANGA'
          | 'OTHER'
          | undefined,
        ageRating: manifest.ageRating as 'G' | 'PG' | 'PG_13' | 'R_17' | 'R_PLUS' | 'RX' | undefined,
        duration: manifest.duration,
        licensor: manifest.licensor,
      },
    })

    log.info('Аниме создано', { animeId: anime.id, animeName: anime.name })

    // Предзагружаем постер в локальный кэш IPFS чтобы он сразу отображался
    if (manifest.posterCid) {
      cat(manifest.posterCid)
        .then(() => log.info('Постер предзагружен', { posterCid: manifest.posterCid }))
        .catch((err: unknown) => log.warn('Не удалось предзагрузить постер', { error: err }))
    }

    // 4. Создаём жанры если есть
    if (manifest.genres && manifest.genres.length > 0) {
      for (const g of manifest.genres) {
        // Upsert жанра
        const genre = await prisma.genre.upsert({
          where: { name: g.name },
          update: { nameRu: g.nameRu ?? undefined },
          create: { name: g.name, nameRu: g.nameRu },
        })
        // Связываем с аниме
        await prisma.genreOnAnime.create({
          data: { animeId: anime.id, genreId: genre.id },
        })
      }
    }

    // 5. Создаём темы если есть
    if (manifest.themes && manifest.themes.length > 0) {
      for (const t of manifest.themes) {
        const theme = await prisma.theme.upsert({
          where: { name: t.name },
          update: { nameRu: t.nameRu ?? undefined },
          create: { name: t.name, nameRu: t.nameRu },
        })
        await prisma.themeOnAnime.create({
          data: { animeId: anime.id, themeId: theme.id },
        })
      }
    }

    // 6. Создаём эпизоды (для стриминга из IPFS)
    if (manifest.episodes.length > 0) {
      await prisma.episode.createMany({
        data: manifest.episodes.map((ep) => ({
          animeId: anime.id,
          number: ep.number,
          name: ep.name,
          manifestCid: ep.manifestCid,
          transcodedCid: ep.videoCid,
          transcodedSize: ep.size ? BigInt(ep.size) : null,
          durationMs: ep.durationMs,
          // Не устанавливаем filePath — эпизоды будут стримиться из IPFS
        })),
      })
      log.info('Эпизоды созданы', { count: manifest.episodes.length })
    }

    log.info('Импорт завершён', {
      animeId: anime.id,
      animeName: anime.name,
      episodeCount: manifest.episodes.length,
    })

    return {
      success: true,
      animeId: anime.id,
      animeName: anime.name,
      episodeCount: manifest.episodes.length,
    }
  } catch (error) {
    log.error('Ошибка импорта из манифеста', {
      manifestCid,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

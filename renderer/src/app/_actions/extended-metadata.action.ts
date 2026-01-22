'use server'

/**
 * Server Actions для сохранения расширенных метаданных аниме из Shikimori
 * v0.5.1 — студии, персонал, персонажи, озвучка, внешние ссылки
 * v0.5.3 — видео (трейлеры, опенинги, эндинги)
 */

import type { ExternalLinkKind, PersonRole, VideoKind } from '@/generated/prisma'
import { prisma } from '@/lib/db'

// === Типы для входных данных ===

interface ShikimoriStudioInput {
  id: string
  name: string
  imageUrl: string | null
}

interface ShikimoriPersonInput {
  id: string
  name: string
  russian: string | null
  poster: { mainUrl: string } | null
}

interface ShikimoriPersonRoleInput {
  id: string
  rolesRu: string[]
  rolesEn: string[]
  person: ShikimoriPersonInput
}

interface ShikimoriCharacterInput {
  id: string
  name: string
  russian: string | null
  poster: { mainUrl: string } | null
}

interface ShikimoriCharacterRoleInput {
  id: string
  rolesRu: string[]
  rolesEn: string[]
  character: ShikimoriCharacterInput
}

interface ShikimoriExternalLinkInput {
  id: string
  kind: string
  url: string
}

/** Видео из Shikimori (v0.5.3) */
interface ShikimoriVideoInput {
  id: string
  url: string
  name: string | null
  kind: string | null
  playerUrl: string | null
  imageUrl: string | null
}

/** Жанр или тема из Shikimori */
interface ShikimoriGenreInput {
  id: string
  name: string
  russian: string
  kind: 'genre' | 'theme'
}

export interface ExtendedMetadataInput {
  studios: ShikimoriStudioInput[]
  personRoles: ShikimoriPersonRoleInput[]
  characterRoles: ShikimoriCharacterRoleInput[]
  fandubbers: string[]
  fansubbers: string[]
  externalLinks: ShikimoriExternalLinkInput[]
  videos: ShikimoriVideoInput[]
  nextEpisodeAt: string | null
  /** Жанры и темы из Shikimori (genres с kind) */
  genres?: ShikimoriGenreInput[]
}

// === Маппинг ролей ===

/** Маппинг английских ролей в наш enum PersonRole */
const ROLE_MAPPING: Record<string, PersonRole> = {
  Director: 'DIRECTOR',
  'Original Creator': 'ORIGINAL_CREATOR',
  Original_Creator: 'ORIGINAL_CREATOR',
  'Character Design': 'CHARACTER_DESIGN',
  Character_Design: 'CHARACTER_DESIGN',
  Music: 'MUSIC',
  Producer: 'PRODUCER',
  'Animation Director': 'ANIMATION_DIRECTOR',
  Animation_Director: 'ANIMATION_DIRECTOR',
  'Key Animator': 'KEY_ANIMATOR',
  Key_Animator: 'KEY_ANIMATOR',
  'Art Director': 'ART_DIRECTOR',
  Art_Director: 'ART_DIRECTOR',
  'Sound Director': 'SOUND_DIRECTOR',
  Sound_Director: 'SOUND_DIRECTOR',
  Series_Composition: 'WRITER',
  'Series Composition': 'WRITER',
  Screenplay: 'WRITER',
  Script: 'WRITER',
}

/** Маппинг типов внешних ссылок (v0.6.35: +WorldArt, Kinopoisk, ANN) */
const EXTERNAL_LINK_MAPPING: Record<string, ExternalLinkKind> = {
  myanimelist: 'MYANIMELIST',
  anidb: 'ANIDB',
  anilist: 'ANILIST',
  wikipedia: 'WIKIPEDIA',
  official_site: 'OFFICIAL_SITE',
  twitter: 'TWITTER',
  world_art: 'WORLDART',
  kinopoisk: 'KINOPOISK',
  anime_news_network: 'ANIME_NEWS_NETWORK',
}

/** Маппинг типов видео (v0.5.3) */
const VIDEO_KIND_MAPPING: Record<string, VideoKind> = {
  op: 'OP',
  ed: 'ED',
  pv: 'PV',
  cm: 'CM',
  clip: 'CLIP',
  episode_preview: 'EPISODE_PREVIEW',
  other: 'OTHER',
}

/**
 * Определить PersonRole по английской роли
 */
function mapRole(roleEn: string): PersonRole | null {
  // Нормализуем роль
  const normalizedRole = roleEn.replace(/\s+/g, '_')
  return ROLE_MAPPING[roleEn] || ROLE_MAPPING[normalizedRole] || null
}

/**
 * Определить ExternalLinkKind по типу из Shikimori
 */
function mapExternalLinkKind(kind: string): ExternalLinkKind {
  const normalizedKind = kind.toLowerCase()
  return EXTERNAL_LINK_MAPPING[normalizedKind] || 'OTHER'
}

/**
 * Определить VideoKind по типу из Shikimori (v0.5.3)
 */
function mapVideoKind(kind: string | null): VideoKind {
  if (!kind) {
    return 'OTHER'
  }
  const normalizedKind = kind.toLowerCase()
  return VIDEO_KIND_MAPPING[normalizedKind] || 'OTHER'
}

/**
 * Извлечь хостинг из URL видео
 */
function extractHosting(url: string): string {
  try {
    const urlObj = new URL(url)
    const host = urlObj.hostname.replace('www.', '')
    if (host.includes('youtube') || host.includes('youtu.be')) {
      return 'youtube'
    }
    if (host.includes('vk.com')) {
      return 'vk'
    }
    if (host.includes('rutube')) {
      return 'rutube'
    }
    return host
  } catch {
    return 'unknown'
  }
}

// === Server Actions ===

/**
 * Сохранить расширенные метаданные аниме из Shikimori в БД
 */
export async function saveExtendedMetadata(
  animeId: string,
  data: ExtendedMetadataInput
): Promise<{ success: boolean; error?: string }> {
  try {
    // Обновляем nextEpisodeAt в аниме
    if (data.nextEpisodeAt) {
      await prisma.anime.update({
        where: { id: animeId },
        data: { nextEpisodeAt: new Date(data.nextEpisodeAt) },
      })
    }

    // 1. Сохраняем студии
    await saveStudios(animeId, data.studios)

    // 2. Сохраняем персонал (режиссёры, сценаристы и т.д.)
    await saveStaff(animeId, data.personRoles)

    // 3. Сохраняем персонажей
    await saveCharacters(animeId, data.characterRoles)

    // 4. Сохраняем команды озвучки
    await saveFandubbers(animeId, data.fandubbers)

    // 5. Сохраняем команды субтитров
    await saveFansubbers(animeId, data.fansubbers)

    // 6. Сохраняем внешние ссылки
    await saveExternalLinks(animeId, data.externalLinks)

    // 7. Сохраняем видео (v0.5.3)
    await saveVideos(animeId, data.videos)

    // 8. Сохраняем жанры и темы (v0.14.0)
    if (data.genres) {
      await saveGenresAndThemes(animeId, data.genres)
    }

    return { success: true }
  } catch (error) {
    console.error('[saveExtendedMetadata] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Сохранить студии
 */
async function saveStudios(animeId: string, studios: ShikimoriStudioInput[]): Promise<void> {
  // Удаляем старые связи
  await prisma.studioOnAnime.deleteMany({ where: { animeId } })

  for (const studioData of studios) {
    const shikimoriId = parseInt(studioData.id, 10)

    // Upsert студии
    const studio = await prisma.studio.upsert({
      where: { shikimoriId },
      create: {
        name: studioData.name,
        shikimoriId,
        imageUrl: studioData.imageUrl,
      },
      update: {
        name: studioData.name,
        imageUrl: studioData.imageUrl,
      },
    })

    // Создаём связь
    await prisma.studioOnAnime.create({
      data: {
        animeId,
        studioId: studio.id,
      },
    })
  }
}

/**
 * Сохранить персонал (режиссёры, сценаристы и т.д.)
 */
async function saveStaff(animeId: string, personRoles: ShikimoriPersonRoleInput[]): Promise<void> {
  // Удаляем старые связи
  await prisma.personOnAnime.deleteMany({ where: { animeId } })

  for (const roleData of personRoles) {
    // Берём только первую роль для простоты (или можно создать несколько связей)
    const roleEn = roleData.rolesEn[0]
    if (!roleEn) {
      continue
    }

    const mappedRole = mapRole(roleEn)
    if (!mappedRole) {
      continue
    } // Пропускаем неизвестные роли

    const shikimoriId = parseInt(roleData.person.id, 10)

    // Upsert персоны
    const person = await prisma.person.upsert({
      where: { shikimoriId },
      create: {
        name: roleData.person.name,
        nameRu: roleData.person.russian,
        shikimoriId,
        imageUrl: roleData.person.poster?.mainUrl || null,
      },
      update: {
        name: roleData.person.name,
        nameRu: roleData.person.russian,
        imageUrl: roleData.person.poster?.mainUrl || null,
      },
    })

    // Создаём связь (ignore duplicate)
    try {
      await prisma.personOnAnime.create({
        data: {
          animeId,
          personId: person.id,
          role: mappedRole,
          roleText: roleData.rolesRu[0] || roleEn,
        },
      })
    } catch (_e) {
      // Игнорируем дубликаты (unique constraint)
    }
  }
}

/**
 * Сохранить персонажей
 */
async function saveCharacters(animeId: string, characterRoles: ShikimoriCharacterRoleInput[]): Promise<void> {
  // Удаляем старые связи
  await prisma.characterOnAnime.deleteMany({ where: { animeId } })

  for (const roleData of characterRoles) {
    const shikimoriId = parseInt(roleData.character.id, 10)

    // Upsert персонажа
    const character = await prisma.character.upsert({
      where: { shikimoriId },
      create: {
        name: roleData.character.name,
        nameRu: roleData.character.russian,
        shikimoriId,
        imageUrl: roleData.character.poster?.mainUrl || null,
      },
      update: {
        name: roleData.character.name,
        nameRu: roleData.character.russian,
        imageUrl: roleData.character.poster?.mainUrl || null,
      },
    })

    // Создаём связь
    try {
      await prisma.characterOnAnime.create({
        data: {
          animeId,
          characterId: character.id,
          roleText: roleData.rolesRu[0] || roleData.rolesEn[0] || null,
        },
      })
    } catch (_e) {
      // Игнорируем дубликаты
    }
  }
}

/**
 * Сохранить команды озвучки
 */
async function saveFandubbers(animeId: string, fandubbers: string[]): Promise<void> {
  // Удаляем старые связи
  await prisma.fandubberOnAnime.deleteMany({ where: { animeId } })

  for (const name of fandubbers) {
    // Upsert команды
    const fandubber = await prisma.fandubber.upsert({
      where: { name },
      create: { name },
      update: {},
    })

    // Создаём связь
    await prisma.fandubberOnAnime.create({
      data: {
        animeId,
        fandubberId: fandubber.id,
      },
    })
  }
}

/**
 * Сохранить команды субтитров
 */
async function saveFansubbers(animeId: string, fansubbers: string[]): Promise<void> {
  // Удаляем старые связи
  await prisma.fansubberOnAnime.deleteMany({ where: { animeId } })

  for (const name of fansubbers) {
    // Upsert команды
    const fansubber = await prisma.fansubber.upsert({
      where: { name },
      create: { name },
      update: {},
    })

    // Создаём связь
    await prisma.fansubberOnAnime.create({
      data: {
        animeId,
        fansubberId: fansubber.id,
      },
    })
  }
}

/**
 * Сохранить внешние ссылки
 */
async function saveExternalLinks(animeId: string, links: ShikimoriExternalLinkInput[]): Promise<void> {
  // Удаляем старые ссылки
  await prisma.externalLink.deleteMany({ where: { animeId } })

  for (const link of links) {
    const kind = mapExternalLinkKind(link.kind)
    const shikimoriId = parseInt(link.id, 10)

    try {
      await prisma.externalLink.create({
        data: {
          animeId,
          kind,
          url: link.url,
          shikimoriId,
        },
      })
    } catch (_e) {
      // Игнорируем дубликаты (unique constraint по animeId + kind)
    }
  }
}

/**
 * Сохранить видео (трейлеры, опенинги, эндинги) — v0.5.3
 */
async function saveVideos(animeId: string, videos: ShikimoriVideoInput[]): Promise<void> {
  // Удаляем старые видео
  await prisma.video.deleteMany({ where: { animeId } })

  for (const video of videos) {
    const shikimoriId = parseInt(video.id, 10)
    const kind = mapVideoKind(video.kind)
    const hosting = extractHosting(video.url)

    try {
      await prisma.video.create({
        data: {
          animeId,
          shikimoriId,
          name: video.name,
          kind,
          url: video.url,
          playerUrl: video.playerUrl,
          imageUrl: video.imageUrl,
          hosting,
        },
      })
    } catch (_e) {
      // Игнорируем дубликаты (unique constraint по shikimoriId)
      console.warn('[saveVideos] Skipping duplicate video:', video.id)
    }
  }
}

/**
 * Сохранить жанры и темы (v0.14.0)
 * Shikimori возвращает genres с kind: 'genre' или 'theme'
 */
/**
 * Генерирует slug из названия
 * "Экшен" → "ekshen", "Action" → "action"
 */
function generateSlug(name: string): string {
  // Транслитерация кириллицы
  const translitMap: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
    з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  }

  return name
    .toLowerCase()
    .split('')
    .map((char) => translitMap[char] || char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function saveGenresAndThemes(animeId: string, genres: ShikimoriGenreInput[]): Promise<void> {
  // Удаляем старые связи
  await prisma.genreOnAnime.deleteMany({ where: { animeId } })
  await prisma.themeOnAnime.deleteMany({ where: { animeId } })

  for (const genreData of genres) {
    const shikimoriId = parseInt(genreData.id, 10)
    const name = genreData.russian || genreData.name

    if (genreData.kind === 'theme') {
      // Сохраняем как тему
      const theme = await prisma.theme.upsert({
        where: { shikimoriId },
        create: {
          name,
          nameRu: genreData.russian || null,
          shikimoriId,
        },
        update: {
          name,
          nameRu: genreData.russian || null,
        },
      })

      try {
        await prisma.themeOnAnime.create({
          data: {
            animeId,
            themeId: theme.id,
          },
        })
      } catch (_e) {
        // Игнорируем дубликаты
      }
    } else {
      // Сохраняем как жанр
      const slug = generateSlug(name)
      const genre = await prisma.genre.upsert({
        where: { shikimoriId },
        create: {
          name,
          slug,
          shikimoriId,
        },
        update: {
          name,
        },
      })

      try {
        await prisma.genreOnAnime.create({
          data: {
            animeId,
            genreId: genre.id,
          },
        })
      } catch (_e) {
        // Игнорируем дубликаты
      }
    }
  }
}

// === Получение данных для фильтров ===

/**
 * Получить все студии для фильтра
 */
export async function getAllStudios(): Promise<{ id: string; name: string }[]> {
  return prisma.studio.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

/**
 * Получить всех режиссёров для фильтра
 */
export async function getAllDirectors(): Promise<{ id: string; name: string; nameRu: string | null }[]> {
  const directors = await prisma.person.findMany({
    where: {
      animeRoles: {
        some: {
          role: 'DIRECTOR',
        },
      },
    },
    select: { id: true, name: true, nameRu: true },
    orderBy: { name: 'asc' },
  })
  return directors
}

/**
 * Получить всех сейю для фильтра
 */
export async function getAllVoiceActors(): Promise<{ id: string; name: string; nameRu: string | null }[]> {
  const voiceActors = await prisma.person.findMany({
    where: {
      voicedCharacters: {
        some: {},
      },
    },
    select: { id: true, name: true, nameRu: true },
    orderBy: { name: 'asc' },
  })
  return voiceActors
}

/**
 * Получить все команды озвучки для фильтра
 */
export async function getAllFandubbers(): Promise<{ id: string; name: string }[]> {
  return prisma.fandubber.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

/**
 * Получить все команды субтитров для фильтра
 */
export async function getAllFansubbers(): Promise<{ id: string; name: string }[]> {
  return prisma.fansubber.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

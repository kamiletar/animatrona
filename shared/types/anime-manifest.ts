/**
 * AnimeManifest — Типы для IPFS манифестов аниме
 *
 * AnimeManifest содержит ПОЛНЫЕ метаданные аниме и публикуется в IPFS.
 * В БД хранится только минимум для списка и фильтров + manifestCid.
 *
 * Workflow:
 * 1. При импорте аниме → генерируется AnimeManifest → IPFS → manifestCid в БД
 * 2. При просмотре списка → данные из БД (быстро)
 * 3. При открытии детальной страницы → cat(manifestCid) → AnimeManifest
 */

/** Версия формата AnimeManifest */
export const ANIME_MANIFEST_VERSION = 1

/** Ссылка на эпизод в AnimeManifest */
export interface AnimeManifestEpisode {
  /** Номер эпизода */
  number: number
  /** Номер сезона (опционально) */
  season?: number
  /** Название эпизода */
  name?: string
  /** CID манифеста эпизода (EpisodeManifest) */
  manifestCid: string
  /** CID транскодированного видео (для быстрого доступа) */
  videoCid?: string
  /** Размер файла в байтах */
  size: number
  /** Длительность в мс */
  durationMs?: number
}

/** Студия анимации */
export interface AnimeManifestStudio {
  /** Название студии */
  name: string
  /** URL логотипа */
  imageUrl?: string
}

/** Персона (режиссёр, сценарист и т.д.) */
export interface AnimeManifestPerson {
  /** Имя (английское) */
  name: string
  /** Имя на русском */
  nameRu?: string
  /** Роль (Director, Writer, etc.) */
  role: string
  /** URL изображения */
  imageUrl?: string
}

/** Персонаж */
export interface AnimeManifestCharacter {
  /** Имя (английское) */
  name: string
  /** Имя на русском */
  nameRu?: string
  /** Роль в сюжете (Main, Supporting) */
  role?: string
  /** URL изображения */
  imageUrl?: string
  /** Сейю (актёр озвучки) */
  voiceActor?: {
    name: string
    nameRu?: string
  }
}

/** Жанр/Тема */
export interface AnimeManifestGenre {
  /** Название (английское) */
  name: string
  /** Название на русском */
  nameRu?: string
}

/** Внешние ID для кросс-сервисного поиска */
export interface AnimeManifestExternalIds {
  /** MyAnimeList ID */
  mal?: number
  /** AniList ID */
  anilist?: number
  /** Shikimori ID */
  shikimori?: number
  /** AniDB ID */
  anidb?: number
  /** World-Art ID */
  worldArt?: number
  /** Кинопоиск ID */
  kinopoisk?: number
}

/** Внешняя ссылка */
export interface AnimeManifestExternalLink {
  /** Тип ссылки (MYANIMELIST, ANIDB, OFFICIAL_SITE, etc.) */
  kind: string
  /** URL */
  url: string
}

/** Видео материал (трейлер, опенинг, эндинг) */
export interface AnimeManifestVideo {
  /** Тип видео (OP, ED, PV, CM, etc.) */
  kind: string
  /** Название */
  name?: string
  /** URL видео (YouTube, etc.) */
  url: string
  /** URL превью */
  imageUrl?: string
}

/**
 * AnimeManifest — Полные метаданные аниме для IPFS
 *
 * Публикуется в IPFS как JSON. CID хранится в БД как manifestCid.
 */
export interface AnimeManifest {
  /** Версия формата */
  version: typeof ANIME_MANIFEST_VERSION

  // === Базовое (дублируется в БД для поиска) ===

  /** Русское название (приоритет) */
  name: string
  /** Оригинальное название (японское) */
  originalName?: string
  /** Английское название */
  nameEn?: string
  /** Альтернативные названия */
  synonyms?: string[]
  /** Год выпуска */
  year?: number

  // === Полные данные (ТОЛЬКО в IPFS) ===

  /** Описание */
  description?: string
  /** Возрастной рейтинг (G, PG, PG-13, R-17, R+, Rx) */
  ageRating?: string
  /** Длительность эпизода в минутах */
  duration?: number
  /** Количество эпизодов */
  episodeCount?: number
  /** Статус (ONGOING, COMPLETED, ANNOUNCED) */
  status?: string
  /** Тип (TV, MOVIE, OVA, ONA, SPECIAL) */
  kind?: string
  /** Первоисточник (MANGA, LIGHT_NOVEL, ORIGINAL, etc.) */
  source?: string
  /** Лицензиат в РФ */
  licensor?: string
  /** Рейтинг на Shikimori (0-10) */
  rating?: number

  // === Медиа ===

  /** CID постера в IPFS */
  posterCid?: string

  // === Классификация ===

  /** Жанры */
  genres?: AnimeManifestGenre[]
  /** Темы */
  themes?: AnimeManifestGenre[]

  // === Производство (ТОЛЬКО в IPFS) ===

  /** Студии анимации */
  studios?: AnimeManifestStudio[]
  /** Персонал (режиссёры, сценаристы и т.д.) */
  staff?: AnimeManifestPerson[]
  /** Персонажи */
  characters?: AnimeManifestCharacter[]

  // === Озвучка (ТОЛЬКО в IPFS) ===

  /** Команды озвучки (fandub) */
  fandubbers?: string[]
  /** Команды субтитров (fansub) */
  fansubbers?: string[]

  // === Внешние ссылки (ТОЛЬКО в IPFS) ===

  /** Внешние ID для кросс-сервисного поиска */
  externalIds: AnimeManifestExternalIds
  /** Внешние ссылки (MAL, AniDB, официальный сайт и т.д.) */
  externalLinks?: AnimeManifestExternalLink[]

  // === Видео материалы (ТОЛЬКО в IPFS) ===

  /** Трейлеры, опенинги, эндинги */
  videos?: AnimeManifestVideo[]

  // === Эпизоды ===

  /** Список эпизодов с CID манифестов */
  episodes: AnimeManifestEpisode[]

  // === Метаданные ===

  /** BDRemux / Bluray Remux (lossless качество) */
  isBdRemux?: boolean
  /** PeerId создателя манифеста */
  creatorPeerId?: string
  /** Дата создания (ISO string) */
  createdAt: string
  /** Дата обновления (ISO string) */
  updatedAt: string
}

/**
 * Данные для генерации AnimeManifest
 *
 * Собирается из БД и метаданных Shikimori.
 */
export interface GenerateAnimeManifestInput {
  /** ID аниме в БД */
  animeId: string
  /** Создавать манифесты эпизодов если их нет */
  createEpisodeManifests?: boolean
  /** PeerId создателя (из Helia) */
  creatorPeerId?: string
}

/**
 * Результат генерации AnimeManifest
 */
export interface GenerateAnimeManifestResult {
  success: boolean
  /** CID манифеста в IPFS */
  manifestCid?: string
  /** Сгенерированный манифест */
  manifest?: AnimeManifest
  /** Сообщение об ошибке */
  error?: string
}

/**
 * Результат импорта аниме по CID манифеста
 */
export interface ImportAnimeFromManifestResult {
  success: boolean
  /** ID созданного аниме в БД */
  animeId?: string
  /** Название импортированного аниме */
  animeName?: string
  /** Количество эпизодов */
  episodeCount?: number
  /** Сообщение об ошибке */
  error?: string
}

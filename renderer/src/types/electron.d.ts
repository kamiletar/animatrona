/**
 * Типы для Electron API, доступного через preload script
 * Должны совпадать с API в main/preload.ts
 */

import type {
  AudioTranscodeOptions,
  AudioTranscodeResult,
  AudioTranscodeVBROptions,
  DemuxOptions,
  DemuxResult,
  EncodingProfileOptions,
  FileFilter,
  MediaInfo,
  MergeConfig,
  OperationResult,
  PerFileTranscodeSettings,
  QueueItem,
  QueueItemStatus,
  SampleResult,
  TranscodeProgress,
  TranscodeProgressExtended,
  VideoTranscodeOptions,
} from '../../../shared/types'
import type { SelectedTrack, TrackPreferences, WatchStatusMeta } from '../../../shared/types/backup'
import type { ExportResult, NamingPattern, SeasonType, SeriesExportProgress } from '../../../shared/types/export'
import type {
  ImportHistoryCreateData,
  ImportHistoryEntry,
  ImportHistoryFilter,
  ImportHistoryStats,
} from '../../../shared/types/import-history'
import type {
  ImportQueueAddData,
  ImportQueueDetailProgress,
  ImportQueueEntry,
  ImportQueueState,
  ImportQueueStatus,
  ImportQueueVmafProgress,
  ImportQueueVmafResult,
} from '../../../shared/types/import-queue'
import type {
  ImportTemplate,
  ImportTemplateCreateData,
  ImportTemplateUpdateData,
} from '../../../shared/types/import-template'
import type { AggregatedProgress, BatchImportItem, ImportQueueItem } from '../../../shared/types/parallel-transcode'
import type { UserAnimeData, UserEpisodeData } from '../../../shared/types/user-data'
import type {
  CqSearchOptions,
  CqSearchProgress,
  CqSearchResult,
  VmafOptions,
  VmafResult,
} from '../../../shared/types/vmaf'

export type { NamingPattern, SeasonType }

/** Информация о медиафайле */
export interface MediaFileInfo {
  path: string
  name: string
  size: number
  extension: string
}

/** Результат матчинга внешнего субтитра */
export interface ExternalSubtitleMatch {
  /** Путь к файлу субтитров */
  filePath: string
  /** Код языка (ru, en, ja, und) */
  language: string
  /** Название дорожки */
  title: string
  /** Формат (ass, srt, vtt, ssa) */
  format: 'ass' | 'srt' | 'vtt' | 'ssa'
  /** Номер эпизода (null если не удалось определить) */
  episodeNumber: number | null
  /** Имена шрифтов из ASS файла */
  fontNames: string[]
  /** Найденные файлы шрифтов */
  matchedFonts: Array<{
    name: string
    path: string
  }>
}

/** Результат сканирования внешних субтитров */
export interface ExternalSubtitleScanResult {
  /** Найденные папки субтитров */
  subsDirs: string[]
  /** Найденные папки шрифтов */
  fontsDirs: string[]
  /** Сматченные субтитры */
  subtitles: ExternalSubtitleMatch[]
  /** Несматченные файлы (для warning в UI) */
  unmatchedFiles: string[]
}

/** Результат матчинга внешнего аудио */
export interface ExternalAudioMatch {
  /** Путь к файлу аудио */
  filePath: string
  /** Номер эпизода (null если не удалось определить) */
  episodeNumber: number | null
  /** Код языка (ru, en, ja, und) */
  language: string
  /** Название дорожки */
  title: string
  /** Название папки-группы (озвучки) */
  groupName: string
  /** Кодек (aac, opus, flac и т.д.) */
  codec: string
  /** Количество каналов (2, 6, 8) */
  channels: number
  /** Битрейт в bps */
  bitrate: number
}

/** Результат сканирования внешних аудио */
export interface ExternalAudioScanResult {
  /** Найденные папки аудио */
  audioDirs: string[]
  /** Сматченные аудиофайлы */
  audioTracks: ExternalAudioMatch[]
  /** Несматченные файлы (для warning в UI) */
  unmatchedFiles: string[]
}

/** Данные эпизода для экспорта */
export interface EpisodeExportData {
  /** ID эпизода */
  id: string
  /** Номер эпизода */
  number: number
  /** Номер сезона */
  seasonNumber: number
  /** Название эпизода */
  name?: string | null
  /** Путь к транскодированному видео (или source) */
  videoPath: string
  /** Аудиодорожки */
  audioTracks: Array<{
    language: string
    title: string | null
    transcodedPath: string | null
    streamIndex: number
    inputPath: string
  }>
  /** Субтитры */
  subtitleTracks: Array<{
    language: string
    title: string | null
    filePath: string | null
    fonts: string[]
  }>
  /** Главы */
  chapters: Array<{
    startMs: number
    endMs: number
    title: string | null
    type: string
  }>
}

/** Конфигурация экспорта сериала */
export interface ExportSeriesConfig {
  /** Название аниме */
  animeName: string
  /** Год */
  year?: number
  /** Путь к папке назначения */
  outputDir: string
  /** Паттерн именования */
  namingPattern: NamingPattern
  /** Путь к постеру (опционально) */
  posterPath?: string
  /** Данные эпизодов */
  episodes: EpisodeExportData[]
  /** Выбранные ключи аудиодорожек (language + title) в порядке, указанном пользователем */
  selectedAudioKeys: string[]
  /** Выбранные ключи субтитров (language + title) в порядке, указанном пользователем */
  selectedSubtitleKeys: string[]
  /** Индекс аудиодорожки по умолчанию (0-based среди selectedAudioKeys) */
  defaultAudioIndex?: number
  /** Индекс субтитров по умолчанию (0-based среди selectedSubtitleKeys), undefined = нет default */
  defaultSubtitleIndex?: number
  /** Франшиза (для структуры папок) */
  franchise?: string
  /** Тип сезона (для умных паттернов) */
  seasonType?: SeasonType
  /** Создавать структуру папок */
  createFolderStructure?: boolean
  /** Открыть папку после экспорта */
  openFolderAfterExport?: boolean
}

/** Опции для определения пути в библиотеке */
export interface LibraryPathOptions {
  /** Путь к библиотеке */
  libraryPath: string
  /** Название аниме */
  animeName: string
  /** Номер сезона */
  seasonNumber: number
  /** Номер эпизода */
  episodeNumber: number
}

/** Статус аниме на Shikimori */
export type ShikimoriAnimeStatus = 'anons' | 'ongoing' | 'released'

/** Тип аниме на Shikimori */
export type ShikimoriAnimeKind = 'tv' | 'movie' | 'ova' | 'ona' | 'special' | 'music'

/** Тип жанра — genre (жанр) или theme (тема) */
export type ShikimoriGenreKind = 'genre' | 'theme'

/** Жанр или тема Shikimori */
export interface ShikimoriGenre {
  id: string
  name: string
  russian: string
  /** Тип: genre или theme */
  kind: ShikimoriGenreKind
}

/** Постер Shikimori */
export interface ShikimoriPoster {
  mainUrl: string
  originalUrl: string
}

/** Дата Shikimori */
export interface ShikimoriDate {
  year: number | null
  month: number | null
  day: number | null
}

/** Превью аниме (для списка поиска) */
export interface ShikimoriAnimePreview {
  id: string
  name: string
  russian: string | null
  description: string | null
  descriptionHtml: string | null
  score: number | null
  status: ShikimoriAnimeStatus
  kind: ShikimoriAnimeKind | null
  episodes: number
  episodesAired: number
  airedOn: ShikimoriDate | null
  releasedOn: ShikimoriDate | null
  poster: ShikimoriPoster | null
  genres: ShikimoriGenre[]
}

/** Полная информация об аниме */
export interface ShikimoriAnimeDetails extends ShikimoriAnimePreview {
  english: string | null
  japanese: string | null
  synonyms: string[]
  rating: string | null
  duration: number | null
  /** Правообладатели (лицензиаты) */
  licensors: string[]
  /** Название лицензиата на русском */
  licenseNameRu: string | null
}

/** Студия анимации (v0.5.1) */
export interface ShikimoriStudio {
  id: string
  name: string
  imageUrl: string | null
}

/** Персона (сейю, режиссёр и т.д.) (v0.5.1) */
export interface ShikimoriPerson {
  id: string
  name: string
  russian: string | null
  poster: ShikimoriPoster | null
}

/** Роль персоны в аниме (v0.5.1) */
export interface ShikimoriPersonRole {
  id: string
  rolesRu: string[]
  rolesEn: string[]
  person: ShikimoriPerson
}

/** Персонаж (v0.5.1) */
export interface ShikimoriCharacter {
  id: string
  name: string
  russian: string | null
  poster: ShikimoriPoster | null
}

/** Роль персонажа в аниме (v0.5.1) */
export interface ShikimoriCharacterRole {
  id: string
  rolesRu: string[]
  rolesEn: string[]
  character: ShikimoriCharacter
}

/** Внешняя ссылка (v0.5.1) */
export interface ShikimoriExternalLink {
  id: string
  kind: string
  url: string
}

/** Видео (трейлер, опенинг, эндинг) — v0.5.3 */
export interface ShikimoriVideo {
  id: string
  url: string
  name: string | null
  kind: string | null
  playerUrl: string | null
  imageUrl: string | null
}

/** Статистика оценок (v0.5.1) */
export interface ShikimoriScoreStat {
  score: number
  count: number
}

/** Статистика статусов (v0.5.1) */
export interface ShikimoriStatusStat {
  status: string
  count: number
}

/** Расширенная информация об аниме (v0.5.1, v0.5.3 — videos) */
export interface ShikimoriAnimeExtended extends ShikimoriAnimeDetails {
  studios: ShikimoriStudio[]
  personRoles: ShikimoriPersonRole[]
  characterRoles: ShikimoriCharacterRole[]
  fandubbers: string[]
  fansubbers: string[]
  externalLinks: ShikimoriExternalLink[]
  videos: ShikimoriVideo[]
  nextEpisodeAt: string | null
  scoresStats: ShikimoriScoreStat[]
  statusesStats: ShikimoriStatusStat[]
}

/** Тип связи между аниме на Shikimori */
export type ShikimoriRelationKind =
  | 'sequel'
  | 'prequel'
  | 'side_story'
  | 'parent_story'
  | 'summary'
  | 'full_story'
  | 'spin_off'
  | 'adaptation'
  | 'character'
  | 'alternative_version'
  | 'alternative_setting'
  | 'other'

/** Связанное аниме из GraphQL API */
export interface ShikimoriRelatedAnime {
  id: string
  anime: ShikimoriAnimePreview | null
  manga: null
  relationKind: ShikimoriRelationKind
  relationText: string
}

/** Аниме с информацией о связях */
export interface ShikimoriAnimeWithRelated {
  id: string
  name: string
  russian: string | null
  poster: ShikimoriPoster | null
  kind: ShikimoriAnimeKind | null
  status: ShikimoriAnimeStatus
  episodes: number
  airedOn: ShikimoriDate | null
  score: number | null
  related: ShikimoriRelatedAnime[]
}

/** Данные о связанном аниме для сохранения в БД */
export interface RelatedAnimeData {
  shikimoriId: number
  relationKind: string
  name: string | null
  posterUrl: string | null
  year: number | null
  kind: string | null
}

// === Типы для REST API графа франшизы ===

/** Узел графа франшизы (аниме в франшизе) */
export interface ShikimoriFranchiseNode {
  /** ID аниме на Shikimori */
  id: number
  /** Timestamp даты выхода */
  date: number
  /** Название (русское если есть, иначе оригинальное) */
  name: string
  /** URL постера */
  image_url: string
  /** URL страницы аниме */
  url: string
  /** Год выхода */
  year: number | null
  /** Тип: tv, movie, ova, ona, special, music */
  kind: string
  /** Вес узла для визуализации */
  weight: number
}

/** Связь между узлами графа франшизы */
export interface ShikimoriFranchiseLink {
  /** ID связи */
  id: number
  /** ID исходного аниме */
  source_id: number
  /** ID целевого аниме */
  target_id: number
  /** Индекс в массиве nodes (для визуализации) */
  source: number
  /** Индекс в массиве nodes (для визуализации) */
  target: number
  /** Вес связи для визуализации */
  weight: number
  /** Тип связи: sequel, prequel, side_story, etc. */
  relation: ShikimoriRelationKind
}

/** Ответ REST API /api/animes/{id}/franchise */
export interface ShikimoriFranchiseGraph {
  /** Все аниме в франшизе */
  nodes: ShikimoriFranchiseNode[]
  /** Связи между аниме */
  links: ShikimoriFranchiseLink[]
  /** ID текущего аниме (для которого запрошен граф) */
  current_id: number
}

/** Результат получения графа франшизы */
export interface FranchiseGraphResult {
  /** Полный граф франшизы */
  graph: ShikimoriFranchiseGraph
  /** Минимальный shikimoriId в графе (стабильный ключ франшизы) */
  rootShikimoriId: number
  /** Название франшизы (от root аниме) */
  franchiseName: string
}

/** Опции поиска Shikimori */
export interface ShikimoriSearchOptions {
  search: string
  limit?: number
  kind?: string
}

// === Manifest Types ===

/** Информация о видео в манифесте */
export interface ManifestVideo {
  path: string
  durationMs: number
  width: number
  height: number
  codec: string
  bitrate?: number
}

/** Аудиодорожка в манифесте */
export interface ManifestAudioTrack {
  id: string
  streamIndex: number
  language: string
  title: string
  codec: string
  channels: string
  bitrate?: number
  isDefault: boolean
}

/** Субтитры в манифесте */
export interface ManifestSubtitleTrack {
  id: string
  streamIndex: number
  language: string
  title: string
  format: string
  filePath: string
  isDefault: boolean
  fonts?: { name: string; path: string }[]
}

/** Тип главы */
export type ManifestChapterType = 'chapter' | 'op' | 'ed' | 'recap' | 'preview'

/** Глава в манифесте */
export interface ManifestChapter {
  startMs: number
  endMs: number
  title: string | null
  type: ManifestChapterType
  skippable: boolean
}

/** Информация об эпизоде */
export interface ManifestInfo {
  animeName: string
  seasonNumber: number
  episodeNumber: number
  episodeName?: string
}

/** Полный манифест эпизода */
export interface EpisodeManifest {
  version: 1
  episodeId: string
  info: ManifestInfo
  video: ManifestVideo
  audioTracks: ManifestAudioTrack[]
  subtitleTracks: ManifestSubtitleTrack[]
  chapters: ManifestChapter[]
  thumbnails?: {
    vttPath: string
    spritePath: string
  }
  navigation?: {
    nextEpisode?: { id: string; manifestPath: string }
    prevEpisode?: { id: string; manifestPath: string }
  }
  generatedAt: string
}

/** Информация о диске */
export interface DiskInfo {
  total: number
  free: number
  used: number
  usedPercent: number
}

/** Настройки системного трея */
export interface TraySettings {
  /** Сворачивать в трей при минимизации окна */
  minimizeToTray: boolean
  /** Закрывать в трей при нажатии на крестик */
  closeToTray: boolean
  /** Показывать уведомление при первом сворачивании в трей */
  showTrayNotification: boolean
}

/** Статус автообновления */
export interface UpdateStatus {
  /** Текущий статус */
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  /** Информация о доступном обновлении */
  updateInfo: {
    version: string
    releaseDate: string
    releaseNotes?: string
  } | null
  /** Прогресс загрузки (0-100) */
  downloadProgress: number
  /** Сообщение об ошибке */
  error: string | null
  /** Скорость загрузки (bytes/s) */
  downloadSpeed: number
  /** Оставшееся время загрузки (секунды) */
  downloadEta: number
}

// === Screenshot Types ===

/** Опции для генерации скриншотов */
export interface ScreenshotOptions {
  /** Количество скриншотов */
  count: number
  /** Формат изображения */
  format: 'webp' | 'jpg' | 'png'
  /** Ширина thumbnail (по умолчанию 320) */
  thumbnailWidth?: number
  /** Ширина полноразмерного (по умолчанию 1280) */
  fullWidth?: number
  /** Качество (по умолчанию 80) */
  quality?: number
  /** Пропустить первые N% видео (по умолчанию 10%) */
  skipStartPercent?: number
}

/** Результат генерации скриншотов */
export interface ScreenshotResult {
  success: boolean
  /** Пути к thumbnail-ам (маленькие) */
  thumbnails: string[]
  /** Пути к полноразмерным скриншотам */
  fullSize: string[]
  error?: string
}

// === Library Restore Types ===

/** Данные эпизода для восстановления */
export interface EpisodeRestoreData {
  folder: string
  number: number
  seasonNumber: number
  name?: string
  videoPath: string | null
  durationMs: number
  manifestPath: string
  audioTracks: Array<{
    streamIndex: number
    language: string
    title: string
    codec: string
    channels: string
    bitrate?: number
    isDefault: boolean
    filePath: string | null
  }>
  subtitleTracks: Array<{
    streamIndex: number
    language: string
    title: string
    format: string
    filePath: string
    isDefault: boolean
    fonts: Array<{ name: string; path: string }>
  }>
  chapters: Array<{
    startMs: number
    endMs: number
    title: string | null
    type: string
    skippable: boolean
  }>
  /** Прогресс просмотра из _user/ (если есть) */
  userProgress: UserEpisodeData | null
}

/** Данные аниме для восстановления */
export interface AnimeRestoreData {
  /** Папка аниме */
  folder: string
  /** Метаданные из anime.meta.json (релизные) */
  meta: {
    version: 1
    shikimoriId: number | null
    isBdRemux: boolean
    fallbackInfo: { name: string; originalName?: string; year?: number }
    createdAt: string
  }
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
  animes: AnimeRestoreData[]
  stats: {
    totalAnimes: number
    totalEpisodes: number
    withShikimoriId: number
  }
  warnings: string[]
  error?: string
}

export interface ElectronAPI {
  // === Информация о приложении ===
  app: {
    /** Получить версию приложения */
    getVersion: () => Promise<string>
    /** Получить системный путь */
    getPath: (name: string) => Promise<string>
    /** Получить количество ядер CPU */
    getCpuCount: () => Promise<number>
    /** Получить информацию о диске */
    getDiskInfo: (targetPath?: string) => Promise<DiskInfo | null>
    /** Получить размер папки библиотеки (с кешированием, TTL 5 минут) */
    getLibrarySize: (libraryPath: string, forceRefresh?: boolean) => Promise<number>
    /** Инвалидировать кеш размера библиотеки (вызывать после импорта) */
    invalidateLibrarySizeCache: () => Promise<boolean>
    /** Показать системное уведомление */
    showNotification: (options: {
      title: string
      body: string
      type?: 'info' | 'success' | 'error'
    }) => Promise<boolean>
    /** Получить состояние блокировки сна */
    getPowerSaveState: () => Promise<{
      isBlocking: boolean
      autoEnabled: boolean
      manualEnabled: boolean
    }>
    /** Переключить ручную блокировку сна */
    togglePowerSaveManual: () => Promise<{
      isBlocking: boolean
      manualEnabled: boolean
    }>
    /** Установить авто-блокировку при транскодировании */
    setPowerSaveAuto: (enabled: boolean) => Promise<{ autoEnabled: boolean }>
    /** Установить блокировку сна при воспроизведении видео */
    setPowerSavePlayback: (isPlaying: boolean) => Promise<{ isBlocking: boolean }>
  }

  // === Управление окном (frameless title bar) ===
  window: {
    /** Минимизировать окно */
    minimize: () => Promise<void>
    /** Максимизировать / Восстановить окно */
    maximize: () => Promise<boolean>
    /** Закрыть окно */
    close: () => Promise<void>
    /** Проверить, максимизировано ли окно */
    isMaximized: () => Promise<boolean>
    /** Получить платформу (для позиционирования кнопок) */
    getPlatform: () => Promise<'win32' | 'darwin' | 'linux'>
    /** Подписка на изменение состояния maximize */
    onMaximizeChanged: (callback: (isMaximized: boolean) => void) => () => void
  }

  // === Диалоги ===
  dialog: {
    /** Открыть диалог выбора файла */
    selectFile: (filters?: FileFilter[]) => Promise<string | null>
    /** Открыть диалог выбора нескольких файлов */
    selectFiles: (filters?: FileFilter[]) => Promise<string[]>
    /** Открыть диалог выбора папки */
    selectFolder: () => Promise<string | null>
    /** Открыть диалог сохранения файла */
    saveFile: (defaultName?: string, filters?: FileFilter[]) => Promise<string | null>
  }

  // === Файловая система ===
  fs: {
    /**
     * Получить путь к файлу из File объекта (для Drag & Drop)
     * В Electron с contextIsolation: true свойство file.path недоступно,
     * поэтому используем webUtils.getPathForFile()
     */
    getPathForFile: (file: File) => string
    /** Сканировать папку на медиафайлы (video, audio или оба) */
    scanFolder: (
      folderPath: string,
      recursive?: boolean,
      mediaTypes?: ('video' | 'audio')[],
    ) => Promise<{ success: boolean; files: MediaFileInfo[] }>
    /** Удалить файл или папку (по умолчанию в корзину) */
    delete: (targetPath: string, moveToTrash?: boolean) => Promise<{ success: boolean; error?: string }>
    /** Проверить существование пути */
    exists: (targetPath: string) => Promise<boolean>
    /** Получить информацию о файле (размер, дата модификации) */
    stat: (filePath: string) => Promise<{ success: boolean; size: number; mtime?: Date; error?: string }>
    /** Копировать файл (создаёт родительские директории автоматически) */
    copyFile: (sourcePath: string, destPath: string) => Promise<{ success: boolean; error?: string }>
    /** Сканировать внешние субтитры (Rus Sub/, Eng Sub/ и т.д.) */
    scanExternalSubtitles: (
      videoFolderPath: string,
      videoFiles: Array<{ path: string; episodeNumber: number }>,
    ) => Promise<ExternalSubtitleScanResult>
    /** Сканировать внешние аудио (Rus Sound/, Audio/ и т.д.) */
    scanExternalAudio: (
      videoFolderPath: string,
      videoFiles: Array<{ path: string; episodeNumber: number }>,
    ) => Promise<ExternalAudioScanResult>
    /** Получить метаданные изображения (размеры, blur placeholder) */
    getImageMetadata: (filePath: string) => Promise<{
      success: boolean
      width?: number
      height?: number
      size?: number
      mimeType?: string
      blurDataURL?: string
      error?: string
    }>
  }

  // === Субтитры ===
  subtitle: {
    /** Сдвинуть таймкоды в файле субтитров (ASS/SRT) */
    shift: (options: { inputPath: string; outputPath: string; offsetMs: number }) => Promise<{
      success: boolean
      removedEvents?: number
      totalEvents?: number
      error?: string
    }>
    /** Предпросмотр сдвига — первые N событий с новыми таймкодами */
    previewShift: (
      inputPath: string,
      offsetMs: number,
      limit?: number,
    ) => Promise<{
      events: Array<{ start: string; end: string; text: string }>
      total: number
      error?: string
    }>
  }

  // === Библиотека ===
  library: {
    /** Получить путь к библиотеке по умолчанию (Videos/Animatrona) */
    getDefaultPath: () => Promise<string>
    /** Получить путь к папке эпизода */
    resolveOutputPath: (options: LibraryPathOptions) => Promise<string>
    /** Создать структуру папок для эпизода */
    ensureEpisodeDirectory: (options: LibraryPathOptions) => Promise<string>
    /** Создать папку для аниме (для постера и других общих файлов) */
    ensureAnimeDirectory: (libraryPath: string, animeName: string) => Promise<string>
  }

  // === Shikimori API ===
  shikimori: {
    /** Поиск аниме по названию */
    search: (options: ShikimoriSearchOptions) => Promise<{
      success: boolean
      data?: ShikimoriAnimePreview[]
      error?: string
    }>
    /** Получить детали аниме по Shikimori ID */
    getDetails: (shikimoriId: number) => Promise<{
      success: boolean
      data?: ShikimoriAnimeDetails
      error?: string
    }>
    /** Скачать постер и сохранить локально (в папку аниме если передан savePath) */
    downloadPoster: (
      posterUrl: string,
      animeId: string,
      options?: { fileName?: string; savePath?: string },
    ) => Promise<{
      success: boolean
      localPath?: string
      /** Имя файла */
      filename?: string
      /** MIME-тип */
      mimeType?: string
      /** Размер файла в байтах */
      size?: number
      /** Ширина изображения */
      width?: number
      /** Высота изображения */
      height?: number
      /** Base64 blur placeholder для next/image */
      blurDataURL?: string
      error?: string
    }>
    /** Получить аниме со связанными */
    getWithRelated: (shikimoriId: number) => Promise<{
      success: boolean
      data?: ShikimoriAnimeWithRelated
      error?: string
    }>
    /** Получить расширенные метаданные (v0.5.1) */
    getExtended: (shikimoriId: number) => Promise<{
      success: boolean
      data?: ShikimoriAnimeExtended
      error?: string
    }>
  }

  // === Франшизы ===
  franchise: {
    /** Получить связанные аниме из Shikimori (GraphQL) */
    fetchRelated: (shikimoriId: number) => Promise<{
      success: boolean
      data?: {
        sourceAnime: {
          shikimoriId: number
          name: string
          /** ID франшизы из Shikimori (например "tondemo_skill_de_isekai_hourou_meshi") */
          franchise: string | null
        }
        relatedAnimes: RelatedAnimeData[]
      }
      error?: string
    }>

    /** Получить граф франшизы из REST API Shikimori */
    fetchGraph: (shikimoriId: number) => Promise<{
      success: boolean
      data?: FranchiseGraphResult | null
      message?: string
      error?: string
    }>

    /** Очистить кэш графов франшиз */
    clearCache: () => Promise<{
      success: boolean
      error?: string
    }>
  }

  // === Manifest ===
  manifest: {
    /** Сгенерировать манифест из результатов demux */
    generate: (
      demuxResult: DemuxResult,
      options: {
        episodeId: string
        videoPath: string
        outputDir: string
        animeInfo: ManifestInfo
      },
    ) => Promise<{
      success: boolean
      manifestPath?: string
      manifest?: EpisodeManifest
      error?: string
    }>
    /** Прочитать существующий манифест */
    read: (manifestPath: string) => Promise<{
      success: boolean
      data?: EpisodeManifest
      error?: string
    }>
    /** Обновить навигацию в манифесте */
    updateNavigation: (
      manifestPath: string,
      navigation: {
        nextEpisode?: { id: string; manifestPath: string }
        prevEpisode?: { id: string; manifestPath: string }
      },
    ) => Promise<{ success: boolean; error?: string }>
    /** Обновить thumbnails в манифесте */
    updateThumbnails: (
      manifestPath: string,
      thumbnails: {
        vttPath: string
        spritePath: string
      },
    ) => Promise<{ success: boolean; error?: string }>
  }

  // === FFmpeg ===
  ffmpeg: {
    /** Анализ медиафайла */
    probe: (filePath: string) => Promise<OperationResult & { data?: MediaInfo }>
    /** Транскодирование видео */
    transcodeVideo: (input: string, output: string, options: VideoTranscodeOptions) => Promise<OperationResult>
    /** Транскодирование аудио */
    transcodeAudio: (input: string, output: string, options: AudioTranscodeOptions) => Promise<OperationResult>
    /** Мерж в MKV */
    merge: (config: MergeConfig) => Promise<OperationResult & { outputPath?: string }>
    /** Демультиплексирование (извлечение потоков без перекодирования) */
    demux: (inputPath: string, outputDir: string, options?: DemuxOptions) => Promise<DemuxResult>
    /** Транскодирование аудио VBR (умный подбор битрейта) */
    transcodeAudioVBR: (
      input: string,
      output: string,
      options: AudioTranscodeVBROptions,
    ) => Promise<AudioTranscodeResult>
    /** Кодирование тестового сэмпла */
    encodeSample: (options: {
      inputPath: string
      outputPath: string
      profile: EncodingProfileOptions
      startTime?: number
      duration?: number
      sourceBitDepth?: number
    }) => Promise<SampleResult>
    /** Генерация скриншотов из видео */
    generateScreenshots: (
      inputPath: string,
      outputDir: string,
      duration: number,
      options: ScreenshotOptions,
    ) => Promise<ScreenshotResult>
    /** Генерация thumbnail sprite sheet для hover preview */
    generateThumbnailSprite: (
      inputPath: string,
      outputDir: string,
      duration: number,
      options?: {
        frameCount?: number
        frameWidth?: number
        frameHeight?: number
        columns?: number
        quality?: number
      },
    ) => Promise<{
      success: boolean
      spritePath: string
      vttPath: string
      spriteSize: number
      error?: string
    }>
    /** Подписка на прогресс FFmpeg операций */
    onProgress: (callback: (data: TranscodeProgress & { type: string; profileName?: string }) => void) => () => void
    /** Получить версию FFmpeg */
    getVersion: () => Promise<OperationResult & { data?: string }>
    /** Получить информацию об оборудовании (GPU и CPU) */
    getHardwareInfo: () => Promise<OperationResult & { data?: { gpuModel: string | null; cpuModel: string } }>
  }

  // === VMAF автоподбор качества ===
  vmaf: {
    /** Расчёт VMAF между оригинальным и закодированным видео */
    calculate: (
      encoded: string,
      original: string,
      options?: VmafOptions,
    ) => Promise<{ success: boolean; data?: VmafResult; error?: string }>

    /** Поиск оптимального CQ для целевого VMAF */
    findOptimalCQ: (
      inputPath: string,
      videoOptions: Omit<VideoTranscodeOptions, 'cq'>,
      options?: Partial<CqSearchOptions>,
      preferCpu?: boolean,
      itemId?: string,
    ) => Promise<{ success: boolean; data?: CqSearchResult; error?: string }>

    /** Подписка на прогресс поиска CQ */
    onProgress: (callback: (progress: CqSearchProgress) => void) => () => void
  }

  // === Очередь транскодирования ===
  transcode: {
    /** Добавить файл в очередь */
    addToQueue: (
      filePath: string,
      settings?: PerFileTranscodeSettings,
    ) => Promise<{ success: boolean; id?: string; error?: string }>

    /** Удалить из очереди */
    removeFromQueue: (id: string) => Promise<{ success: boolean; error?: string }>

    /** Начать обработку очереди */
    start: () => Promise<{ success: boolean; error?: string }>

    /** Приостановить элемент */
    pauseItem: (id: string) => Promise<{ success: boolean; error?: string }>

    /** Возобновить элемент */
    resumeItem: (id: string) => Promise<{ success: boolean; error?: string }>

    /** Отменить элемент */
    cancelItem: (id: string) => Promise<{ success: boolean; error?: string }>

    /** Изменить порядок очереди */
    reorderQueue: (orderedIds: string[]) => Promise<{ success: boolean; error?: string }>

    /** Обновить настройки элемента */
    updateSettings: (id: string, settings: PerFileTranscodeSettings) => Promise<{ success: boolean; error?: string }>

    /** Получить текущую очередь */
    getQueue: () => Promise<{ success: boolean; queue: QueueItem[]; error?: string }>

    /** Получить элемент по ID */
    getItem: (id: string) => Promise<{ success: boolean; item?: QueueItem; error?: string }>

    /** Анализировать элемент */
    analyzeItem: (id: string, demuxResult: DemuxResult) => Promise<{ success: boolean; error?: string }>

    /** Проверить возможность паузы */
    getPauseCapabilities: () => Promise<{
      success: boolean
      available: boolean
      method: 'signals' | 'pssuspend' | 'none'
      message?: string
      error?: string
    }>

    /** Приостановить всю обработку */
    pauseAll: () => Promise<{ success: boolean; error?: string }>

    /** Возобновить всю обработку */
    resumeAll: () => Promise<{ success: boolean; error?: string }>

    /** Установить путь к библиотеке */
    setLibraryPath: (libraryPath: string) => Promise<{ success: boolean; error?: string }>

    /** Подписка на прогресс элемента */
    onProgress: (callback: (id: string, progress: TranscodeProgressExtended) => void) => () => void

    /** Подписка на изменение статуса */
    onStatusChange: (callback: (id: string, status: QueueItemStatus, error?: string) => void) => () => void

    /** Подписка на изменение очереди */
    onQueueChange: (callback: (queue: QueueItem[]) => void) => () => void

    /** Подписка на начало обработки */
    onProcessingStarted: (callback: () => void) => () => void

    /** Подписка на завершение обработки */
    onProcessingCompleted: (callback: () => void) => () => void
  }

  // === Параллельное транскодирование (Dual Encoders + CPU Audio) ===
  parallelTranscode: {
    /** Добавить batch эпизодов для обработки (legacy без batchId) */
    addBatch: (items: BatchImportItem[]) => Promise<{ success: boolean; error?: string }>

    /** Добавить batch эпизодов для обработки с batchId */
    addBatchWithId: (items: BatchImportItem[], batchId?: string) => Promise<{ success: boolean; error?: string }>

    /** Начать новый batch с полным сбросом состояния */
    startNewBatch: (items: BatchImportItem[], batchId?: string) => Promise<{ success: boolean; error?: string }>

    /** Получить текущий batch ID */
    getCurrentBatchId: () => Promise<{ success: boolean; data?: string | null; error?: string }>

    /** Получить текущие лимиты параллельности */
    getConcurrencyLimits: () => Promise<{
      success: boolean
      data?: { videoMaxConcurrent: number; audioMaxConcurrent: number }
      error?: string
    }>

    /** Установить максимальное количество параллельных аудио-задач */
    setAudioMaxConcurrent: (value: number) => Promise<{ success: boolean; value?: number; error?: string }>

    /** Установить максимальное количество параллельных видео-задач */
    setVideoMaxConcurrent: (value: number) => Promise<{ success: boolean; value?: number; error?: string }>

    /** Добавить один элемент */
    addItem: (item: BatchImportItem) => Promise<{ success: boolean; error?: string }>

    /** Получить агрегированный прогресс */
    getProgress: () => Promise<{ success: boolean; progress: AggregatedProgress | null; error?: string }>

    /** Получить элемент по ID */
    getItem: (itemId: string) => Promise<{ success: boolean; item: ImportQueueItem | null; error?: string }>

    /** Получить все элементы */
    getItems: () => Promise<{ success: boolean; items: ImportQueueItem[]; error?: string }>

    /** Проверить, идёт ли обработка */
    isProcessing: () => Promise<{ success: boolean; processing: boolean; error?: string }>

    /** Приостановить всё */
    pause: () => Promise<{ success: boolean; error?: string }>

    /** Возобновить всё */
    resume: () => Promise<{ success: boolean; error?: string }>

    /** Отменить элемент */
    cancelItem: (itemId: string) => Promise<{ success: boolean; error?: string }>

    /** Отменить всё */
    cancelAll: () => Promise<{ success: boolean; error?: string }>

    /** Очистить завершённые */
    clearCompleted: () => Promise<{ success: boolean; error?: string }>

    // === Подписки на события ===

    /** Подписка на агрегированный прогресс */
    onAggregatedProgress: (callback: (progress: AggregatedProgress) => void) => () => void

    /** Подписка на прогресс видео */
    onVideoProgress: (callback: (taskId: string, progress: TranscodeProgressExtended) => void) => () => void

    /** Подписка на прогресс аудио */
    onAudioProgress: (callback: (taskId: string, progress: TranscodeProgressExtended) => void) => () => void

    /** Подписка на завершение видео */
    onVideoCompleted: (
      callback: (
        itemId: string,
        episodeId: string,
        outputPath: string,
        meta?: {
          ffmpegCommand?: string
          transcodeDurationMs?: number
          activeGpuWorkers?: number
        },
      ) => void,
    ) => () => void

    /** Подписка на завершение аудиодорожки */
    onAudioTrackCompleted: (callback: (trackId: string, outputPath: string, episodeId: string) => void) => () => void

    /** Подписка на завершение элемента (видео + все аудио готовы) */
    onItemCompleted: (
      callback: (itemId: string, episodeId: string, success: boolean, errorMessage?: string) => void,
    ) => () => void

    /** Подписка на ошибку батча */
    onBatchError: (callback: (error: string) => void) => () => void

    /** Подписка на добавление элемента */
    onItemAdded: (callback: (itemId: string, episodeId: string) => void) => () => void

    /** Подписка на ошибку элемента */
    onItemError: (callback: (itemId: string, episodeId: string, error: string) => void) => () => void

    /** Подписка на ошибку задачи */
    onTaskError: (callback: (taskId: string, type: 'video' | 'audio', error: string) => void) => () => void

    /** Подписка на паузу */
    onPaused: (callback: () => void) => () => void

    /** Подписка на возобновление */
    onResumed: (callback: () => void) => () => void

    /** Подписка на завершение batch */
    onBatchCompleted: (callback: (batchId: string, success: boolean) => void) => () => void

    // === VMAF прогресс (сохраняется в main для навигации) ===

    /** Получить VMAF прогресс для item */
    getVmafProgress: (itemId?: string) => Promise<{ success: boolean; data?: CqSearchProgress; error?: string }>

    /** Получить все VMAF прогрессы */
    getAllVmafProgress: () => Promise<{ success: boolean; data?: Record<string, CqSearchProgress>; error?: string }>

    /** Подписка на VMAF прогресс */
    onVmafProgress: (callback: (itemId: string, progress: CqSearchProgress) => void) => () => void

    // === Защита от дублирования обработки ===

    /** Проверить, обрабатывается ли item */
    isItemProcessing: (itemId?: string) => Promise<{ success: boolean; data?: boolean; error?: string }>

    /** Установить текущий обрабатываемый item */
    setProcessingItem: (itemId: string | null) => Promise<{ success: boolean; data?: boolean; error?: string }>

    /** Получить ID текущего обрабатываемого item */
    getProcessingItemId: () => Promise<{ success: boolean; data?: string | null; error?: string }>

    // === FFmpeg Log Viewer ===

    /** Получить все видео-логи */
    getVideoLogs: () => Promise<{
      success: boolean
      data?: Array<{ timestamp: number; taskId: string; level: 'info' | 'warning' | 'error'; message: string }>
      error?: string
    }>

    /** Получить логи конкретной видео-задачи */
    getVideoTaskLogs: (taskId: string) => Promise<{
      success: boolean
      data?: Array<{ timestamp: number; taskId: string; level: 'info' | 'warning' | 'error'; message: string }>
      error?: string
    }>

    /** Очистить все видео-логи */
    clearVideoLogs: () => Promise<{ success: boolean; error?: string }>

    /** Получить количество записей в видео-логах */
    getVideoLogCount: () => Promise<{ success: boolean; data?: number; error?: string }>

    /** Подписка на новые записи логов (real-time) */
    onVideoLogEntry: (
      callback: (
        taskId: string,
        entry: { timestamp: number; level: 'info' | 'warning' | 'error'; message: string },
      ) => void,
    ) => () => void
  }

  // === Системный трей ===
  tray: {
    /** Получить текущие настройки трея */
    getSettings: () => Promise<TraySettings>
    /** Обновить настройки трея */
    updateSettings: (settings: Partial<TraySettings>) => Promise<void>
    /** Подписка на изменение настроек трея из main process */
    onSettingsChanged: (callback: (settings: TraySettings) => void) => () => void
  }

  // === Экспорт сериала в MKV ===
  export: {
    /** Запустить экспорт сериала */
    start: (config: ExportSeriesConfig) => Promise<ExportResult>
    /** Отменить текущий экспорт */
    cancel: () => Promise<{ success: boolean }>
    /** Получить текущий прогресс */
    getProgress: () => Promise<SeriesExportProgress>
    /** Проверить, активен ли экспорт */
    isActive: () => Promise<boolean>
    /** Подписка на прогресс экспорта */
    onProgress: (callback: (progress: SeriesExportProgress) => void) => () => void
    /** Подписка на завершение экспорта */
    onCompleted: (callback: (result: ExportResult) => void) => () => void
    /** Подписка на ошибку экспорта */
    onError: (callback: (error: string) => void) => () => void
  }

  // === Import Queue — Event-driven архитектура ===
  importQueue: {
    // === Команды ===

    /** Добавить items в очередь */
    addItems: (items: ImportQueueAddData[]) => Promise<{ success: boolean; error?: string }>

    /** Начать обработку очереди */
    start: () => Promise<{ success: boolean; error?: string }>

    /** Приостановить очередь */
    pause: () => Promise<{ success: boolean; error?: string }>

    /** Возобновить очередь */
    resume: () => Promise<{ success: boolean; error?: string }>

    /** Отменить item */
    cancelItem: (itemId: string) => Promise<{ success: boolean; error?: string }>

    /** Удалить item из очереди */
    removeItem: (itemId: string) => Promise<{ success: boolean; error?: string }>

    /** Повторить обработку item с ошибкой */
    retryItem: (itemId: string) => Promise<{ success: boolean; error?: string }>

    /** Отменить всю очередь */
    cancelAll: () => Promise<{ success: boolean; error?: string }>

    /** Получить текущее состояние очереди */
    getState: () => Promise<{ success: boolean; data?: ImportQueueState; error?: string }>

    /** Получить item по ID */
    getItem: (itemId: string) => Promise<{ success: boolean; data?: ImportQueueEntry; error?: string }>

    /** Очистить завершённые items */
    clearCompleted: () => Promise<{ success: boolean; error?: string }>

    /** Установить автозапуск */
    setAutoStart: (enabled: boolean) => Promise<{ success: boolean; error?: string }>

    /** Изменить порядок элементов (drag & drop) */
    reorderItems: (activeId: string, overId: string) => Promise<{ success: boolean; error?: string }>

    /** Обновить данные item (профиль, параллельность, sync offset и т.д.) */
    updateItem: (itemId: string, data: Partial<ImportQueueAddData>) => Promise<{ success: boolean; error?: string }>

    // === Обновления от renderer (ImportProcessor) ===

    /** Обновить статус item */
    updateStatus: (
      itemId: string,
      status: ImportQueueStatus,
      error?: string,
    ) => Promise<{ success: boolean; error?: string }>

    /** Обновить прогресс item */
    updateProgress: (
      itemId: string,
      progress: number,
      currentFileName?: string,
      currentStage?: string,
      detailProgress?: ImportQueueDetailProgress,
    ) => Promise<{ success: boolean; error?: string }>

    /** Обновить VMAF прогресс */
    updateVmafProgress: (
      itemId: string,
      vmafProgress: ImportQueueVmafProgress,
    ) => Promise<{ success: boolean; error?: string }>

    /** Установить результат VMAF */
    setVmafResult: (itemId: string, result: ImportQueueVmafResult) => Promise<{ success: boolean; error?: string }>

    /** Установить результат импорта (animeId) */
    setImportResult: (itemId: string, animeId: string) => Promise<{ success: boolean; error?: string }>

    // === Подписки на события (main → renderer) ===

    /** Подписка на изменение состояния очереди */
    onStateChanged: (callback: (state: ImportQueueState) => void) => () => void

    /** Подписка на изменение статуса item */
    onItemStatus: (
      callback: (data: { itemId: string; status: ImportQueueStatus; error?: string }) => void,
    ) => () => void

    /** Подписка на изменение прогресса item */
    onItemProgress: (
      callback: (data: {
        itemId: string
        progress: number
        currentFileName?: string
        currentStage?: string
        detailProgress?: ImportQueueDetailProgress
        vmafProgress?: ImportQueueVmafProgress
      }) => void,
    ) => () => void
  }

  // === Шаблоны импорта ===
  templates: {
    /** Получить все шаблоны (дефолтные + пользовательские) */
    getAll: () => Promise<{ success: boolean; data?: ImportTemplate[]; error?: string }>

    /** Получить шаблон по ID */
    getById: (id: string) => Promise<{ success: boolean; data?: ImportTemplate; error?: string }>

    /** Создать шаблон */
    create: (data: ImportTemplateCreateData) => Promise<{ success: boolean; data?: ImportTemplate; error?: string }>

    /** Обновить шаблон */
    update: (
      id: string,
      data: ImportTemplateUpdateData,
    ) => Promise<{ success: boolean; data?: ImportTemplate; error?: string }>

    /** Удалить шаблон */
    delete: (id: string) => Promise<{ success: boolean; error?: string }>

    /** Отметить шаблон как использованный */
    markAsUsed: (id: string) => Promise<{ success: boolean; error?: string }>
  }

  // === История импортов ===
  history: {
    /** Получить все записи истории */
    getAll: () => Promise<{ success: boolean; data?: ImportHistoryEntry[]; error?: string }>

    /** Получить записи с фильтром */
    get: (filter?: ImportHistoryFilter) => Promise<{ success: boolean; data?: ImportHistoryEntry[]; error?: string }>

    /** Получить запись по ID */
    getById: (id: string) => Promise<{ success: boolean; data?: ImportHistoryEntry; error?: string }>

    /** Добавить запись в историю */
    add: (data: ImportHistoryCreateData) => Promise<{ success: boolean; data?: ImportHistoryEntry; error?: string }>

    /** Удалить запись */
    delete: (id: string) => Promise<{ success: boolean; error?: string }>

    /** Очистить историю */
    clear: () => Promise<{ success: boolean; error?: string }>

    /** Получить статистику */
    getStats: () => Promise<{ success: boolean; data?: ImportHistoryStats; error?: string }>

    /** Получить последние N записей */
    getRecent: (limit?: number) => Promise<{ success: boolean; data?: ImportHistoryEntry[]; error?: string }>
  }

  // === Backup / Restore — РЕЛИЗНЫЕ ДАННЫЕ ===
  backup: {
    /** Записать anime.meta.json (только релизные данные) */
    writeAnimeMeta: (params: {
      animeFolder: string
      shikimoriId: number | null
      isBdRemux: boolean
      fallbackInfo: { name: string; originalName?: string; year?: number }
    }) => Promise<{ success: boolean; error?: string }>

    /** Обновить anime.meta.json (частичное обновление) */
    updateAnimeMeta: (
      animeFolder: string,
      updates: {
        shikimoriId?: number | null
        isBdRemux?: boolean
        fallbackInfo?: { name: string; originalName?: string; year?: number }
      },
    ) => Promise<{ success: boolean; error?: string }>

    /** Прочитать anime.meta.json */
    readAnimeMeta: (animeFolder: string) => Promise<{
      success: boolean
      data?: {
        version: 1
        shikimoriId: number | null
        isBdRemux: boolean
        fallbackInfo: { name: string; originalName?: string; year?: number }
        createdAt: string
      } | null
      error?: string
    }>

    /** Проверить существование anime.meta.json */
    hasAnimeMeta: (animeFolder: string) => Promise<{ success: boolean; exists?: boolean; error?: string }>

    /** Удалить anime.meta.json */
    deleteAnimeMeta: (animeFolder: string) => Promise<{ success: boolean; error?: string }>

    /** Быстрое сканирование библиотеки — только статистика */
    quickScanLibrary: (libraryPath: string) => Promise<{
      success: boolean
      stats?: {
        totalAnimes: number
        totalEpisodes: number
        withShikimoriId: number
      }
      error?: string
    }>

    /** Полное сканирование библиотеки для восстановления */
    scanLibraryForRestore: (libraryPath: string, loadShikimori?: boolean) => Promise<LibraryScanResult>
  }

  // === User Data — ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ В _user/ ===
  userData: {
    /** Инициализировать папку _user/ */
    init: (libraryPath: string) => Promise<{ success: boolean; error?: string }>

    /** Обновить статус просмотра аниме */
    updateWatchStatus: (
      libraryPath: string,
      animeFolderPath: string,
      watchStatus: WatchStatusMeta,
      watchedAt?: string | null,
    ) => Promise<{ success: boolean; error?: string }>

    /** Обновить оценку аниме */
    updateUserRating: (
      libraryPath: string,
      animeFolderPath: string,
      userRating: number | null,
    ) => Promise<{ success: boolean; error?: string }>

    /** Обновить предпочтения дорожек */
    updateTrackPreferences: (
      libraryPath: string,
      animeFolderPath: string,
      trackPreferences: TrackPreferences,
    ) => Promise<{ success: boolean; error?: string }>

    /** Обновить прогресс эпизода */
    updateEpisodeProgress: (params: {
      libraryPath: string
      animeFolderPath: string
      episodeFolderPath: string
      currentTime: number
      completed: boolean
      volume?: number
      selectedAudio: SelectedTrack | null
      selectedSubtitle: SelectedTrack | null
    }) => Promise<{ success: boolean; error?: string }>

    /** Прочитать прогресс эпизода */
    readEpisodeProgress: (
      libraryPath: string,
      animeFolderPath: string,
      episodeFolderPath: string,
    ) => Promise<{ success: boolean; data?: UserEpisodeData | null; error?: string }>

    /** Прочитать данные аниме пользователя */
    readAnimeData: (
      libraryPath: string,
      animeFolderPath: string,
    ) => Promise<{ success: boolean; data?: UserAnimeData | null; error?: string }>

    /** Удалить прогресс эпизода */
    deleteEpisodeProgress: (
      libraryPath: string,
      animeFolderPath: string,
      episodeFolderPath: string,
    ) => Promise<{ success: boolean; error?: string }>

    /** Удалить все данные аниме */
    deleteAnimeData: (libraryPath: string, animeFolderPath: string) => Promise<{ success: boolean; error?: string }>

    /** Прочитать индекс _user/ */
    readIndex: (libraryPath: string) => Promise<{ success: boolean; data?: unknown; error?: string }>

    /** Экспортировать все пользовательские данные */
    exportAll: (libraryPath: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
  }

  // === События (legacy) ===
  on: {
    /** Подписка на прогресс транскодирования (legacy) */
    transcodeProgress: (callback: (progress: TranscodeProgress & { type: string }) => void) => () => void
  }

  // === Автообновления ===
  updater: {
    /** Проверить наличие обновлений */
    check: () => Promise<{ success: boolean; error?: string }>
    /** Скачать обновление */
    download: () => Promise<{ success: boolean; error?: string }>
    /** Установить обновление и перезапустить */
    install: () => Promise<{ success: boolean; error?: string }>
    /** Получить текущий статус обновления */
    getStatus: () => Promise<UpdateStatus>
    /** Получить версию приложения */
    getVersion: () => Promise<string>
    /** Получить changelog из GitHub Releases */
    getChangelog: (version: string) => Promise<{ success: boolean; changelog?: string | null; error?: string }>
    /** Подписка на изменение статуса обновления */
    onStatusChange: (callback: (status: UpdateStatus) => void) => () => void
    /** Подписка на получение changelog */
    onChangelog: (callback: (data: { version: string; changelog: string }) => void) => () => void
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
    electron?: ElectronAPI
  }
}

export {}

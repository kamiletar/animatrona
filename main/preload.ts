/**
 * Animatrona - Preload Script
 *
 * Мост между Electron main process и renderer (Next.js).
 * Предоставляет безопасный API для доступа к нативным функциям.
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AudioTranscodeOptions,
  AudioTranscodeVBROptions,
  DemuxOptions,
  DemuxResult,
  FileFilter,
  MediaInfo,
  MergeConfig,
  OperationResult,
  PerFileTranscodeSettings,
  QueueItem,
  QueueItemStatus,
  TranscodeProgress,
  TranscodeProgressExtended,
  VideoTranscodeOptions,
} from '../shared/types'
import type { AchievementUnlockedEvent, AchievementWithProgress, UserAchievements } from '../shared/types/achievements'
import type {
  AnimeManifest,
  GenerateAnimeManifestInput,
  GenerateAnimeManifestResult,
} from '../shared/types/anime-manifest'
import type { BonusPoints, BonusTransaction } from '../shared/types/bonus-points'
import type { QueueExportConfig } from '../shared/types/export-queue'
import type {
  AddTrackerOptions,
  DiscoverResult,
  FederationOperationResult,
  FederationSettings,
  GlobalSeederStats,
  SyncOptions,
  SyncResult,
  TrackerInfo,
  TrustLevel,
} from '../shared/types/federation'
import type {
  ImportHistoryCreateData,
  ImportHistoryEntry,
  ImportHistoryFilter,
  ImportHistoryStats,
} from '../shared/types/import-history'
import type {
  ImportQueueAddData,
  ImportQueueDetailProgress,
  ImportQueueEntry,
  ImportQueueState,
  ImportQueueStatus,
  ImportQueueVmafProgress,
  ImportQueueVmafResult,
} from '../shared/types/import-queue'
import type {
  ImportTemplate,
  ImportTemplateCreateData,
  ImportTemplateUpdateData,
} from '../shared/types/import-template'
import type {
  GatewayStatus,
  IpfsAddResult,
  IpfsStatResult,
  IpnsPublishResult,
  IpnsResolveResult,
  P2PDiagnostics,
  PinInfo,
  PinStats,
  PublishedLibrary,
  PublisherConfig,
  PublishProgress,
  PublishResult,
  SchedulerConfig,
  SchedulerStatus,
  Subscription,
  SubscriptionCreateData,
  SubscriptionRefreshResult,
} from '../shared/types/ipfs'
import type { EpisodeManifest } from '../shared/types/manifest'
import type {
  Friend,
  FriendRequest,
  PresenceMessage,
  PresenceSettings,
  UserProfile,
  UserProfileUpdate,
  WatchingInfo,
  WatchPartyChatMessage,
  WatchPartyInvite,
  WatchPartyParticipant,
  WatchPartyPlaybackState,
  WatchPartyRoom,
} from '../shared/types/orbitdb'
import type { AggregatedProgress, BatchImportItem, ImportQueueItem } from '../shared/types/parallel-transcode'
import type {
  PinataConfig,
  PinataPinJob,
  PinataStats,
  RemotePin,
  RemotePinConfig,
  RemotePinOptions,
} from '../shared/types/remote-pinning'
import type { RankChangedEvent, UserReputation } from '../shared/types/reputation'
import type { DailyStats, StatsUpdatedEvent, UserStats } from '../shared/types/stats'
import type {
  CqSearchOptions,
  CqSearchProgress,
  CqSearchResult,
  SampleConfig,
  VmafOptions,
  VmafResult,
} from '../shared/types/vmaf'
import type { WebExportOptions, WebExportProgress, WebExportResult } from '../shared/types/web-player'
import type { RelatedAnimeData } from './ipc/franchise.handlers'
import type { ExportQueueResult, ExportQueueSettings, ExportTask, ExportTaskCreateData } from './services/export-queue'
import type { ExternalAudioScanResult } from './services/external-audio-scanner'
import type { ExternalSubtitleScanResult } from './services/external-subtitle-scanner'
import type { MobileServerStatus } from './services/mobile-server'
import type {
  ShikimoriAnimeDetails,
  ShikimoriAnimeExtended,
  ShikimoriAnimePreview,
  ShikimoriAnimeWithRelated,
  ShikimoriFranchiseGraph,
} from './services/shikimori'

// Реэкспорт типов для использования в других модулях
export type {
  AudioTranscodeOptions,
  AudioTranscodeVBROptions,
  DemuxOptions,
  DemuxResult,
  FileFilter,
  MediaInfo,
  MergeConfig,
  OperationResult,
  TranscodeProgress,
  VideoTranscodeOptions,
}

/**
 * API, доступный в renderer process через window.electronAPI
 */
const electronAPI = {
  // === Информация о приложении ===
  app: {
    /** Получить версию приложения */
    getVersion: async (): Promise<string> => {
      const result = await ipcRenderer.invoke('app:getVersion')
      return result.success ? result.data : ''
    },

    /** Получить системный путь */
    getPath: async (name: string): Promise<string> => {
      const result = await ipcRenderer.invoke('app:getPath', name)
      return result.success ? result.data : ''
    },

    /** Получить количество ядер CPU */
    getCpuCount: async (): Promise<number> => {
      const result = await ipcRenderer.invoke('app:getCpuCount')
      return result.success ? result.data : 1
    },

    /** Получить информацию о диске */
    getDiskInfo: async (
      targetPath?: string,
    ): Promise<{ total: number; free: number; used: number; usedPercent: number } | null> => {
      const result = await ipcRenderer.invoke('app:getDiskInfo', targetPath)
      return result.success ? result.data : null
    },

    /** Получить размер папки библиотеки (с кешированием, TTL 5 минут) */
    getLibrarySize: async (libraryPath: string, forceRefresh?: boolean): Promise<number> => {
      const result = await ipcRenderer.invoke('app:getLibrarySize', libraryPath, forceRefresh)
      return result.success ? result.data : 0
    },

    /** Инвалидировать кеш размера библиотеки (вызывать после импорта) */
    invalidateLibrarySizeCache: async (): Promise<boolean> => {
      const result = await ipcRenderer.invoke('app:invalidateLibrarySizeCache')
      return result.success ? result.data : false
    },

    /** Показать системное уведомление */
    showNotification: async (options: {
      title: string
      body: string
      type?: 'info' | 'success' | 'error'
    }): Promise<boolean> => {
      const result = await ipcRenderer.invoke('app:showNotification', options)
      return result.success ? result.data : false
    },

    /** Получить состояние блокировки сна */
    getPowerSaveState: async (): Promise<{
      isBlocking: boolean
      autoEnabled: boolean
      manualEnabled: boolean
    }> => {
      const result = await ipcRenderer.invoke('app:getPowerSaveState')
      return result.success ? result.data : { isBlocking: false, autoEnabled: true, manualEnabled: false }
    },

    /** Переключить ручную блокировку сна */
    togglePowerSaveManual: async (): Promise<{
      isBlocking: boolean
      manualEnabled: boolean
    }> => {
      const result = await ipcRenderer.invoke('app:togglePowerSaveManual')
      return result.success ? result.data : { isBlocking: false, manualEnabled: false }
    },

    /** Установить авто-блокировку при транскодировании */
    setPowerSaveAuto: async (enabled: boolean): Promise<{ autoEnabled: boolean }> => {
      const result = await ipcRenderer.invoke('app:setPowerSaveAuto', enabled)
      return result.success ? result.data : { autoEnabled: false }
    },

    /** Установить блокировку сна при воспроизведении видео */
    setPowerSavePlayback: async (isPlaying: boolean): Promise<{ isBlocking: boolean }> => {
      const result = await ipcRenderer.invoke('app:setPowerSavePlayback', isPlaying)
      return result.success ? result.data : { isBlocking: false }
    },
  },

  // === Управление окном (frameless title bar) ===
  window: {
    /** Минимизировать окно */
    minimize: async (): Promise<void> => {
      await ipcRenderer.invoke('window:minimize')
    },

    /** Максимизировать / Восстановить окно */
    maximize: async (): Promise<boolean> => {
      const result = await ipcRenderer.invoke('window:maximize')
      return result.success ? result.data : false
    },

    /** Закрыть окно */
    close: async (): Promise<void> => {
      await ipcRenderer.invoke('window:close')
    },

    /** Проверить, максимизировано ли окно */
    isMaximized: async (): Promise<boolean> => {
      const result = await ipcRenderer.invoke('window:isMaximized')
      return result.success ? result.data : false
    },

    /** Получить платформу (для позиционирования кнопок) */
    getPlatform: async (): Promise<'win32' | 'darwin' | 'linux'> => {
      const result = await ipcRenderer.invoke('window:getPlatform')
      return result.success ? result.data : 'win32'
    },

    /** Подписка на изменение состояния maximize */
    onMaximizeChanged: (callback: (isMaximized: boolean) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized)
      ipcRenderer.on('window:maximizeChanged', handler)
      return () => ipcRenderer.removeListener('window:maximizeChanged', handler)
    },
  },

  // === Диалоги ===
  dialog: {
    /** Открыть диалог выбора файла */
    selectFile: async (filters?: FileFilter[]): Promise<string | null> => {
      const result = await ipcRenderer.invoke('dialog:selectFile', filters)
      return result.success ? result.data : null
    },

    /** Открыть диалог выбора нескольких файлов */
    selectFiles: async (filters?: FileFilter[]): Promise<string[]> => {
      const result = await ipcRenderer.invoke('dialog:selectFiles', filters)
      return result.success ? result.data : []
    },

    /** Открыть диалог выбора папки */
    selectFolder: async (): Promise<string | null> => {
      const result = await ipcRenderer.invoke('dialog:selectFolder')
      return result.success ? result.data : null
    },

    /** Открыть диалог сохранения файла */
    saveFile: async (defaultName?: string, filters?: FileFilter[]): Promise<string | null> => {
      const result = await ipcRenderer.invoke('dialog:saveFile', defaultName, filters)
      return result.success ? result.data : null
    },
  },

  // === Файловая система ===
  fs: {
    /**
     * Получить путь к файлу из File объекта (для Drag & Drop)
     * В Electron с contextIsolation: true свойство file.path недоступно,
     * поэтому используем webUtils.getPathForFile()
     */
    getPathForFile: (file: File): string => webUtils.getPathForFile(file),

    /** Сканировать папку на медиафайлы (video, audio или оба) */
    scanFolder: (
      folderPath: string,
      recursive?: boolean,
      mediaTypes?: ('video' | 'audio')[],
    ): Promise<{ success: boolean; files: Array<{ path: string; name: string; size: number; extension: string }> }> =>
      ipcRenderer.invoke('fs:scanFolder', folderPath, recursive ?? true, mediaTypes ?? ['video']),

    /** Удалить файл или папку (по умолчанию в корзину) */
    delete: (targetPath: string, moveToTrash = true): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:delete', targetPath, moveToTrash),

    /** Проверить существование пути */
    exists: (targetPath: string): Promise<boolean> => ipcRenderer.invoke('fs:exists', targetPath),

    /** Получить информацию о файле (размер, дата модификации) */
    stat: async (filePath: string): Promise<{ size?: number; mtime?: Date; error?: string }> => {
      const result = await ipcRenderer.invoke('fs:stat', filePath)
      // createHandler оборачивает в { success, data }, разворачиваем
      if (result.success && result.data) {
        return { size: result.data.size, mtime: result.data.mtime }
      }
      return { error: result.error ?? 'Failed to get file stats' }
    },

    /** Копировать файл */
    copyFile: (sourcePath: string, destPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:copyFile', sourcePath, destPath),

    /** Сканировать внешние субтитры (папки Rus Sub/, Subs/ и т.д.) */
    scanExternalSubtitles: (
      videoFolderPath: string,
      videoFiles: Array<{ path: string; episodeNumber: number }>,
    ): Promise<ExternalSubtitleScanResult> =>
      ipcRenderer.invoke('fs:scanExternalSubtitles', videoFolderPath, videoFiles),

    /** Сканировать внешние аудио (папки Rus Sound/, Audio/ и т.д.) */
    scanExternalAudio: (
      videoFolderPath: string,
      videoFiles: Array<{ path: string; episodeNumber: number }>,
    ): Promise<ExternalAudioScanResult> => ipcRenderer.invoke('fs:scanExternalAudio', videoFolderPath, videoFiles),

    /** Получить метаданные изображения (размеры, blur placeholder) */
    getImageMetadata: (
      filePath: string,
    ): Promise<{
      success: boolean
      width?: number
      height?: number
      size?: number
      mimeType?: string
      blurDataURL?: string
      error?: string
    }> => ipcRenderer.invoke('fs:getImageMetadata', filePath),
  },

  // === Субтитры ===
  subtitle: {
    /** Сдвинуть таймкоды в файле субтитров (ASS/SRT) */
    shift: (options: {
      inputPath: string
      outputPath: string
      offsetMs: number
    }): Promise<{
      success: boolean
      removedEvents?: number
      totalEvents?: number
      error?: string
    }> => ipcRenderer.invoke('subtitle:shift', options),

    /** Предпросмотр сдвига — первые N событий с новыми таймкодами */
    previewShift: (
      inputPath: string,
      offsetMs: number,
      limit?: number,
    ): Promise<{
      events: Array<{ start: string; end: string; text: string }>
      total: number
      error?: string
    }> => ipcRenderer.invoke('subtitle:previewShift', inputPath, offsetMs, limit ?? 5),
  },

  // === Библиотека ===
  library: {
    /** Получить путь к библиотеке по умолчанию (Videos/Animatrona) */
    getDefaultPath: (): Promise<{ success: boolean; data?: string; error?: string }> =>
      ipcRenderer.invoke('library:getDefaultPath'),

    /** Получить путь к папке эпизода */
    resolveOutputPath: (options: {
      libraryPath: string
      animeName: string
      seasonNumber: number
      episodeNumber: number
    }): Promise<{ success: boolean; data?: string; error?: string }> =>
      ipcRenderer.invoke('library:resolveOutputPath', options),

    /** Создать структуру папок для эпизода */
    ensureEpisodeDirectory: (options: {
      libraryPath: string
      animeName: string
      seasonNumber: number
      episodeNumber: number
    }): Promise<{ success: boolean; data?: string; error?: string }> =>
      ipcRenderer.invoke('library:ensureEpisodeDirectory', options),

    /** Создать папку для аниме (для постера и других общих файлов) */
    ensureAnimeDirectory: (
      libraryPath: string,
      animeName: string,
    ): Promise<{ success: boolean; data?: string; error?: string }> =>
      ipcRenderer.invoke('library:ensureAnimeDirectory', libraryPath, animeName),
  },

  // === Shikimori API ===
  shikimori: {
    /** Поиск аниме по названию */
    search: (options: {
      search: string
      limit?: number
      kind?: string
    }): Promise<{
      success: boolean
      data?: ShikimoriAnimePreview[]
      error?: string
    }> => ipcRenderer.invoke('shikimori:search', options),

    /** Получить детали аниме по Shikimori ID */
    getDetails: (
      shikimoriId: number,
    ): Promise<{
      success: boolean
      data?: ShikimoriAnimeDetails
      error?: string
    }> => ipcRenderer.invoke('shikimori:getDetails', shikimoriId),

    /** Скачать постер и сохранить локально */
    downloadPoster: async (
      posterUrl: string,
      animeId: string,
      options?: { fileName?: string; savePath?: string },
    ): Promise<{
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
    }> => {
      const result = await ipcRenderer.invoke('shikimori:downloadPoster', posterUrl, animeId, options)
      // Разворачиваем data из createHandler
      // PosterDownloadResult уже содержит success, поэтому берём из data
      if (result.success && result.data) {
        return result.data
      }
      return { success: false, error: result.error }
    },

    /** Получить аниме со связанными */
    getWithRelated: (
      shikimoriId: number,
    ): Promise<{
      success: boolean
      data?: ShikimoriAnimeWithRelated
      error?: string
    }> => ipcRenderer.invoke('shikimori:getWithRelated', shikimoriId),

    /** Получить расширенные метаданные (v0.5.1) */
    getExtended: (
      shikimoriId: number,
    ): Promise<{
      success: boolean
      data?: ShikimoriAnimeExtended
      error?: string
    }> => ipcRenderer.invoke('shikimori:getExtended', shikimoriId),
  },

  // === Франшизы ===
  franchise: {
    /** Получить связанные аниме из Shikimori (GraphQL) */
    fetchRelated: (
      shikimoriId: number,
    ): Promise<{
      success: boolean
      data?: {
        sourceAnime: { shikimoriId: number; name: string }
        relatedAnimes: RelatedAnimeData[]
      }
      error?: string
    }> => ipcRenderer.invoke('franchise:fetchRelated', shikimoriId),

    /** Получить граф франшизы из REST API Shikimori */
    fetchGraph: (
      shikimoriId: number,
    ): Promise<{
      success: boolean
      data?: {
        graph: ShikimoriFranchiseGraph
        rootShikimoriId: number
        franchiseName: string
      } | null
      message?: string
      error?: string
    }> => ipcRenderer.invoke('franchise:fetchGraph', shikimoriId),

    /** Очистить кэш графов франшиз */
    clearCache: (): Promise<{
      success: boolean
      error?: string
    }> => ipcRenderer.invoke('franchise:clearCache'),
  },

  // === AnimeManifest (IPFS) ===
  animeManifest: {
    /** Генерировать манифест аниме и опубликовать в IPFS */
    generate: (
      input: GenerateAnimeManifestInput,
    ): Promise<{ success: boolean; data?: GenerateAnimeManifestResult; error?: string }> =>
      ipcRenderer.invoke('animeManifest:generate', input),

    /** Обновить манифест аниме и сохранить CID в БД */
    update: (animeId: string): Promise<{ success: boolean; data?: GenerateAnimeManifestResult; error?: string }> =>
      ipcRenderer.invoke('animeManifest:update', animeId),

    /** Получить манифест из IPFS по CID */
    get: (manifestCid: string): Promise<{ success: boolean; data?: AnimeManifest; error?: string }> =>
      ipcRenderer.invoke('animeManifest:get', manifestCid),

    /** Получить манифест аниме по ID аниме (из IPFS или сгенерировать) */
    getByAnimeId: (animeId: string): Promise<{ success: boolean; data?: AnimeManifest; error?: string }> =>
      ipcRenderer.invoke('animeManifest:getByAnimeId', animeId),

    /** Batch-генерация манифестов для нескольких аниме */
    generateBatch: (
      animeIds: string[],
    ): Promise<{
      success: boolean
      data?: { success: number; failed: number; errors: Array<{ animeId: string; error: string }> }
      error?: string
    }> => ipcRenderer.invoke('animeManifest:generateBatch', animeIds),

    /** Получить список аниме без manifestCid */
    getAnimesWithoutManifest: (): Promise<{
      success: boolean
      data?: Array<{ id: string; name: string }>
      error?: string
    }> => ipcRenderer.invoke('animeManifest:getAnimesWithoutManifest'),

    /** Импортировать аниме из IPFS манифеста */
    import: (
      manifestCid: string,
    ): Promise<{
      success: boolean
      data?: { animeId: string; animeName: string; episodeCount: number }
      error?: string
    }> => ipcRenderer.invoke('animeManifest:import', manifestCid),
  },

  // === Manifest ===
  manifest: {
    /** Сгенерировать манифест из результатов demux */
    generate: (
      demuxResult: DemuxResult,
      options: {
        episodeId: string
        videoPath: string
        outputDir: string
        animeInfo: {
          animeName: string
          seasonNumber: number
          episodeNumber: number
          episodeName?: string
        }
      },
    ): Promise<{
      success: boolean
      manifestPath?: string
      manifest?: EpisodeManifest
      error?: string
    }> => ipcRenderer.invoke('manifest:generate', demuxResult, options),

    /** Прочитать существующий манифест */
    read: (
      manifestPath: string,
    ): Promise<{
      success: boolean
      data?: EpisodeManifest
      error?: string
    }> => ipcRenderer.invoke('manifest:read', manifestPath),

    /** Обновить навигацию в манифесте */
    updateNavigation: (
      manifestPath: string,
      navigation: {
        nextEpisode?: { id: string; manifestPath: string }
        prevEpisode?: { id: string; manifestPath: string }
      },
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('manifest:updateNavigation', manifestPath, navigation),

    /** Обновить thumbnails в манифесте (с CID для IPFS) */
    updateThumbnails: (
      manifestPath: string,
      thumbnails: {
        vttCid: string
        spriteCid: string
      },
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('manifest:updateThumbnails', manifestPath, thumbnails),

    /** Batch-обновление навигации между эпизодами через IPFS */
    updateNavigationBatch: (
      episodes: Array<{ id: string; manifestCid: string }>,
    ): Promise<{ success: boolean; data?: Record<string, string>; error?: string }> =>
      ipcRenderer.invoke('manifest:updateNavigationBatch', episodes),

    /** Обновить информацию о кодировании в манифесте */
    updateEncoding: (
      manifestPath: string,
      encoding: {
        profileName: string
        codec: string
        cq: number
        preset: string
        rateControl: string
        tune?: string
        multipass?: string
        spatialAq?: boolean
        temporalAq?: boolean
        aqStrength?: number
        gopSize?: number
        lookahead?: number
        bRefMode?: string
        force10Bit?: boolean
        vmafScore?: number
        encoderType: 'gpu' | 'cpu'
        hardwareModel?: string
        ffmpegVersion?: string
        ffmpegCommand?: string
        transcodeDurationMs?: number
        activeGpuWorkers?: number
        videoMaxConcurrent?: number
        audioMaxConcurrent?: number
        sourceSize?: number
        transcodedSize?: number
        compressionRatio?: number
      },
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('manifest:updateEncoding', manifestPath, encoding),
  },

  // === FFmpeg ===
  ffmpeg: {
    /** Анализ медиафайла */
    probe: (filePath: string): Promise<OperationResult & { data?: MediaInfo }> =>
      ipcRenderer.invoke('ffmpeg:probe', filePath),

    /** Транскодирование видео */
    transcodeVideo: (input: string, output: string, options: VideoTranscodeOptions): Promise<OperationResult> =>
      ipcRenderer.invoke('ffmpeg:transcodeVideo', input, output, options),

    /** Транскодирование аудио */
    transcodeAudio: (input: string, output: string, options: AudioTranscodeOptions): Promise<OperationResult> =>
      ipcRenderer.invoke('ffmpeg:transcodeAudio', input, output, options),

    /** Мерж в MKV */
    merge: (config: MergeConfig): Promise<OperationResult & { outputPath?: string }> =>
      ipcRenderer.invoke('ffmpeg:merge', config),

    /** Демультиплексирование (извлечение потоков без перекодирования) */
    demux: (inputPath: string, outputDir: string, options?: DemuxOptions): Promise<DemuxResult> =>
      ipcRenderer.invoke('ffmpeg:demux', inputPath, outputDir, options),

    /** Транскодирование аудио VBR (умный подбор битрейта) */
    transcodeAudioVBR: (
      input: string,
      output: string,
      options: AudioTranscodeVBROptions,
    ): Promise<OperationResult & { outputPath?: string }> =>
      ipcRenderer.invoke('ffmpeg:transcodeAudioVBR', input, output, options),

    /** Кодирование тестового сэмпла */
    encodeSample: (options: {
      inputPath: string
      outputPath: string
      profile: unknown
      startTime?: number
      duration?: number
      sourceBitDepth?: number
    }): Promise<{ success: boolean; outputPath: string; encodingTime: number; outputSize: number; error?: string }> =>
      ipcRenderer.invoke('ffmpeg:encodeSample', options),

    /** Генерация скриншотов из видео */
    generateScreenshots: async (
      inputPath: string,
      outputDir: string,
      duration: number,
      options: {
        count: number
        format?: 'webp' | 'jpg' | 'png'
        thumbnailWidth?: number
        fullWidth?: number
        quality?: number
        skipStartPercent?: number
      },
    ): Promise<{
      success: boolean
      thumbnails: string[]
      fullSize: string[]
      error?: string
    }> => {
      const result = await ipcRenderer.invoke('ffmpeg:generateScreenshots', inputPath, outputDir, duration, options)
      // Разворачиваем data из createHandler
      if (result.success && result.data) {
        return { success: true, thumbnails: result.data.thumbnails, fullSize: result.data.fullSize }
      }
      return { success: false, thumbnails: [], fullSize: [], error: result.error }
    },

    /** Генерация thumbnail sprite sheet для hover preview */
    generateThumbnailSprite: async (
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
    ): Promise<{
      success: boolean
      spritePath: string
      vttPath: string
      spriteSize: number
      error?: string
    }> => {
      const result = await ipcRenderer.invoke('ffmpeg:generateThumbnailSprite', inputPath, outputDir, duration, options)
      // Разворачиваем data из createHandler
      if (result.success && result.data) {
        return {
          success: true,
          spritePath: result.data.spritePath,
          vttPath: result.data.vttPath,
          spriteSize: result.data.spriteSize,
        }
      }
      return { success: false, spritePath: '', vttPath: '', spriteSize: 0, error: result.error }
    },

    /** Подписка на прогресс FFmpeg операций */
    onProgress: (
      callback: (data: TranscodeProgress & { type: string; profileName?: string }) => void,
    ): () => void => {
      const handler = (_event: unknown, data: TranscodeProgress & { type: string; profileName?: string }) =>
        callback(data)
      ipcRenderer.on('ffmpeg:progress', handler)
      return () => ipcRenderer.removeListener('ffmpeg:progress', handler)
    },

    /** Получить версию FFmpeg */
    getVersion: (): Promise<OperationResult & { data?: string }> => ipcRenderer.invoke('ffmpeg:getVersion'),

    /** Получить информацию об оборудовании (GPU и CPU) */
    getHardwareInfo: (): Promise<OperationResult & { data?: { gpuModel: string | null; cpuModel: string } }> =>
      ipcRenderer.invoke('ffmpeg:getHardwareInfo'),
  },

  // === Очередь транскодирования ===
  transcode: {
    /** Добавить файл в очередь */
    addToQueue: (
      filePath: string,
      settings?: PerFileTranscodeSettings,
    ): Promise<{ success: boolean; id?: string; error?: string }> =>
      ipcRenderer.invoke('transcode:addToQueue', filePath, settings),

    /** Удалить из очереди */
    removeFromQueue: (id: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('transcode:removeFromQueue', id),

    /** Начать обработку очереди */
    start: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('transcode:start'),

    /** Приостановить элемент */
    pauseItem: (id: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('transcode:pauseItem', id),

    /** Возобновить элемент */
    resumeItem: (id: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('transcode:resumeItem', id),

    /** Отменить элемент */
    cancelItem: (id: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('transcode:cancelItem', id),

    /** Изменить порядок очереди */
    reorderQueue: (orderedIds: string[]): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('transcode:reorderQueue', orderedIds),

    /** Обновить настройки элемента */
    updateSettings: (id: string, settings: PerFileTranscodeSettings): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('transcode:updateSettings', id, settings),

    /** Получить текущую очередь */
    getQueue: (): Promise<{ success: boolean; queue: QueueItem[]; error?: string }> =>
      ipcRenderer.invoke('transcode:getQueue'),

    /** Получить элемент по ID */
    getItem: (id: string): Promise<{ success: boolean; item?: QueueItem; error?: string }> =>
      ipcRenderer.invoke('transcode:getItem', id),

    /** Анализировать элемент */
    analyzeItem: (id: string, demuxResult: DemuxResult): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('transcode:analyzeItem', id, demuxResult),

    /** Проверить возможность паузы */
    getPauseCapabilities: (): Promise<{
      success: boolean
      available: boolean
      method: 'signals' | 'pssuspend' | 'none'
      message?: string
      error?: string
    }> => ipcRenderer.invoke('transcode:getPauseCapabilities'),

    /** Приостановить всю обработку */
    pauseAll: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('transcode:pauseAll'),

    /** Возобновить всю обработку */
    resumeAll: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('transcode:resumeAll'),

    /** Установить путь к библиотеке */
    setLibraryPath: (libraryPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('transcode:setLibraryPath', libraryPath),

    /** Подписка на прогресс элемента */
    onProgress: (callback: (id: string, progress: TranscodeProgressExtended) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, progress: TranscodeProgressExtended) =>
        callback(id, progress)
      ipcRenderer.on('transcode:progress', handler)
      return () => ipcRenderer.removeListener('transcode:progress', handler)
    },

    /** Подписка на изменение статуса */
    onStatusChange: (callback: (id: string, status: QueueItemStatus, error?: string) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, status: QueueItemStatus, error?: string) =>
        callback(id, status, error)
      ipcRenderer.on('transcode:statusChange', handler)
      return () => ipcRenderer.removeListener('transcode:statusChange', handler)
    },

    /** Подписка на изменение очереди */
    onQueueChange: (callback: (queue: QueueItem[]) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, queue: QueueItem[]) => callback(queue)
      ipcRenderer.on('transcode:queueChange', handler)
      return () => ipcRenderer.removeListener('transcode:queueChange', handler)
    },

    /** Подписка на начало обработки */
    onProcessingStarted: (callback: () => void): () => void => {
      const handler = () => callback()
      ipcRenderer.on('transcode:processingStarted', handler)
      return () => ipcRenderer.removeListener('transcode:processingStarted', handler)
    },

    /** Подписка на завершение обработки */
    onProcessingCompleted: (callback: () => void): () => void => {
      const handler = () => callback()
      ipcRenderer.on('transcode:processingCompleted', handler)
      return () => ipcRenderer.removeListener('transcode:processingCompleted', handler)
    },
  },

  // === Параллельное транскодирование (Dual Encoders + CPU Audio) ===
  parallelTranscode: {
    /** Добавить batch эпизодов для обработки (legacy без batchId) */
    addBatch: (items: BatchImportItem[]): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:addBatch', items),

    /** Добавить batch эпизодов для обработки с batchId */
    addBatchWithId: (items: BatchImportItem[], batchId?: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:addBatchWithId', { items, batchId }),

    /** Начать новый batch с полным сбросом состояния */
    startNewBatch: (items: BatchImportItem[], batchId?: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:startNewBatch', { items, batchId }),

    /** Получить текущий batch ID */
    getCurrentBatchId: (): Promise<{ success: boolean; data?: string | null; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:getCurrentBatchId'),

    /** Получить текущие лимиты параллельности */
    getConcurrencyLimits: (): Promise<{
      success: boolean
      data?: { videoMaxConcurrent: number; audioMaxConcurrent: number }
      error?: string
    }> => ipcRenderer.invoke('parallelTranscode:getConcurrencyLimits'),

    /** Установить максимальное количество параллельных аудио-задач */
    setAudioMaxConcurrent: (value: number): Promise<{ success: boolean; value?: number; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:setAudioMaxConcurrent', value),

    /** Установить максимальное количество параллельных видео-задач */
    setVideoMaxConcurrent: (value: number): Promise<{ success: boolean; value?: number; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:setVideoMaxConcurrent', value),

    /** Добавить один элемент */
    addItem: (item: BatchImportItem): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:addItem', item),

    /** Получить агрегированный прогресс */
    getProgress: (): Promise<{ success: boolean; progress: AggregatedProgress | null; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:getProgress'),

    /** Получить элемент по ID */
    getItem: (itemId: string): Promise<{ success: boolean; item: ImportQueueItem | null; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:getItem', itemId),

    /** Получить все элементы */
    getItems: (): Promise<{ success: boolean; items: ImportQueueItem[]; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:getItems'),

    /** Проверить, идёт ли обработка */
    isProcessing: (): Promise<{ success: boolean; processing: boolean; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:isProcessing'),

    /** Приостановить всё */
    pause: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('parallelTranscode:pause'),

    /** Возобновить всё */
    resume: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('parallelTranscode:resume'),

    /** Отменить элемент */
    cancelItem: (itemId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:cancelItem', itemId),

    /** Отменить всё */
    cancelAll: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('parallelTranscode:cancelAll'),

    /** Очистить завершённые */
    clearCompleted: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:clearCompleted'),

    // === Подписки на события ===

    /** Подписка на агрегированный прогресс */
    onAggregatedProgress: (callback: (progress: AggregatedProgress) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, progress: AggregatedProgress) => callback(progress)
      ipcRenderer.on('parallelTranscode:aggregatedProgress', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:aggregatedProgress', handler)
    },

    /** Подписка на прогресс видео */
    onVideoProgress: (callback: (taskId: string, progress: TranscodeProgressExtended) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, taskId: string, progress: TranscodeProgressExtended) =>
        callback(taskId, progress)
      ipcRenderer.on('parallelTranscode:videoProgress', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:videoProgress', handler)
    },

    /** Подписка на прогресс аудио */
    onAudioProgress: (callback: (taskId: string, progress: TranscodeProgressExtended) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, taskId: string, progress: TranscodeProgressExtended) =>
        callback(taskId, progress)
      ipcRenderer.on('parallelTranscode:audioProgress', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:audioProgress', handler)
    },

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
    ): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        itemId: string,
        episodeId: string,
        outputPath: string,
        meta?: {
          ffmpegCommand?: string
          transcodeDurationMs?: number
          activeGpuWorkers?: number
        },
      ) => callback(itemId, episodeId, outputPath, meta)
      ipcRenderer.on('parallelTranscode:videoCompleted', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:videoCompleted', handler)
    },

    /** Подписка на завершение аудиодорожки */
    onAudioTrackCompleted: (
      callback: (
        trackId: string,
        outputPath: string,
        episodeId: string,
        passthrough?: boolean,
        originalCodec?: string,
      ) => void,
    ): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        trackId: string,
        outputPath: string,
        episodeId: string,
        passthrough?: boolean,
        originalCodec?: string,
      ) => callback(trackId, outputPath, episodeId, passthrough, originalCodec)
      ipcRenderer.on('parallelTranscode:audioTrackCompleted', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:audioTrackCompleted', handler)
    },

    /** Подписка на завершение элемента (видео + все аудио готовы) */
    onItemCompleted: (
      callback: (itemId: string, episodeId: string, success: boolean, errorMessage?: string) => void,
    ): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        itemId: string,
        episodeId: string,
        success: boolean,
        errorMessage?: string,
      ) => callback(itemId, episodeId, success, errorMessage)
      ipcRenderer.on('parallelTranscode:itemCompleted', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:itemCompleted', handler)
    },

    /** Подписка на ошибку батча */
    onBatchError: (callback: (error: string) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error)
      ipcRenderer.on('parallelTranscode:batchError', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:batchError', handler)
    },

    /** Подписка на добавление элемента */
    onItemAdded: (callback: (itemId: string, episodeId: string) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, itemId: string, episodeId: string) =>
        callback(itemId, episodeId)
      ipcRenderer.on('parallelTranscode:itemAdded', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:itemAdded', handler)
    },

    /** Подписка на ошибку элемента */
    onItemError: (callback: (itemId: string, episodeId: string, error: string) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, itemId: string, episodeId: string, error: string) =>
        callback(itemId, episodeId, error)
      ipcRenderer.on('parallelTranscode:itemError', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:itemError', handler)
    },

    /** Подписка на ошибку задачи */
    onTaskError: (callback: (taskId: string, type: 'video' | 'audio', error: string) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, taskId: string, type: 'video' | 'audio', error: string) =>
        callback(taskId, type, error)
      ipcRenderer.on('parallelTranscode:taskError', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:taskError', handler)
    },

    /** Подписка на паузу */
    onPaused: (callback: () => void): () => void => {
      const handler = () => callback()
      ipcRenderer.on('parallelTranscode:paused', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:paused', handler)
    },

    /** Подписка на возобновление */
    onResumed: (callback: () => void): () => void => {
      const handler = () => callback()
      ipcRenderer.on('parallelTranscode:resumed', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:resumed', handler)
    },

    /** Подписка на завершение batch */
    onBatchCompleted: (callback: (batchId: string, success: boolean) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, batchId: string, success: boolean) =>
        callback(batchId, success)
      ipcRenderer.on('parallelTranscode:batchCompleted', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:batchCompleted', handler)
    },

    // === VMAF прогресс (сохраняется в main для навигации) ===

    /** Получить VMAF прогресс для item */
    getVmafProgress: (itemId?: string): Promise<{ success: boolean; data?: unknown; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:getVmafProgress', itemId),

    /** Получить все VMAF прогрессы */
    getAllVmafProgress: (): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:getAllVmafProgress'),

    /** Подписка на VMAF прогресс */
    onVmafProgress: (callback: (itemId: string, progress: unknown) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, itemId: string, progress: unknown) =>
        callback(itemId, progress)
      ipcRenderer.on('parallelTranscode:vmafProgress', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:vmafProgress', handler)
    },

    // === Защита от дублирования обработки ===

    /** Проверить, обрабатывается ли item */
    isItemProcessing: (itemId?: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:isItemProcessing', itemId),

    /** Установить текущий обрабатываемый item (защита от дублей) */
    setProcessingItem: (itemId: string | null): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:setProcessingItem', itemId),

    /** Получить ID текущего обрабатываемого item */
    getProcessingItemId: (): Promise<{ success: boolean; data?: string | null; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:getProcessingItemId'),

    // === FFmpeg Log Viewer ===

    /** Получить все видео-логи */
    getVideoLogs: (): Promise<{
      success: boolean
      data?: Array<{ timestamp: number; taskId: string; level: 'info' | 'warning' | 'error'; message: string }>
      error?: string
    }> => ipcRenderer.invoke('parallelTranscode:getVideoLogs'),

    /** Получить логи конкретной видео-задачи */
    getVideoTaskLogs: (
      taskId: string,
    ): Promise<{
      success: boolean
      data?: Array<{ timestamp: number; taskId: string; level: 'info' | 'warning' | 'error'; message: string }>
      error?: string
    }> => ipcRenderer.invoke('parallelTranscode:getVideoTaskLogs', taskId),

    /** Очистить все видео-логи */
    clearVideoLogs: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:clearVideoLogs'),

    /** Получить количество записей в видео-логах */
    getVideoLogCount: (): Promise<{ success: boolean; data?: number; error?: string }> =>
      ipcRenderer.invoke('parallelTranscode:getVideoLogCount'),

    /** Подписка на новые записи логов (real-time) */
    onVideoLogEntry: (
      callback: (
        taskId: string,
        entry: { timestamp: number; level: 'info' | 'warning' | 'error'; message: string },
      ) => void,
    ): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        taskId: string,
        entry: { timestamp: number; level: 'info' | 'warning' | 'error'; message: string },
      ) => callback(taskId, entry)
      ipcRenderer.on('parallelTranscode:videoLogEntry', handler)
      return () => ipcRenderer.removeListener('parallelTranscode:videoLogEntry', handler)
    },
  },

  // === Системный трей ===
  tray: {
    /** Получить текущие настройки трея */
    getSettings: (): Promise<{ minimizeToTray: boolean; closeToTray: boolean; showTrayNotification: boolean }> =>
      ipcRenderer.invoke('tray:getSettings'),

    /** Обновить настройки трея */
    updateSettings: (settings: {
      minimizeToTray?: boolean
      closeToTray?: boolean
      showTrayNotification?: boolean
    }): Promise<void> => ipcRenderer.invoke('tray:updateSettings', settings),

    /** Подписка на изменение настроек трея из main process (например, из контекстного меню) */
    onSettingsChanged: (
      callback: (settings: { minimizeToTray: boolean; closeToTray: boolean; showTrayNotification: boolean }) => void,
    ): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        settings: { minimizeToTray: boolean; closeToTray: boolean; showTrayNotification: boolean },
      ) => callback(settings)
      ipcRenderer.on('tray:settingsChanged', handler)
      return () => ipcRenderer.removeListener('tray:settingsChanged', handler)
    },
  },

  // === VMAF автоподбор качества ===
  vmaf: {
    /** Расчёт VMAF между двумя видео */
    calculate: (
      encoded: string,
      original: string,
      options?: VmafOptions,
    ): Promise<{ success: boolean; data?: VmafResult; error?: string }> =>
      ipcRenderer.invoke('vmaf:calculate', encoded, original, options),

    /** Пакетный расчёт VMAF для нескольких пар */
    calculateBatch: (
      pairs: Array<[string, string]>,
      options?: VmafOptions,
    ): Promise<{ success: boolean; data?: VmafResult[]; error?: string }> =>
      ipcRenderer.invoke('vmaf:calculateBatch', pairs, options),

    /**
     * Поиск оптимального CQ для целевого VMAF
     *
     * @param itemId Опциональный ID элемента очереди для сохранения прогресса в main process
     *               При передаче itemId прогресс сохраняется и переживает навигацию
     */
    findOptimalCQ: (
      inputPath: string,
      videoOptions: Omit<VideoTranscodeOptions, 'cq'>,
      options?: Partial<CqSearchOptions>,
      preferCpu?: boolean,
      itemId?: string,
    ): Promise<{ success: boolean; data?: CqSearchResult; error?: string }> =>
      ipcRenderer.invoke('vmaf:findOptimalCQ', inputPath, videoOptions, options, preferCpu ?? false, itemId),

    /** Извлечение сэмплов из видео */
    extractSamples: (
      inputPath: string,
      outputDir: string,
      config?: Partial<SampleConfig>,
    ): Promise<{ success: boolean; data?: string[]; error?: string }> =>
      ipcRenderer.invoke('vmaf:extractSamples', inputPath, outputDir, config),

    /** Очистка временных файлов сэмплов */
    cleanup: (sampleDir: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('vmaf:cleanup', sampleDir),

    /** Подписка на прогресс поиска CQ */
    onProgress: (callback: (progress: CqSearchProgress) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, progress: CqSearchProgress) => callback(progress)
      ipcRenderer.on('vmaf:progress', handler)
      return () => ipcRenderer.removeListener('vmaf:progress', handler)
    },
  },

  // === Import Queue — Event-driven архитектура ===
  importQueue: {
    // === Команды ===

    /** Добавить items в очередь */
    addItems: (items: ImportQueueAddData[]): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('import-queue:add-items', items),

    /** Начать обработку очереди */
    start: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('import-queue:start'),

    /** Приостановить очередь */
    pause: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('import-queue:pause'),

    /** Возобновить очередь */
    resume: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('import-queue:resume'),

    /** Отменить item */
    cancelItem: (itemId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('import-queue:cancel-item', itemId),

    /** Удалить item из очереди */
    removeItem: (itemId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('import-queue:remove-item', itemId),

    /** Повторить обработку item с ошибкой */
    retryItem: (itemId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('import-queue:retry-item', itemId),

    /** Отменить всю очередь */
    cancelAll: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('import-queue:cancel-all'),

    /** Получить текущее состояние очереди */
    getState: (): Promise<{ success: boolean; data?: ImportQueueState; error?: string }> =>
      ipcRenderer.invoke('import-queue:get-state'),

    /** Получить item по ID */
    getItem: (itemId: string): Promise<{ success: boolean; data?: ImportQueueEntry; error?: string }> =>
      ipcRenderer.invoke('import-queue:get-item', itemId),

    /** Очистить завершённые items */
    clearCompleted: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('import-queue:clear-completed'),

    /** Установить автозапуск */
    setAutoStart: (enabled: boolean): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('import-queue:set-auto-start', enabled),

    /** Изменить порядок элементов (drag & drop) */
    reorderItems: (activeId: string, overId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('import-queue:reorder-items', activeId, overId),

    /** Обновить данные item (профиль, параллельность, sync offset и т.д.) */
    updateItem: (itemId: string, data: Partial<ImportQueueAddData>): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('import-queue:update-item', itemId, data),

    // === Обновления от renderer (ImportProcessor) ===

    /** Обновить статус item */
    updateStatus: (
      itemId: string,
      status: ImportQueueStatus,
      error?: string,
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('import-queue:update-status', itemId, status, error),

    /** Обновить прогресс item */
    updateProgress: (
      itemId: string,
      progress: number,
      currentFileName?: string,
      currentStage?: string,
      detailProgress?: ImportQueueDetailProgress,
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(
        'import-queue:update-progress',
        itemId,
        progress,
        currentFileName,
        currentStage,
        detailProgress,
      ),

    /** Обновить VMAF прогресс */
    updateVmafProgress: (
      itemId: string,
      vmafProgress: ImportQueueVmafProgress,
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('import-queue:update-vmaf-progress', itemId, vmafProgress),

    /** Установить результат VMAF */
    setVmafResult: (itemId: string, result: ImportQueueVmafResult): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('import-queue:set-vmaf-result', itemId, result),

    /** Установить результат импорта (animeId) */
    setImportResult: (itemId: string, animeId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('import-queue:set-import-result', itemId, animeId),

    // === Подписки на события (main → renderer) ===

    /** Подписка на изменение состояния очереди */
    onStateChanged: (callback: (state: ImportQueueState) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, state: ImportQueueState) => callback(state)
      ipcRenderer.on('import-queue:state-changed', handler)
      return () => ipcRenderer.removeListener('import-queue:state-changed', handler)
    },

    /** Подписка на изменение статуса item */
    onItemStatus: (
      callback: (data: { itemId: string; status: ImportQueueStatus; error?: string }) => void,
    ): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { itemId: string; status: ImportQueueStatus; error?: string },
      ) => callback(data)
      ipcRenderer.on('import-queue:item-status', handler)
      return () => ipcRenderer.removeListener('import-queue:item-status', handler)
    },

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
    ): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: {
          itemId: string
          progress: number
          currentFileName?: string
          currentStage?: string
          detailProgress?: ImportQueueDetailProgress
          vmafProgress?: ImportQueueVmafProgress
        },
      ) => callback(data)
      ipcRenderer.on('import-queue:item-progress', handler)
      return () => ipcRenderer.removeListener('import-queue:item-progress', handler)
    },
  },

  // === Шаблоны импорта ===
  templates: {
    /** Получить все шаблоны (дефолтные + пользовательские) */
    getAll: (): Promise<{ success: boolean; data?: ImportTemplate[]; error?: string }> =>
      ipcRenderer.invoke('templates:getAll'),

    /** Получить шаблон по ID */
    getById: (id: string): Promise<{ success: boolean; data?: ImportTemplate; error?: string }> =>
      ipcRenderer.invoke('templates:getById', id),

    /** Создать шаблон */
    create: (data: ImportTemplateCreateData): Promise<{ success: boolean; data?: ImportTemplate; error?: string }> =>
      ipcRenderer.invoke('templates:create', data),

    /** Обновить шаблон */
    update: (
      id: string,
      data: ImportTemplateUpdateData,
    ): Promise<{ success: boolean; data?: ImportTemplate; error?: string }> =>
      ipcRenderer.invoke('templates:update', id, data),

    /** Удалить шаблон */
    delete: (id: string): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('templates:delete', id),

    /** Отметить шаблон как использованный */
    markAsUsed: (id: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('templates:markAsUsed', id),
  },

  // === История импортов ===
  history: {
    /** Получить все записи истории */
    getAll: (): Promise<{ success: boolean; data?: ImportHistoryEntry[]; error?: string }> =>
      ipcRenderer.invoke('history:getAll'),

    /** Получить записи с фильтром */
    get: (filter?: ImportHistoryFilter): Promise<{ success: boolean; data?: ImportHistoryEntry[]; error?: string }> =>
      ipcRenderer.invoke('history:get', filter),

    /** Получить запись по ID */
    getById: (id: string): Promise<{ success: boolean; data?: ImportHistoryEntry; error?: string }> =>
      ipcRenderer.invoke('history:getById', id),

    /** Добавить запись в историю */
    add: (data: ImportHistoryCreateData): Promise<{ success: boolean; data?: ImportHistoryEntry; error?: string }> =>
      ipcRenderer.invoke('history:add', data),

    /** Удалить запись */
    delete: (id: string): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('history:delete', id),

    /** Очистить историю */
    clear: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('history:clear'),

    /** Получить статистику */
    getStats: (): Promise<{ success: boolean; data?: ImportHistoryStats; error?: string }> =>
      ipcRenderer.invoke('history:getStats'),

    /** Получить последние N записей */
    getRecent: (limit?: number): Promise<{ success: boolean; data?: ImportHistoryEntry[]; error?: string }> =>
      ipcRenderer.invoke('history:getRecent', limit),
  },

  // === События (legacy) ===
  on: {
    /** Подписка на прогресс транскодирования (legacy) */
    transcodeProgress: (callback: (progress: TranscodeProgress & { type: string }) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, progress: TranscodeProgress & { type: string }) =>
        callback(progress)
      ipcRenderer.on('ffmpeg:progress', handler)
      return () => ipcRenderer.removeListener('ffmpeg:progress', handler)
    },
  },

  // === Backup/Restore — РЕЛИЗНЫЕ ДАННЫЕ ===
  backup: {
    /** Записать anime.meta.json (только релизные данные) */
    writeAnimeMeta: (params: {
      animeFolder: string
      shikimoriId: number | null
      isBdRemux: boolean
      fallbackInfo: { name: string; originalName?: string; year?: number }
    }): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('backup:writeAnimeMeta', params),

    /** Обновить anime.meta.json (частичное обновление) */
    updateAnimeMeta: (
      animeFolder: string,
      updates: {
        shikimoriId?: number | null
        isBdRemux?: boolean
        fallbackInfo?: { name: string; originalName?: string; year?: number }
      },
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('backup:updateAnimeMeta', animeFolder, updates),

    /** Прочитать anime.meta.json */
    readAnimeMeta: (
      animeFolder: string,
    ): Promise<{
      success: boolean
      data?: {
        version: 1
        shikimoriId: number | null
        isBdRemux: boolean
        fallbackInfo: { name: string; originalName?: string; year?: number }
        createdAt: string
      } | null
      error?: string
    }> => ipcRenderer.invoke('backup:readAnimeMeta', animeFolder),

    /** Проверить существование anime.meta.json */
    hasAnimeMeta: (animeFolder: string): Promise<{ success: boolean; exists?: boolean; error?: string }> =>
      ipcRenderer.invoke('backup:hasAnimeMeta', animeFolder),

    /** Удалить anime.meta.json */
    deleteAnimeMeta: (animeFolder: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('backup:deleteAnimeMeta', animeFolder),

    /** Быстрое сканирование библиотеки — только статистика */
    quickScanLibrary: (
      libraryPath: string,
    ): Promise<{
      success: boolean
      stats?: {
        totalAnimes: number
        totalEpisodes: number
        withShikimoriId: number
      }
      error?: string
    }> => ipcRenderer.invoke('backup:quickScanLibrary', libraryPath),

    /** Полное сканирование библиотеки для восстановления */
    scanLibraryForRestore: (
      libraryPath: string,
      loadShikimori?: boolean,
    ): Promise<{
      success: boolean
      animes: unknown[]
      stats: {
        totalAnimes: number
        totalEpisodes: number
        withShikimoriId: number
      }
      warnings: string[]
      error?: string
    }> => ipcRenderer.invoke('backup:scanLibraryForRestore', libraryPath, loadShikimori),
  },

  // === User Data — ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ В _user/ ===
  userData: {
    /** Инициализировать папку _user/ */
    init: (libraryPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('userData:init', libraryPath),

    /** Обновить статус просмотра аниме */
    updateWatchStatus: (
      libraryPath: string,
      animeFolderPath: string,
      watchStatus: 'NOT_STARTED' | 'WATCHING' | 'COMPLETED' | 'ON_HOLD' | 'DROPPED' | 'PLANNED',
      watchedAt?: string | null,
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('userData:updateWatchStatus', libraryPath, animeFolderPath, watchStatus, watchedAt),

    /** Обновить оценку аниме */
    updateUserRating: (
      libraryPath: string,
      animeFolderPath: string,
      userRating: number | null,
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('userData:updateUserRating', libraryPath, animeFolderPath, userRating),

    /** Обновить предпочтения дорожек */
    updateTrackPreferences: (
      libraryPath: string,
      animeFolderPath: string,
      trackPreferences: {
        audioLanguage?: string
        audioDubGroup?: string
        subtitleLanguage?: string
        subtitleDubGroup?: string
      },
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('userData:updateTrackPreferences', libraryPath, animeFolderPath, trackPreferences),

    /** Обновить прогресс эпизода */
    updateEpisodeProgress: (params: {
      libraryPath: string
      animeFolderPath: string
      episodeFolderPath: string
      currentTime: number
      completed: boolean
      volume?: number
      selectedAudio: { dubGroup?: string; language?: string } | null
      selectedSubtitle: { dubGroup?: string; language?: string } | null
    }): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('userData:updateEpisodeProgress', params),

    /** Прочитать прогресс эпизода */
    readEpisodeProgress: (
      libraryPath: string,
      animeFolderPath: string,
      episodeFolderPath: string,
    ): Promise<{
      success: boolean
      data?: {
        currentTime: number
        completed: boolean
        volume?: number
        lastWatchedAt: string
        selectedAudio: { dubGroup?: string; language?: string } | null
        selectedSubtitle: { dubGroup?: string; language?: string } | null
      } | null
      error?: string
    }> => ipcRenderer.invoke('userData:readEpisodeProgress', libraryPath, animeFolderPath, episodeFolderPath),

    /** Прочитать данные аниме пользователя */
    readAnimeData: (
      libraryPath: string,
      animeFolderPath: string,
    ): Promise<{
      success: boolean
      data?: {
        version: 1
        identifier: { folderHash: string; relativePath: string }
        watchStatus: string
        userRating: number | null
        watchedAt: string | null
        trackPreferences: Record<string, string | undefined>
        episodes: Record<string, unknown>
        createdAt: string
        updatedAt: string
      } | null
      error?: string
    }> => ipcRenderer.invoke('userData:readAnimeData', libraryPath, animeFolderPath),

    /** Удалить прогресс эпизода */
    deleteEpisodeProgress: (
      libraryPath: string,
      animeFolderPath: string,
      episodeFolderPath: string,
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('userData:deleteEpisodeProgress', libraryPath, animeFolderPath, episodeFolderPath),

    /** Удалить все данные аниме */
    deleteAnimeData: (libraryPath: string, animeFolderPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('userData:deleteAnimeData', libraryPath, animeFolderPath),

    /** Прочитать индекс _user/ */
    readIndex: (libraryPath: string): Promise<{ success: boolean; data?: unknown; error?: string }> =>
      ipcRenderer.invoke('userData:readIndex', libraryPath),

    /** Экспортировать все пользовательские данные */
    exportAll: (libraryPath: string): Promise<{ success: boolean; data?: unknown; error?: string }> =>
      ipcRenderer.invoke('userData:exportAll', libraryPath),
  },

  // === Автообновления ===
  updater: {
    /** Проверить наличие обновлений */
    check: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('updater:check'),

    /** Скачать обновление */
    download: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('updater:download'),

    /** Установить обновление и перезапустить */
    install: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('updater:install'),

    /** Получить текущий статус обновления */
    getStatus: async (): Promise<{
      status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
      updateInfo: { version: string; releaseDate: string; releaseNotes?: string } | null
      downloadProgress: number
      error: string | null
      downloadSpeed: number
      downloadEta: number
    }> => {
      const result = await ipcRenderer.invoke('updater:status')
      return result.success
        ? result.data
        : { status: 'idle', updateInfo: null, downloadProgress: 0, error: null, downloadSpeed: 0, downloadEta: 0 }
    },

    /** Получить версию приложения */
    getVersion: async (): Promise<string> => {
      const result = await ipcRenderer.invoke('updater:version')
      return result.success ? result.data : ''
    },

    /** Получить changelog из GitHub Releases */
    getChangelog: (version: string): Promise<{ success: boolean; changelog?: string | null; error?: string }> =>
      ipcRenderer.invoke('updater:getChangelog', version),

    /** Подписка на изменение статуса обновления */
    onStatusChange: (
      callback: (status: {
        status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
        updateInfo: { version: string; releaseDate: string; releaseNotes?: string } | null
        downloadProgress: number
        error: string | null
        downloadSpeed: number
        downloadEta: number
      }) => void,
    ): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        status: {
          status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
          updateInfo: { version: string; releaseDate: string; releaseNotes?: string } | null
          downloadProgress: number
          error: string | null
          downloadSpeed: number
          downloadEta: number
        },
      ) => callback(status)
      ipcRenderer.on('updater:status', handler)
      return () => ipcRenderer.removeListener('updater:status', handler)
    },

    /** Подписка на получение changelog */
    onChangelog: (callback: (data: { version: string; changelog: string }) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, data: { version: string; changelog: string }) =>
        callback(data)
      ipcRenderer.on('updater:changelog', handler)
      return () => ipcRenderer.removeListener('updater:changelog', handler)
    },
  },

  // === IPFS (Helia) ===
  ipfs: {
    /** Получить статус ноды */
    status: (): Promise<{
      success: boolean
      data?: {
        isRunning: boolean
        peerId: string | null
        connectedPeers: number
        bytesIn: number
        bytesOut: number
        blockstoreSize: number
      }
      error?: string
    }> => ipcRenderer.invoke('ipfs:status'),

    /** Получить P2P диагностику (inbound/outbound, транспорты, адреса) */
    diagnostics: (): Promise<{
      success: boolean
      data?: P2PDiagnostics | null
      error?: string
    }> => ipcRenderer.invoke('ipfs:diagnostics'),

    /** Получить PeerId текущей ноды */
    getPeerId: (): Promise<{ success: boolean; data?: string | null; error?: string }> =>
      ipcRenderer.invoke('ipfs:getPeerId'),

    /** Запустить ноду */
    start: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('ipfs:start'),

    /** Остановить ноду */
    stop: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('ipfs:stop'),

    /** Подписка на изменение статуса */
    onStatusChanged: (
      callback: (status: {
        isRunning: boolean
        peerId: string | null
        connectedPeers: number
        bytesIn: number
        bytesOut: number
        blockstoreSize: number
      }) => void,
    ): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        status: {
          isRunning: boolean
          peerId: string | null
          connectedPeers: number
          bytesIn: number
          bytesOut: number
          blockstoreSize: number
        },
      ) => callback(status)
      ipcRenderer.on('ipfs:statusChanged', handler)
      return () => ipcRenderer.removeListener('ipfs:statusChanged', handler)
    },

    /** Подписка на подключение пира */
    onPeerConnected: (callback: (peerId: string) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, peerId: string) => callback(peerId)
      ipcRenderer.on('ipfs:peerConnected', handler)
      return () => ipcRenderer.removeListener('ipfs:peerConnected', handler)
    },

    /** Подписка на отключение пира */
    onPeerDisconnected: (callback: (peerId: string) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, peerId: string) => callback(peerId)
      ipcRenderer.on('ipfs:peerDisconnected', handler)
      return () => ipcRenderer.removeListener('ipfs:peerDisconnected', handler)
    },

    /** Подписка на ошибки */
    onError: (callback: (error: string) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error)
      ipcRenderer.on('ipfs:error', handler)
      return () => ipcRenderer.removeListener('ipfs:error', handler)
    },

    // === Операции с контентом ===

    /** Добавить файл в IPFS */
    addFile: (filePath: string): Promise<{ success: boolean; data?: IpfsAddResult; error?: string }> =>
      ipcRenderer.invoke('ipfs:addFile', filePath),

    /** Добавить директорию в IPFS */
    addDirectory: (
      dirPath: string,
      recursive = true,
    ): Promise<{ success: boolean; data?: { files: IpfsAddResult[]; rootCid: string }; error?: string }> =>
      ipcRenderer.invoke('ipfs:addDirectory', dirPath, recursive),

    /** Прочитать контент по CID (возвращает base64) */
    cat: (cid: string): Promise<{ success: boolean; data?: string; error?: string }> =>
      ipcRenderer.invoke('ipfs:cat', cid),

    /** Получить статистику по CID */
    stat: (cid: string): Promise<{ success: boolean; data?: IpfsStatResult; error?: string }> =>
      ipcRenderer.invoke('ipfs:stat', cid),

    /** Проверить наличие контента локально */
    has: (cid: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('ipfs:has', cid),

    /** Сохранить контент из IPFS в файл */
    saveToFile: (cid: string, outputPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('ipfs:saveToFile', cid, outputPath),

    // === HTTP Gateway ===

    /** Запустить HTTP Gateway */
    gatewayStart: (options?: { port?: number }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('ipfs:gateway:start', options),

    /** Остановить HTTP Gateway */
    gatewayStop: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('ipfs:gateway:stop'),

    /** Получить статус Gateway */
    gatewayStatus: (): Promise<{ success: boolean; data?: GatewayStatus; error?: string }> =>
      ipcRenderer.invoke('ipfs:gateway:status'),

    /** Получить URL для CID через Gateway */
    gatewayGetUrl: (cid: string, path?: string): Promise<{ success: boolean; data?: string | null; error?: string }> =>
      ipcRenderer.invoke('ipfs:gateway:getUrl', cid, path),

    /** Подписка на запуск Gateway */
    onGatewayStarted: (callback: (status: GatewayStatus) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, status: GatewayStatus) => callback(status)
      ipcRenderer.on('ipfs:gateway:started', handler)
      return () => ipcRenderer.removeListener('ipfs:gateway:started', handler)
    },

    /** Подписка на остановку Gateway */
    onGatewayStopped: (callback: () => void): () => void => {
      const handler = () => callback()
      ipcRenderer.on('ipfs:gateway:stopped', handler)
      return () => ipcRenderer.removeListener('ipfs:gateway:stopped', handler)
    },

    // === Repo ===

    /** Запустить Garbage Collection — удалить неиспользуемые блоки */
    repoGc: (): Promise<{ success: boolean; data?: { blocksRemoved: number }; error?: string }> =>
      ipcRenderer.invoke('ipfs:repoGc'),

    // === Pinning ===

    /** Закрепить контент */
    pin: (cid: string, name?: string): Promise<{ success: boolean; data?: PinInfo; error?: string }> =>
      ipcRenderer.invoke('ipfs:pin', cid, name),

    /** Открепить контент */
    unpin: (cid: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('ipfs:unpin', cid),

    /** Проверить, закреплён ли контент */
    isPinned: (cid: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('ipfs:isPinned', cid),

    /** Получить информацию о pin */
    getPin: (cid: string): Promise<{ success: boolean; data?: PinInfo | null; error?: string }> =>
      ipcRenderer.invoke('ipfs:getPin', cid),

    /** Список всех pins */
    listPins: (): Promise<{ success: boolean; data?: PinInfo[]; error?: string }> =>
      ipcRenderer.invoke('ipfs:listPins'),

    /** Статистика pins */
    pinStats: (): Promise<{ success: boolean; data?: PinStats; error?: string }> => ipcRenderer.invoke('ipfs:pinStats'),

    /** Переименовать pin */
    renamePin: (cid: string, name: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('ipfs:renamePin', cid, name),

    /** Подписка на закрепление контента */
    onPinned: (callback: (pin: PinInfo) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, pin: PinInfo) => callback(pin)
      ipcRenderer.on('ipfs:pinned', handler)
      return () => ipcRenderer.removeListener('ipfs:pinned', handler)
    },

    /** Подписка на открепление контента */
    onUnpinned: (callback: (pin: PinInfo) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, pin: PinInfo) => callback(pin)
      ipcRenderer.on('ipfs:unpinned', handler)
      return () => ipcRenderer.removeListener('ipfs:unpinned', handler)
    },

    // === IPNS ===

    /** Опубликовать CID под IPNS именем текущей ноды */
    ipnsPublish: (
      cid: string,
      lifetime?: string,
    ): Promise<{ success: boolean; data?: IpnsPublishResult; error?: string }> =>
      ipcRenderer.invoke('ipns:publish', cid, lifetime),

    /** Разрешить IPNS имя в CID */
    ipnsResolve: (name: string): Promise<{ success: boolean; data?: IpnsResolveResult; error?: string }> =>
      ipcRenderer.invoke('ipns:resolve', name),

    /** Получить IPNS имя текущей ноды (PeerId) */
    ipnsGetName: (): Promise<{ success: boolean; data?: string | null; error?: string }> =>
      ipcRenderer.invoke('ipns:getName'),

    /** Переопубликовать все IPNS записи (продление срока жизни) */
    ipnsRepublish: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('ipns:republish'),

    /** Подписка на публикацию IPNS */
    onIpnsPublished: (callback: (result: IpnsPublishResult) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, result: IpnsPublishResult) => callback(result)
      ipcRenderer.on('ipns:published', handler)
      return () => ipcRenderer.removeListener('ipns:published', handler)
    },

    /** Подписка на разрешение IPNS */
    onIpnsResolved: (callback: (result: { name: string } & IpnsResolveResult) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, result: { name: string } & IpnsResolveResult) =>
        callback(result)
      ipcRenderer.on('ipns:resolved', handler)
      return () => ipcRenderer.removeListener('ipns:resolved', handler)
    },

    // === P2P Sharing (Subscriptions) ===

    /** Получить список всех подписок */
    subscriptionList: (): Promise<{ success: boolean; data?: Subscription[]; error?: string }> =>
      ipcRenderer.invoke('subscription:list'),

    /** Получить подписку по ID */
    subscriptionGet: (id: string): Promise<{ success: boolean; data?: Subscription | null; error?: string }> =>
      ipcRenderer.invoke('subscription:get', id),

    /** Добавить подписку */
    subscriptionAdd: (
      data: SubscriptionCreateData,
    ): Promise<{ success: boolean; data?: Subscription; error?: string }> =>
      ipcRenderer.invoke('subscription:add', data),

    /** Удалить подписку */
    subscriptionRemove: (id: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('subscription:remove', id),

    /** Обновить настройки подписки */
    subscriptionUpdate: (
      id: string,
      data: Partial<Pick<Subscription, 'displayName' | 'autoPin' | 'autoPinLimit'>>,
    ): Promise<{ success: boolean; data?: Subscription | null; error?: string }> =>
      ipcRenderer.invoke('subscription:update', id, data),

    /** Обновить данные подписки (проверить IPNS) */
    subscriptionRefresh: (
      id: string,
    ): Promise<{ success: boolean; data?: SubscriptionRefreshResult; error?: string }> =>
      ipcRenderer.invoke('subscription:refresh', id),

    /** Обновить все подписки */
    subscriptionRefreshAll: (): Promise<{ success: boolean; data?: SubscriptionRefreshResult[]; error?: string }> =>
      ipcRenderer.invoke('subscription:refreshAll'),

    /** Загрузить библиотеку подписки из IPFS по lastKnownCid */
    subscriptionFetchLibrary: (
      id: string,
    ): Promise<{ success: boolean; data?: PublishedLibrary | null; error?: string }> =>
      ipcRenderer.invoke('subscription:fetchLibrary', id),

    /** Подписка на добавление подписки */
    onSubscriptionAdded: (callback: (subscription: Subscription) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, subscription: Subscription) => callback(subscription)
      ipcRenderer.on('subscription:added', handler)
      return () => ipcRenderer.removeListener('subscription:added', handler)
    },

    /** Подписка на удаление подписки */
    onSubscriptionRemoved: (callback: (subscription: Subscription) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, subscription: Subscription) => callback(subscription)
      ipcRenderer.on('subscription:removed', handler)
      return () => ipcRenderer.removeListener('subscription:removed', handler)
    },

    /** Подписка на обновление подписки */
    onSubscriptionUpdated: (callback: (subscription: Subscription) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, subscription: Subscription) => callback(subscription)
      ipcRenderer.on('subscription:updated', handler)
      return () => ipcRenderer.removeListener('subscription:updated', handler)
    },

    /** Подписка на обновление данных подписки (refresh) */
    onSubscriptionRefreshed: (callback: (result: SubscriptionRefreshResult) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, result: SubscriptionRefreshResult) => callback(result)
      ipcRenderer.on('subscription:refreshed', handler)
      return () => ipcRenderer.removeListener('subscription:refreshed', handler)
    },

    /** Подписка на обновление всех подписок */
    onSubscriptionAllRefreshed: (callback: (results: SubscriptionRefreshResult[]) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, results: SubscriptionRefreshResult[]) => callback(results)
      ipcRenderer.on('subscription:allRefreshed', handler)
      return () => ipcRenderer.removeListener('subscription:allRefreshed', handler)
    },

    // === Library Publishing ===

    /** Получить конфигурацию публикации */
    publisherGetConfig: (): Promise<{ success: boolean; data?: PublisherConfig; error?: string }> =>
      ipcRenderer.invoke('publisher:getConfig'),

    /** Обновить конфигурацию публикации */
    publisherUpdateConfig: (
      updates: Partial<PublisherConfig>,
    ): Promise<{ success: boolean; data?: PublisherConfig; error?: string }> =>
      ipcRenderer.invoke('publisher:updateConfig', updates),

    /** Опубликовать библиотеку (автоматически получает данные из БД) */
    publisherPublish: (): Promise<{ success: boolean; data?: PublishResult; error?: string }> =>
      ipcRenderer.invoke('publisher:publish'),

    /** Получить количество аниме для публикации */
    publisherGetAnimeCount: (): Promise<{
      success: boolean
      data?: { animeCount: number; episodeCount: number }
      error?: string
    }> => ipcRenderer.invoke('publisher:getAnimeCount'),

    /** Получить опубликованную библиотеку */
    publisherGetPublished: (): Promise<{ success: boolean; data?: PublishedLibrary | null; error?: string }> =>
      ipcRenderer.invoke('publisher:getPublished'),

    /** Подписка на прогресс публикации */
    onPublisherProgress: (callback: (progress: PublishProgress) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, progress: PublishProgress) => callback(progress)
      ipcRenderer.on('publisher:progress', handler)
      return () => ipcRenderer.removeListener('publisher:progress', handler)
    },

    /** Подписка на завершение публикации */
    onPublisherPublished: (callback: (result: PublishResult) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, result: PublishResult) => callback(result)
      ipcRenderer.on('publisher:published', handler)
      return () => ipcRenderer.removeListener('publisher:published', handler)
    },

    /** Подписка на обновление конфигурации */
    onPublisherConfigUpdated: (callback: (config: PublisherConfig) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, config: PublisherConfig) => callback(config)
      ipcRenderer.on('publisher:configUpdated', handler)
      return () => ipcRenderer.removeListener('publisher:configUpdated', handler)
    },

    // === Миграция и очистка библиотеки ===

    /** Получить количество эпизодов для миграции в IPFS */
    publisherGetMigrationCount: (): Promise<{ success: boolean; data?: { count: number }; error?: string }> =>
      ipcRenderer.invoke('publisher:getMigrationCount'),

    /** Мигрировать контент в IPFS */
    publisherMigrateToIpfs: (): Promise<{
      success: boolean
      data?: {
        total: number
        migrated: number
        failed: number
        errors: Array<{ episodeId: string; animeName: string; episodeNumber: number; error: string }>
      }
      error?: string
    }> => ipcRenderer.invoke('publisher:migrateToIpfs'),

    /** Подписка на прогресс миграции */
    onPublisherMigrationProgress: (
      callback: (progress: { current: number; total: number; animeName: string; episodeNumber: number }) => void,
    ): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        progress: { current: number; total: number; animeName: string; episodeNumber: number },
      ) => callback(progress)
      ipcRenderer.on('publisher:migrationProgress', handler)
      return () => ipcRenderer.removeListener('publisher:migrationProgress', handler)
    },

    /** Удалить контент конкретного аниме из IPFS (вызывать ПЕРЕД удалением из БД) */
    publisherDeleteAnimeContent: (
      animeId: string,
    ): Promise<{ success: boolean; data?: { deletedCids: number; cids: string[] }; error?: string }> =>
      ipcRenderer.invoke('publisher:deleteAnimeContent', animeId),

    /** Очистить библиотеку (удалить все аниме из БД и IPFS) */
    publisherClearLibrary: (): Promise<{
      success: boolean
      data?: { deletedCount: number; deletedBytes: number }
      error?: string
    }> => ipcRenderer.invoke('publisher:clearLibrary'),

    // === Tracker Integration ===

    /** Получить конфигурацию tracker */
    trackerGetConfig: (): Promise<{
      success: boolean
      data?: { baseUrl: string; apiKey: string; enabled: boolean }
      error?: string
    }> => ipcRenderer.invoke('tracker:getConfig'),

    /** Обновить конфигурацию tracker */
    trackerUpdateConfig: (updates: {
      baseUrl?: string
      apiKey?: string
      enabled?: boolean
    }): Promise<{
      success: boolean
      data?: { baseUrl: string; apiKey: string; enabled: boolean }
      error?: string
    }> => ipcRenderer.invoke('tracker:updateConfig', updates),

    /** Проверить подключение к tracker */
    trackerTestConnection: (): Promise<{
      success: boolean
      data?: { success: boolean; message: string; trackerName?: string }
      error?: string
    }> => ipcRenderer.invoke('tracker:testConnection'),

    /** Опубликовать аниме на tracker по manifestCid */
    trackerPublish: (
      manifestCid: string,
    ): Promise<{
      success: boolean
      data?: { success: boolean; animeId?: string; status?: string; episodeCount?: number; error?: string }
      error?: string
    }> => ipcRenderer.invoke('tracker:publish', manifestCid),

    // === Subscription Scheduler ===

    /** Получить статус планировщика */
    schedulerGetStatus: (): Promise<{ success: boolean; data?: SchedulerStatus; error?: string }> =>
      ipcRenderer.invoke('scheduler:getStatus'),

    /** Получить конфигурацию планировщика */
    schedulerGetConfig: (): Promise<{ success: boolean; data?: SchedulerConfig; error?: string }> =>
      ipcRenderer.invoke('scheduler:getConfig'),

    /** Обновить конфигурацию планировщика */
    schedulerUpdateConfig: (
      updates: Partial<SchedulerConfig>,
    ): Promise<{ success: boolean; data?: SchedulerConfig; error?: string }> =>
      ipcRenderer.invoke('scheduler:updateConfig', updates),

    /** Запустить планировщик */
    schedulerStart: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('scheduler:start'),

    /** Остановить планировщик */
    schedulerStop: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('scheduler:stop'),

    /** Проверить подписки сейчас */
    schedulerCheckNow: (): Promise<{ success: boolean; data?: SubscriptionRefreshResult[]; error?: string }> =>
      ipcRenderer.invoke('scheduler:checkNow'),

    /** Подписка на изменение статуса планировщика */
    onSchedulerStatusChanged: (callback: (status: SchedulerStatus) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, status: SchedulerStatus) => callback(status)
      ipcRenderer.on('scheduler:statusChanged', handler)
      return () => ipcRenderer.removeListener('scheduler:statusChanged', handler)
    },

    /** Подписка на обновление конфигурации планировщика */
    onSchedulerConfigUpdated: (callback: (config: SchedulerConfig) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, config: SchedulerConfig) => callback(config)
      ipcRenderer.on('scheduler:configUpdated', handler)
      return () => ipcRenderer.removeListener('scheduler:configUpdated', handler)
    },

    /** Подписка на результаты проверки подписок */
    onSchedulerChecked: (callback: (results: SubscriptionRefreshResult[]) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, results: SubscriptionRefreshResult[]) => callback(results)
      ipcRenderer.on('scheduler:checked', handler)
      return () => ipcRenderer.removeListener('scheduler:checked', handler)
    },

    // === Remote Pinning (Pinata) ===

    /** Получить конфигурацию remote pinning */
    remotePinGetConfig: (): Promise<{ success: boolean; data?: RemotePinConfig; error?: string }> =>
      ipcRenderer.invoke('remotePin:getConfig'),

    /** Обновить конфигурацию remote pinning */
    remotePinUpdateConfig: (
      updates: Partial<RemotePinConfig>,
    ): Promise<{ success: boolean; data?: RemotePinConfig; error?: string }> =>
      ipcRenderer.invoke('remotePin:updateConfig', updates),

    /** Обновить конфигурацию Pinata */
    remotePinUpdatePinataConfig: (
      updates: Partial<PinataConfig>,
    ): Promise<{ success: boolean; data?: RemotePinConfig; error?: string }> =>
      ipcRenderer.invoke('remotePin:updatePinataConfig', updates),

    /** Проверить JWT токен Pinata */
    remotePinTestAuth: (jwt: string): Promise<{ success: boolean; data?: { valid: boolean }; error?: string }> =>
      ipcRenderer.invoke('remotePin:testAuth', jwt),

    /** Закрепить CID на Pinata */
    remotePinPin: (
      cid: string,
      options?: RemotePinOptions,
    ): Promise<{ success: boolean; data?: PinataPinJob; error?: string }> =>
      ipcRenderer.invoke('remotePin:pin', cid, options),

    /** Открепить CID с Pinata */
    remotePinUnpin: (cid: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('remotePin:unpin', cid),

    /** Получить список пинов на Pinata */
    remotePinList: (
      limit?: number,
      offset?: number,
    ): Promise<{ success: boolean; data?: RemotePin[]; error?: string }> =>
      ipcRenderer.invoke('remotePin:list', limit, offset),

    /** Получить информацию о пине */
    remotePinGet: (cid: string): Promise<{ success: boolean; data?: RemotePin | null; error?: string }> =>
      ipcRenderer.invoke('remotePin:get', cid),

    /** Проверить, закреплён ли CID на Pinata */
    remotePinIsPinned: (cid: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('remotePin:isPinned', cid),

    /** Получить статистику Pinata */
    remotePinStats: (): Promise<{ success: boolean; data?: PinataStats; error?: string }> =>
      ipcRenderer.invoke('remotePin:stats'),

    /** Обновить метаданные пина */
    remotePinUpdateMetadata: (
      cid: string,
      name: string,
      keyvalues?: Record<string, string>,
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('remotePin:updateMetadata', cid, name, keyvalues),

    /** Получить статус pin job */
    remotePinGetJobStatus: (jobId: string): Promise<{ success: boolean; data?: PinataPinJob; error?: string }> =>
      ipcRenderer.invoke('remotePin:getJobStatus', jobId),

    /** Подписка на старт пининга */
    onRemotePinStarted: (callback: (job: PinataPinJob) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, job: PinataPinJob) => callback(job)
      ipcRenderer.on('remotePin:pinStarted', handler)
      return () => ipcRenderer.removeListener('remotePin:pinStarted', handler)
    },

    /** Подписка на открепление */
    onRemotePinUnpinned: (callback: (data: { cid: string }) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, data: { cid: string }) => callback(data)
      ipcRenderer.on('remotePin:unpinned', handler)
      return () => ipcRenderer.removeListener('remotePin:unpinned', handler)
    },

    /** Подписка на обновление конфигурации */
    onRemotePinConfigUpdated: (callback: (config: RemotePinConfig) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, config: RemotePinConfig) => callback(config)
      ipcRenderer.on('remotePin:configUpdated', handler)
      return () => ipcRenderer.removeListener('remotePin:configUpdated', handler)
    },
  },

  // === Kubo (Go IPFS) ===
  kubo: {
    /** Получить статус Kubo сервиса */
    status: (): Promise<{
      success: boolean
      data?: {
        isRunning: boolean
        mode: 'external' | 'embedded' | 'none'
        peerId: string | null
        apiUrl: string | null
        gatewayPort: number | null
        version: string | null
        connectedPeers: number
      }
      error?: string
    }> => ipcRenderer.invoke('kubo:status'),

    /** Запустить Kubo */
    start: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('kubo:start'),

    /** Остановить Kubo */
    stop: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('kubo:stop'),

    /** Получить PeerId ноды */
    getPeerId: (): Promise<{ success: boolean; data?: string | null; error?: string }> =>
      ipcRenderer.invoke('kubo:getPeerId'),

    /** Получить режим работы */
    getMode: (): Promise<{
      success: boolean
      data?: 'external' | 'embedded' | 'none'
      error?: string
    }> => ipcRenderer.invoke('kubo:getMode'),

    /** Получить URL Gateway */
    getGatewayUrl: (): Promise<{ success: boolean; data?: string | null; error?: string }> =>
      ipcRenderer.invoke('kubo:getGatewayUrl'),

    /** Подписка на изменение статуса */
    onStatusChanged: (
      callback: (status: {
        isRunning: boolean
        mode: 'external' | 'embedded' | 'none'
        peerId: string | null
        apiUrl: string | null
        gatewayPort: number | null
        version: string | null
        connectedPeers: number
      }) => void,
    ): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        status: {
          isRunning: boolean
          mode: 'external' | 'embedded' | 'none'
          peerId: string | null
          apiUrl: string | null
          gatewayPort: number | null
          version: string | null
          connectedPeers: number
        },
      ) => callback(status)
      ipcRenderer.on('kubo:statusChanged', handler)
      return () => ipcRenderer.removeListener('kubo:statusChanged', handler)
    },

    /** Подписка на подключение пира */
    onPeerConnected: (callback: (peerId: string) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, peerId: string) => callback(peerId)
      ipcRenderer.on('kubo:peerConnected', handler)
      return () => ipcRenderer.removeListener('kubo:peerConnected', handler)
    },

    /** Подписка на отключение пира */
    onPeerDisconnected: (callback: (peerId: string) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, peerId: string) => callback(peerId)
      ipcRenderer.on('kubo:peerDisconnected', handler)
      return () => ipcRenderer.removeListener('kubo:peerDisconnected', handler)
    },

    /** Подписка на ошибки */
    onError: (callback: (error: string) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error)
      ipcRenderer.on('kubo:error', handler)
      return () => ipcRenderer.removeListener('kubo:error', handler)
    },
  },

  // === Federation (Tracker Sync) ===
  federation: {
    /** Получить настройки федерации */
    getSettings: (): Promise<FederationOperationResult<FederationSettings>> =>
      ipcRenderer.invoke('federation:getSettings'),

    /** Обновить настройки федерации */
    updateSettings: (
      update: Partial<Omit<FederationSettings, 'hasPrivateKey'>>,
    ): Promise<FederationOperationResult<FederationSettings>> =>
      ipcRenderer.invoke('federation:updateSettings', update),

    /** Сгенерировать ключи для HTTP Signatures */
    generateKeys: (): Promise<FederationOperationResult<{ publicKeyPem: string }>> =>
      ipcRenderer.invoke('federation:generateKeys'),

    /** Обнаружить трекер по URL (WebFinger) */
    discover: (url: string): Promise<FederationOperationResult<DiscoverResult>> =>
      ipcRenderer.invoke('federation:discover', url),

    /** Получить список известных трекеров */
    listTrackers: (): Promise<FederationOperationResult<TrackerInfo[]>> =>
      ipcRenderer.invoke('federation:listTrackers'),

    /** Добавить трекер */
    addTracker: (options: AddTrackerOptions): Promise<FederationOperationResult<TrackerInfo>> =>
      ipcRenderer.invoke('federation:addTracker', options),

    /** Удалить трекер */
    removeTracker: (trackerId: string): Promise<FederationOperationResult<void>> =>
      ipcRenderer.invoke('federation:removeTracker', trackerId),

    /** Обновить информацию о трекере */
    refreshTracker: (trackerId: string): Promise<FederationOperationResult<TrackerInfo>> =>
      ipcRenderer.invoke('federation:refreshTracker', trackerId),

    /** Установить уровень доверия трекера */
    setTrust: (trackerId: string, trustLevel: TrustLevel): Promise<FederationOperationResult<TrackerInfo>> =>
      ipcRenderer.invoke('federation:setTrust', trackerId, trustLevel),

    /** Заблокировать трекер */
    blockTracker: (trackerId: string): Promise<FederationOperationResult<void>> =>
      ipcRenderer.invoke('federation:blockTracker', trackerId),

    /** Разблокировать трекер */
    unblockTracker: (trackerId: string): Promise<FederationOperationResult<void>> =>
      ipcRenderer.invoke('federation:unblockTracker', trackerId),

    /** Синхронизировать контент с трекером */
    sync: (trackerId: string, options?: SyncOptions): Promise<FederationOperationResult<SyncResult>> =>
      ipcRenderer.invoke('federation:sync', trackerId, options),

    /** Синхронизировать со всеми доверенными трекерами */
    syncAll: (options?: SyncOptions): Promise<FederationOperationResult<SyncResult[]>> =>
      ipcRenderer.invoke('federation:syncAll', options),

    /** Получить глобальную статистику сидеров для CID */
    getGlobalSeeders: (cid: string): Promise<FederationOperationResult<GlobalSeederStats>> =>
      ipcRenderer.invoke('federation:getGlobalSeeders', cid),

    /** Получить trust score трекера */
    getTrustScore: (trackerId: string): Promise<FederationOperationResult<number>> =>
      ipcRenderer.invoke('federation:getTrustScore', trackerId),
  },

  // === Stats — Статистика пользователя ===
  stats: {
    /** Получить текущую статистику */
    get: (): Promise<{ success: boolean; data?: UserStats; error?: string }> => ipcRenderer.invoke('stats:get'),

    /** Получить историю по дням */
    getDailyHistory: (days?: number): Promise<{ success: boolean; data?: DailyStats[]; error?: string }> =>
      ipcRenderer.invoke('stats:getDailyHistory', days),

    /** Сбросить статистику (для тестов) */
    reset: (): Promise<{ success: boolean; data?: UserStats; error?: string }> => ipcRenderer.invoke('stats:reset'),

    /** Получить время текущей сессии */
    getCurrentSession: (): Promise<{
      success: boolean
      data?: { durationMs: string; isActive: boolean }
      error?: string
    }> => ipcRenderer.invoke('stats:getCurrentSession'),

    /** Подписка на обновление статистики */
    onUpdated: (callback: (event: StatsUpdatedEvent) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, data: StatsUpdatedEvent) => callback(data)
      ipcRenderer.on('stats:updated', handler)
      return () => ipcRenderer.removeListener('stats:updated', handler)
    },

    /** Подписка на начало сессии */
    onSessionStarted: (callback: () => void): () => void => {
      const handler = () => callback()
      ipcRenderer.on('stats:sessionStarted', handler)
      return () => ipcRenderer.removeListener('stats:sessionStarted', handler)
    },

    /** Подписка на завершение сессии */
    onSessionEnded: (callback: () => void): () => void => {
      const handler = () => callback()
      ipcRenderer.on('stats:sessionEnded', handler)
      return () => ipcRenderer.removeListener('stats:sessionEnded', handler)
    },
  },

  // === Reputation — Репутация пользователя ===
  reputation: {
    /** Получить текущую репутацию */
    get: (): Promise<{ success: boolean; data?: UserReputation; error?: string }> =>
      ipcRenderer.invoke('reputation:get'),

    /** Пересчитать репутацию */
    recalculate: (): Promise<{ success: boolean; data?: UserReputation; error?: string }> =>
      ipcRenderer.invoke('reputation:recalculate'),

    /** Сбросить репутацию (для тестов) */
    reset: (): Promise<{ success: boolean; data?: UserReputation; error?: string }> =>
      ipcRenderer.invoke('reputation:reset'),

    /** Получить текущий score */
    getScore: (): Promise<{ success: boolean; data?: number; error?: string }> =>
      ipcRenderer.invoke('reputation:getScore'),

    /** Подписка на обновление репутации */
    onUpdated: (callback: (reputation: UserReputation) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, data: UserReputation) => callback(data)
      ipcRenderer.on('reputation:updated', handler)
      return () => ipcRenderer.removeListener('reputation:updated', handler)
    },

    /** Подписка на изменение ранга */
    onRankChanged: (callback: (event: RankChangedEvent) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, data: RankChangedEvent) => callback(data)
      ipcRenderer.on('reputation:rankChanged', handler)
      return () => ipcRenderer.removeListener('reputation:rankChanged', handler)
    },
  },

  // === Achievements — Достижения пользователя ===
  achievements: {
    /** Получить все достижения с прогрессом */
    getAll: (): Promise<{ success: boolean; data?: AchievementWithProgress[]; error?: string }> =>
      ipcRenderer.invoke('achievements:getAll'),

    /** Получить разблокированные достижения */
    getUnlocked: (): Promise<{ success: boolean; data?: AchievementWithProgress[]; error?: string }> =>
      ipcRenderer.invoke('achievements:getUnlocked'),

    /** Получить данные достижений */
    get: (): Promise<{ success: boolean; data?: UserAchievements; error?: string }> =>
      ipcRenderer.invoke('achievements:get'),

    /** Отметить достижение как показанное */
    markNotified: (id: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('achievements:markNotified', id),

    /** Проверить все достижения */
    check: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('achievements:check'),

    /** Сбросить достижения (для тестов) */
    reset: (): Promise<{ success: boolean; data?: UserAchievements; error?: string }> =>
      ipcRenderer.invoke('achievements:reset'),

    /** Подписка на разблокировку достижения */
    onUnlocked: (callback: (event: AchievementUnlockedEvent) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, data: AchievementUnlockedEvent) => callback(data)
      ipcRenderer.on('achievements:unlocked', handler)
      return () => ipcRenderer.removeListener('achievements:unlocked', handler)
    },

    /** Подписка на обновление прогресса */
    onProgress: (callback: (data: { id: string; progress: number }) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; progress: number }) => callback(data)
      ipcRenderer.on('achievements:progress', handler)
      return () => ipcRenderer.removeListener('achievements:progress', handler)
    },
  },

  // === Bonus — Бонусные очки ===
  bonus: {
    /** Получить бонусные очки */
    get: (): Promise<{ success: boolean; data?: BonusPoints; error?: string }> => ipcRenderer.invoke('bonus:get'),

    /** Получить баланс */
    getBalance: (): Promise<{ success: boolean; data?: number; error?: string }> =>
      ipcRenderer.invoke('bonus:getBalance'),

    /** Получить историю транзакций */
    getTransactions: (limit?: number): Promise<{ success: boolean; data?: BonusTransaction[]; error?: string }> =>
      ipcRenderer.invoke('bonus:getTransactions', limit),

    /** Потратить очки */
    spend: (
      amount: number,
      description: string,
      metadata?: Record<string, unknown>,
    ): Promise<{
      success: boolean
      data?: { success: boolean; error?: string; transaction?: BonusTransaction; newBalance?: number }
      error?: string
    }> => ipcRenderer.invoke('bonus:spend', amount, description, metadata),

    /** Сбросить бонусы (для тестов) */
    reset: (): Promise<{ success: boolean; data?: BonusPoints; error?: string }> => ipcRenderer.invoke('bonus:reset'),

    /** Подписка на изменение баланса */
    onBalanceChanged: (
      callback: (event: { oldBalance: number; newBalance: number; transaction: BonusTransaction }) => void,
    ): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { oldBalance: number; newBalance: number; transaction: BonusTransaction },
      ) => callback(data)
      ipcRenderer.on('bonus:balanceChanged', handler)
      return () => ipcRenderer.removeListener('bonus:balanceChanged', handler)
    },

    /** Подписка на заработок очков */
    onPointsEarned: (callback: (data: { amount: number; type: string; description: string }) => void): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { amount: number; type: string; description: string },
      ) => callback(data)
      ipcRenderer.on('bonus:pointsEarned', handler)
      return () => ipcRenderer.removeListener('bonus:pointsEarned', handler)
    },

    /** Подписка на трату очков */
    onPointsSpent: (callback: (data: { amount: number; description: string }) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, data: { amount: number; description: string }) =>
        callback(data)
      ipcRenderer.on('bonus:pointsSpent', handler)
      return () => ipcRenderer.removeListener('bonus:pointsSpent', handler)
    },
  },

  // === Export Queue ===
  exportQueue: {
    /** Добавить задачу в очередь */
    add: (data: ExportTaskCreateData): Promise<ExportQueueResult<ExportTask>> =>
      ipcRenderer.invoke('export-queue:add', data),

    /** Отменить задачу */
    cancel: (taskId: string): Promise<ExportQueueResult> => ipcRenderer.invoke('export-queue:cancel', taskId),

    /** Приостановить задачу */
    pause: (taskId: string): Promise<ExportQueueResult> => ipcRenderer.invoke('export-queue:pause', taskId),

    /** Возобновить задачу */
    resume: (taskId: string): Promise<ExportQueueResult> => ipcRenderer.invoke('export-queue:resume', taskId),

    /** Повторить неудавшуюся задачу */
    retry: (taskId: string): Promise<ExportQueueResult> => ipcRenderer.invoke('export-queue:retry', taskId),

    /** Получить список задач */
    list: (): Promise<ExportQueueResult<ExportTask[]>> => ipcRenderer.invoke('export-queue:list'),

    /** Получить задачу по ID */
    get: (taskId: string): Promise<ExportQueueResult<ExportTask>> => ipcRenderer.invoke('export-queue:get', taskId),

    /** Очистить завершённые/отменённые задачи */
    clear: (): Promise<ExportQueueResult<number>> => ipcRenderer.invoke('export-queue:clear'),

    /** Получить настройки */
    getSettings: (): Promise<ExportQueueResult<ExportQueueSettings>> => ipcRenderer.invoke('export-queue:getSettings'),

    /** Обновить настройки */
    updateSettings: (settings: Partial<ExportQueueSettings>): Promise<ExportQueueResult> =>
      ipcRenderer.invoke('export-queue:updateSettings', settings),

    /** Подписка на прогресс задачи */
    onProgress: (callback: (task: ExportTask) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, task: ExportTask) => callback(task)
      ipcRenderer.on('export-queue:progress', handler)
      return () => ipcRenderer.removeListener('export-queue:progress', handler)
    },

    /** Подписка на завершение задачи */
    onCompleted: (callback: (task: ExportTask) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, task: ExportTask) => callback(task)
      ipcRenderer.on('export-queue:completed', handler)
      return () => ipcRenderer.removeListener('export-queue:completed', handler)
    },

    /** Подписка на ошибку задачи */
    onFailed: (callback: (task: ExportTask) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, task: ExportTask) => callback(task)
      ipcRenderer.on('export-queue:failed', handler)
      return () => ipcRenderer.removeListener('export-queue:failed', handler)
    },

    /** Подписка на изменение очереди */
    onUpdated: (callback: (tasks: ExportTask[]) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, tasks: ExportTask[]) => callback(tasks)
      ipcRenderer.on('export-queue:updated', handler)
      return () => ipcRenderer.removeListener('export-queue:updated', handler)
    },
  },

  // === Web Export (для Web Player) ===
  webExport: {
    /** Запуск экспорта для Web Player */
    start: async (config: QueueExportConfig, options: WebExportOptions): Promise<WebExportResult> => {
      const result = await ipcRenderer.invoke('web-export:start', config, options)
      // createHandler оборачивает в { success, data }, разворачиваем
      if (result.success && result.data) {
        return result.data
      }
      return { success: false, error: result.error ?? 'Web export failed' }
    },

    /** Отмена экспорта */
    cancel: (): Promise<void> => ipcRenderer.invoke('web-export:cancel'),

    /** Проверка статуса */
    isRunning: async (): Promise<boolean> => {
      const result = await ipcRenderer.invoke('web-export:is-running')
      // createHandler оборачивает в { success, data }
      return result.success && result.data === true
    },

    /** Подписка на прогресс */
    onProgress: (callback: (progress: WebExportProgress) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, progress: WebExportProgress) => callback(progress)
      ipcRenderer.on('web-export:progress', handler)
      return () => ipcRenderer.removeListener('web-export:progress', handler)
    },
  },

  // === Profile (профиль пользователя и Friend Code) ===
  profile: {
    /** Получить профиль пользователя */
    get: (): Promise<{ success: boolean; data?: UserProfile | null; error?: string }> =>
      ipcRenderer.invoke('profile:get'),

    /** Обновить профиль пользователя */
    update: (updates: UserProfileUpdate): Promise<{ success: boolean; data?: UserProfile | null; error?: string }> =>
      ipcRenderer.invoke('profile:update', updates),

    /** Получить PeerId текущего пользователя */
    getPeerId: (): Promise<{ success: boolean; data?: string | null; error?: string }> =>
      ipcRenderer.invoke('profile:get-peer-id'),

    /** Получить Friend Code текущего пользователя */
    getFriendCode: (): Promise<{ success: boolean; data?: string | null; error?: string }> =>
      ipcRenderer.invoke('friend-code:get'),

    /** Сгенерировать Friend Code из PeerId */
    generateFriendCode: (peerId: string): Promise<{ success: boolean; data?: string; error?: string }> =>
      ipcRenderer.invoke('friend-code:generate', peerId),

    /** Верифицировать Friend Code */
    verifyFriendCode: (code: string, peerId: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('friend-code:verify', code, peerId),

    /** Проверить формат Friend Code */
    validateFriendCodeFormat: (code: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('friend-code:validate-format', code),

    /** Подписка на обновления профиля */
    onUpdated: (callback: (profile: UserProfile) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, profile: UserProfile) => callback(profile)
      ipcRenderer.on('profile:updated', handler)
      return () => ipcRenderer.removeListener('profile:updated', handler)
    },
  },

  // === Friends (друзья и запросы в друзья) ===
  friends: {
    /** Получить список друзей */
    list: (): Promise<{ success: boolean; data?: Friend[]; error?: string }> => ipcRenderer.invoke('friends:list'),

    /** Удалить из друзей */
    remove: (peerId: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('friends:remove', peerId),

    /** Заблокировать пользователя */
    block: (peerId: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('friends:block', peerId),

    /** Проверить блокировку */
    isBlocked: (peerId: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('friends:is-blocked', peerId),

    /** Отправить запрос в друзья */
    sendRequest: (targetPeerId: string): Promise<{ success: boolean; data?: FriendRequest | null; error?: string }> =>
      ipcRenderer.invoke('friend-request:send', targetPeerId),

    /** Получить входящие запросы */
    getIncomingRequests: (): Promise<{ success: boolean; data?: FriendRequest[]; error?: string }> =>
      ipcRenderer.invoke('friend-request:incoming'),

    /** Получить исходящие запросы */
    getOutgoingRequests: (): Promise<{ success: boolean; data?: FriendRequest[]; error?: string }> =>
      ipcRenderer.invoke('friend-request:outgoing'),

    /** Принять запрос */
    acceptRequest: (requestId: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('friend-request:accept', requestId),

    /** Отклонить запрос */
    rejectRequest: (requestId: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('friend-request:reject', requestId),

    /** Подписка на новые запросы */
    onRequestReceived: (callback: (request: FriendRequest) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, request: FriendRequest) => callback(request)
      ipcRenderer.on('friend-request:received', handler)
      return () => ipcRenderer.removeListener('friend-request:received', handler)
    },

    /** Подписка на обновление запросов */
    onRequestUpdated: (callback: (request: FriendRequest) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, request: FriendRequest) => callback(request)
      ipcRenderer.on('friend-request:updated', handler)
      return () => ipcRenderer.removeListener('friend-request:updated', handler)
    },

    /** Подписка на обновление списка друзей */
    onFriendsUpdated: (callback: (friends: Friend[]) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, friends: Friend[]) => callback(friends)
      ipcRenderer.on('friends:updated', handler)
      return () => ipcRenderer.removeListener('friends:updated', handler)
    },
  },

  // === Presence (онлайн-статусы) ===
  presence: {
    /** Запустить presence сервис */
    start: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('presence:start'),

    /** Остановить presence сервис */
    stop: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('presence:stop'),

    /** Обновить настройки presence */
    updateSettings: (settings: Partial<PresenceSettings>): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('presence:updateSettings', settings),

    /** Обновить watching статус */
    setWatching: (watching: WatchingInfo | undefined): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('presence:setWatching', watching),

    /** Получить presence друга */
    getFriendPresence: (peerId: string): Promise<{ success: boolean; data?: PresenceMessage | null; error?: string }> =>
      ipcRenderer.invoke('presence:getFriendPresence', peerId),

    /** Получить все presence */
    getAllPresence: (): Promise<{ success: boolean; data?: Record<string, PresenceMessage>; error?: string }> =>
      ipcRenderer.invoke('presence:getAllPresence'),

    /** Проверить онлайн-статус друга */
    isFriendOnline: (peerId: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('presence:isFriendOnline', peerId),

    /** Подписка на обновление presence */
    onPresenceUpdated: (callback: (data: { peerId: string; presence: PresenceMessage }) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, data: { peerId: string; presence: PresenceMessage }) =>
        callback(data)
      ipcRenderer.on('presence:updated', handler)
      return () => ipcRenderer.removeListener('presence:updated', handler)
    },

    /** Подписка на переход друга в онлайн */
    onFriendOnline: (callback: (peerId: string) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, peerId: string) => callback(peerId)
      ipcRenderer.on('presence:friendOnline', handler)
      return () => ipcRenderer.removeListener('presence:friendOnline', handler)
    },

    /** Подписка на переход друга в оффлайн */
    onFriendOffline: (callback: (peerId: string) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, peerId: string) => callback(peerId)
      ipcRenderer.on('presence:friendOffline', handler)
      return () => ipcRenderer.removeListener('presence:friendOffline', handler)
    },
  },

  // === Watch Party (совместный просмотр) ===
  watchParty: {
    /** Создать комнату */
    create: (options: {
      name: string
      animeName: string
      episodeNumber: number
      filePath?: string
      contentCid?: string
      isPrivate?: boolean
      maxParticipants?: number
    }): Promise<{ success: boolean; data?: WatchPartyRoom | null; error?: string }> =>
      ipcRenderer.invoke('watch-party:create', options),

    /** Присоединиться к комнате */
    join: (roomId: string): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('watch-party:join', roomId),

    /** Покинуть комнату */
    leave: (): Promise<{ success: boolean; data?: boolean; error?: string }> => ipcRenderer.invoke('watch-party:leave'),

    /** Закрыть комнату (только хост) */
    close: (): Promise<{ success: boolean; data?: boolean; error?: string }> => ipcRenderer.invoke('watch-party:close'),

    /** Получить текущую комнату */
    getCurrent: (): Promise<{ success: boolean; data?: string | null; error?: string }> =>
      ipcRenderer.invoke('watch-party:getCurrent'),

    /** Получить участников */
    getParticipants: (): Promise<{ success: boolean; data?: WatchPartyParticipant[]; error?: string }> =>
      ipcRenderer.invoke('watch-party:getParticipants'),

    /** Получить состояние playback */
    getPlaybackState: (): Promise<{ success: boolean; data?: WatchPartyPlaybackState | null; error?: string }> =>
      ipcRenderer.invoke('watch-party:getPlaybackState'),

    /** Play */
    play: (): Promise<{ success: boolean; data?: boolean; error?: string }> => ipcRenderer.invoke('watch-party:play'),

    /** Pause */
    pause: (): Promise<{ success: boolean; data?: boolean; error?: string }> => ipcRenderer.invoke('watch-party:pause'),

    /** Seek */
    seek: (position: number): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('watch-party:seek', position),

    /** Отправить сообщение */
    sendMessage: (text: string): Promise<{ success: boolean; data?: WatchPartyChatMessage | null; error?: string }> =>
      ipcRenderer.invoke('watch-party:sendMessage', text),

    /** Отправить реакцию */
    sendReaction: (
      reaction: string,
    ): Promise<{ success: boolean; data?: WatchPartyChatMessage | null; error?: string }> =>
      ipcRenderer.invoke('watch-party:sendReaction', reaction),

    /** Подписка на обновление playback */
    onPlaybackUpdated: (callback: (data: { roomId: string; state: WatchPartyPlaybackState }) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, data: { roomId: string; state: WatchPartyPlaybackState }) =>
        callback(data)
      ipcRenderer.on('watch-party:playbackUpdated', handler)
      return () => ipcRenderer.removeListener('watch-party:playbackUpdated', handler)
    },

    /** Подписка на присоединение участника */
    onParticipantJoined: (
      callback: (data: { roomId: string; participant: WatchPartyParticipant }) => void,
    ): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { roomId: string; participant: WatchPartyParticipant },
      ) => callback(data)
      ipcRenderer.on('watch-party:participantJoined', handler)
      return () => ipcRenderer.removeListener('watch-party:participantJoined', handler)
    },

    /** Подписка на уход участника */
    onParticipantLeft: (callback: (data: { roomId: string; peerId: string }) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, data: { roomId: string; peerId: string }) => callback(data)
      ipcRenderer.on('watch-party:participantLeft', handler)
      return () => ipcRenderer.removeListener('watch-party:participantLeft', handler)
    },

    /** Подписка на сообщения чата */
    onMessageReceived: (callback: (data: { roomId: string; message: WatchPartyChatMessage }) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, data: { roomId: string; message: WatchPartyChatMessage }) =>
        callback(data)
      ipcRenderer.on('watch-party:messageReceived', handler)
      return () => ipcRenderer.removeListener('watch-party:messageReceived', handler)
    },

    /** Подписка на закрытие комнаты */
    onRoomClosed: (callback: (data: { roomId: string }) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, data: { roomId: string }) => callback(data)
      ipcRenderer.on('watch-party:roomClosed', handler)
      return () => ipcRenderer.removeListener('watch-party:roomClosed', handler)
    },
  },

  /**
   * Deep Link API
   *
   * Работа с deep links animatrona://
   */
  deepLink: {
    /** Подписаться на deep links */
    subscribe: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('deep-link:subscribe'),

    /** Отписаться от deep links */
    unsubscribe: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('deep-link:unsubscribe'),

    /** Сгенерировать invite для Watch Party */
    generateWatchPartyInvite: (
      roomId: string,
      roomName: string,
      hostName: string,
      animeName: string,
    ): Promise<{ success: boolean; data?: WatchPartyInvite; error?: string }> =>
      ipcRenderer.invoke('deep-link:generateWatchPartyInvite', roomId, roomName, hostName, animeName),

    /** Сгенерировать link для добавления друга */
    generateFriendLink: (friendCode: string): Promise<{ success: boolean; data?: string; error?: string }> =>
      ipcRenderer.invoke('deep-link:generateFriendLink', friendCode),

    /** Показать уведомление о приглашении */
    showInviteNotification: (invite: WatchPartyInvite): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('deep-link:showInviteNotification', invite),

    /** Проверить, поддерживаются ли уведомления */
    notificationsSupported: (): Promise<{ success: boolean; data?: boolean; error?: string }> =>
      ipcRenderer.invoke('deep-link:notificationsSupported'),

    /** Подписка на получение deep link */
    onReceived: (
      callback: (data: { type: 'party_join' | 'friend_add' | 'unknown'; data: Record<string, string> }) => void,
    ): () => void => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        action: { type: 'party_join' | 'friend_add' | 'unknown'; data: Record<string, string> },
      ) => callback(action)
      ipcRenderer.on('deep-link:received', handler)
      return () => ipcRenderer.removeListener('deep-link:received', handler)
    },
  },

  // === Автоопределение OP/ED ===
  introDetector: {
    /** Определить OP/ED для списка эпизодов (минимум 2) */
    detect: async (
      episodes: Array<{ id: string; sourcePath: string; duration: number }>,
    ): Promise<
      Array<{
        episodeId: string
        introStartMs: number | null
        introEndMs: number | null
        outroStartMs: number | null
        outroEndMs: number | null
      }>
    > => {
      const result = await ipcRenderer.invoke('introDetector:detect', episodes)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    /** Определить OP/ED из IPFS (скачивает аудиодорожки во temp файлы) */
    detectFromIpfs: async (
      episodes: Array<{ id: string; audioCid: string; duration: number }>,
    ): Promise<
      Array<{
        episodeId: string
        introStartMs: number | null
        introEndMs: number | null
        outroStartMs: number | null
        outroEndMs: number | null
      }>
    > => {
      const result = await ipcRenderer.invoke('introDetector:detectFromIpfs', episodes)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    /** Подписка на прогресс определения */
    onProgress: (callback: (percent: number, stage: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, percent: number, stage: string) => callback(percent, stage)
      ipcRenderer.on('introDetector:progress', handler)
      return () => ipcRenderer.removeListener('introDetector:progress', handler)
    },
  },

  // === Mobile Server (доступ к библиотеке с телефона) ===
  mobileServer: {
    /** Запустить мобильный сервер */
    start: async (port?: number): Promise<MobileServerStatus> => {
      const result = await ipcRenderer.invoke('mobile-server:start', port)
      if (!result.success) throw new Error(result.error)
      return result.data
    },

    /** Остановить мобильный сервер */
    stop: async (): Promise<void> => {
      const result = await ipcRenderer.invoke('mobile-server:stop')
      if (!result.success) throw new Error(result.error)
    },

    /** Получить статус сервера */
    getStatus: async (): Promise<MobileServerStatus> => {
      const result = await ipcRenderer.invoke('mobile-server:status')
      if (!result.success) throw new Error(result.error)
      return result.data
    },

    /** Получить QR-код для подключения (base64 PNG) */
    getQRCode: async (): Promise<string | null> => {
      const result = await ipcRenderer.invoke('mobile-server:getQRCode')
      if (!result.success) throw new Error(result.error)
      return result.data
    },

    /** Обновить локальный IP (при смене сети) */
    refreshIp: async (): Promise<MobileServerStatus> => {
      const result = await ipcRenderer.invoke('mobile-server:refreshIp')
      if (!result.success) throw new Error(result.error)
      return result.data
    },
  },
}

// Экспортируем API в renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Типы для TypeScript в renderer
export type ElectronAPI = typeof electronAPI

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
import type { ExportResult, SeriesExportProgress } from '../shared/types/export'
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
import type { EpisodeManifest } from '../shared/types/manifest'
import type { AggregatedProgress, BatchImportItem, ImportQueueItem } from '../shared/types/parallel-transcode'
import type {
  CqSearchOptions,
  CqSearchProgress,
  CqSearchResult,
  SampleConfig,
  VmafOptions,
  VmafResult,
} from '../shared/types/vmaf'
import type { RelatedAnimeData } from './ipc/franchise.handlers'
import type { ExportConfig } from './services/export-manager'
import type { ExternalAudioScanResult } from './services/external-audio-scanner'
import type { ExternalSubtitleScanResult } from './services/external-subtitle-scanner'
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
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),

    /** Получить системный путь */
    getPath: (name: string): Promise<string> => ipcRenderer.invoke('app:getPath', name),

    /** Получить количество ядер CPU */
    getCpuCount: (): Promise<number> => ipcRenderer.invoke('app:getCpuCount'),

    /** Получить информацию о диске */
    getDiskInfo: (
      targetPath?: string,
    ): Promise<{ total: number; free: number; used: number; usedPercent: number } | null> =>
      ipcRenderer.invoke('app:getDiskInfo', targetPath),

    /** Получить размер папки библиотеки (с кешированием, TTL 5 минут) */
    getLibrarySize: (libraryPath: string, forceRefresh?: boolean): Promise<number> =>
      ipcRenderer.invoke('app:getLibrarySize', libraryPath, forceRefresh),

    /** Инвалидировать кеш размера библиотеки (вызывать после импорта) */
    invalidateLibrarySizeCache: (): Promise<boolean> => ipcRenderer.invoke('app:invalidateLibrarySizeCache'),

    /** Показать системное уведомление */
    showNotification: (options: {
      title: string
      body: string
      type?: 'info' | 'success' | 'error'
    }): Promise<boolean> => ipcRenderer.invoke('app:showNotification', options),

    /** Получить состояние блокировки сна */
    getPowerSaveState: (): Promise<{
      isBlocking: boolean
      autoEnabled: boolean
      manualEnabled: boolean
    }> => ipcRenderer.invoke('app:getPowerSaveState'),

    /** Переключить ручную блокировку сна */
    togglePowerSaveManual: (): Promise<{
      isBlocking: boolean
      manualEnabled: boolean
    }> => ipcRenderer.invoke('app:togglePowerSaveManual'),

    /** Установить авто-блокировку при транскодировании */
    setPowerSaveAuto: (enabled: boolean): Promise<{ autoEnabled: boolean }> =>
      ipcRenderer.invoke('app:setPowerSaveAuto', enabled),

    /** Установить блокировку сна при воспроизведении видео */
    setPowerSavePlayback: (isPlaying: boolean): Promise<{ isBlocking: boolean }> =>
      ipcRenderer.invoke('app:setPowerSavePlayback', isPlaying),
  },

  // === Управление окном (frameless title bar) ===
  window: {
    /** Минимизировать окно */
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),

    /** Максимизировать / Восстановить окно */
    maximize: (): Promise<boolean> => ipcRenderer.invoke('window:maximize'),

    /** Закрыть окно */
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),

    /** Проверить, максимизировано ли окно */
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),

    /** Получить платформу (для позиционирования кнопок) */
    getPlatform: (): Promise<'win32' | 'darwin' | 'linux'> => ipcRenderer.invoke('window:getPlatform'),

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
    selectFile: (filters?: FileFilter[]): Promise<string | null> => ipcRenderer.invoke('dialog:selectFile', filters),

    /** Открыть диалог выбора нескольких файлов */
    selectFiles: (filters?: FileFilter[]): Promise<string[]> => ipcRenderer.invoke('dialog:selectFiles', filters),

    /** Открыть диалог выбора папки */
    selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),

    /** Открыть диалог сохранения файла */
    saveFile: (defaultName?: string, filters?: FileFilter[]): Promise<string | null> =>
      ipcRenderer.invoke('dialog:saveFile', defaultName, filters),
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
    stat: (filePath: string): Promise<{ success: boolean; size: number; mtime?: Date; error?: string }> =>
      ipcRenderer.invoke('fs:stat', filePath),

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
    getDefaultPath: (): Promise<string> => ipcRenderer.invoke('library:getDefaultPath'),

    /** Получить путь к папке эпизода */
    resolveOutputPath: (options: {
      libraryPath: string
      animeName: string
      seasonNumber: number
      episodeNumber: number
    }): Promise<string> => ipcRenderer.invoke('library:resolveOutputPath', options),

    /** Создать структуру папок для эпизода */
    ensureEpisodeDirectory: (options: {
      libraryPath: string
      animeName: string
      seasonNumber: number
      episodeNumber: number
    }): Promise<string> => ipcRenderer.invoke('library:ensureEpisodeDirectory', options),

    /** Создать папку для аниме (для постера и других общих файлов) */
    ensureAnimeDirectory: (libraryPath: string, animeName: string): Promise<string> =>
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
    downloadPoster: (
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
    }> => ipcRenderer.invoke('shikimori:downloadPoster', posterUrl, animeId, options),

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

    /** Обновить thumbnails в манифесте */
    updateThumbnails: (
      manifestPath: string,
      thumbnails: {
        vttPath: string
        spritePath: string
      },
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('manifest:updateThumbnails', manifestPath, thumbnails),
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
    generateScreenshots: (
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
    }> => ipcRenderer.invoke('ffmpeg:generateScreenshots', inputPath, outputDir, duration, options),

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
    ): Promise<{
      success: boolean
      spritePath: string
      vttPath: string
      spriteSize: number
      error?: string
    }> => ipcRenderer.invoke('ffmpeg:generateThumbnailSprite', inputPath, outputDir, duration, options),

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
      callback: (trackId: string, outputPath: string, episodeId: string) => void,
    ): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, trackId: string, outputPath: string, episodeId: string) =>
        callback(trackId, outputPath, episodeId)
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

  // === Экспорт сериала в MKV ===
  export: {
    /** Запустить экспорт сериала */
    start: (config: ExportConfig): Promise<ExportResult> => ipcRenderer.invoke('export:start', config),

    /** Отменить текущий экспорт */
    cancel: (): Promise<{ success: boolean }> => ipcRenderer.invoke('export:cancel'),

    /** Получить текущий прогресс */
    getProgress: (): Promise<SeriesExportProgress> => ipcRenderer.invoke('export:getProgress'),

    /** Проверить, активен ли экспорт */
    isActive: (): Promise<boolean> => ipcRenderer.invoke('export:isActive'),

    /** Подписка на прогресс экспорта */
    onProgress: (callback: (progress: SeriesExportProgress) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, progress: SeriesExportProgress) => callback(progress)
      ipcRenderer.on('export:progress', handler)
      return () => ipcRenderer.removeListener('export:progress', handler)
    },

    /** Подписка на завершение экспорта */
    onCompleted: (callback: (result: ExportResult) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, result: ExportResult) => callback(result)
      ipcRenderer.on('export:completed', handler)
      return () => ipcRenderer.removeListener('export:completed', handler)
    },

    /** Подписка на ошибку экспорта */
    onError: (callback: (error: string) => void): () => void => {
      const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error)
      ipcRenderer.on('export:error', handler)
      return () => ipcRenderer.removeListener('export:error', handler)
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
    getStatus: (): Promise<{
      status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
      updateInfo: { version: string; releaseDate: string; releaseNotes?: string } | null
      downloadProgress: number
      error: string | null
      downloadSpeed: number
      downloadEta: number
    }> => ipcRenderer.invoke('updater:status'),

    /** Получить версию приложения */
    getVersion: (): Promise<string> => ipcRenderer.invoke('updater:version'),

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
}

// Экспортируем API в renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Типы для TypeScript в renderer
export type ElectronAPI = typeof electronAPI

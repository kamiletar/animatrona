/**
 * Типы для системы импорта аниме
 */

import type { ParsedFile } from '@/components/import/FileScanStep'
import type { FileAnalysis, ImportSettings } from '@/components/import/PreviewStep'
import type { RelationKind } from '@/generated/prisma'
import type { ShikimoriAnimeDetails, ShikimoriAnimeExtended, ShikimoriAnimePreview } from '@/types/electron'
import type { DemuxResult } from '../../../../shared/types'
import type { AggregatedProgress } from '../../../../shared/types/parallel-transcode'
import type { ParsedFolderInfo } from '../shikimori/parse-folder'

/**
 * Тип для выбранного аниме в импорте.
 * Может быть Preview (базовый поиск), Details (с synonyms после загрузки деталей)
 * или Extended (с fandubbers, fansubbers, studios и т.д.).
 */
export type SelectedAnime = ShikimoriAnimePreview | ShikimoriAnimeDetails | ShikimoriAnimeExtended

/** Стадии обработки импорта (должно совпадать с ProcessingStep.tsx) */
export type ProcessingStage =
  | 'idle'
  | 'creating_anime'
  | 'creating_season'
  | 'demuxing'
  | 'creating_episodes'
  | 'transcoding_video'
  | 'transcoding_audio'
  | 'generating_manifests'
  | 'syncing_relations'
  | 'done'
  | 'error'
  | 'cancelled'

/** Данные для пост-обработки эпизода (скриншоты + манифест) */
export interface PostProcessData {
  episodeId: string
  outputDir: string
  videoOutputPath: string
  duration: number
  demuxResult: DemuxResult
  animeName: string
  seasonNumber: number
  episodeNumber: number
  sourcePath: string
  /** Размер исходного файла в байтах */
  sourceSize?: number
  /** ID профиля кодирования */
  encodingProfileId?: string
  /** Название профиля кодирования */
  encodingProfileName?: string
  /** Настройки кодирования */
  videoOptions?: {
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
  }
  // Новые поля v0.10.0
  /** VMAF скор (если был подобран) */
  vmafScore?: number
  /** Тип энкодера: GPU или CPU */
  encoderType?: 'gpu' | 'cpu'
  /** Модель оборудования (RTX 5080, AMD Ryzen 9 7950X и т.д.) */
  hardwareModel?: string
  /** Полная FFmpeg команда для воспроизведения энкода */
  ffmpegCommand?: string
  /** Версия FFmpeg */
  ffmpegVersion?: string
  /** Время транскодирования в миллисекундах */
  transcodeDurationMs?: number
  /** Количество активных GPU потоков во время кодирования */
  activeGpuWorkers?: number
  /** Максимальный лимит видео потоков при кодировании */
  videoMaxConcurrent?: number
  /** Максимальный лимит аудио потоков при кодировании */
  audioMaxConcurrent?: number
}

/** Результат импорта */
export interface ImportResult {
  success: boolean
  animeId?: string
  episodeCount?: number
  error?: string
}

/** Опции импорта */
export interface ImportOptions {
  folderPath: string
  parsedInfo: ParsedFolderInfo
  selectedAnime: SelectedAnime
  files: ParsedFile[]
  /** ID элемента в очереди импорта (для группировки статистики per-anime) */
  queueItemId?: string
  /** Результаты анализа с настройками */
  fileAnalyses?: FileAnalysis[]
  /** Настройки импорта (профиль кодирования + потоки) */
  importSettings?: ImportSettings
  /** Путь к папке донора (если используется) */
  donorPath?: string | null
  /** Файлы донора */
  donorFiles?: ParsedFile[]
  /** Смещение синхронизации донора в мс */
  syncOffset?: number
  /** Использовать CPU кодирование (из VMAF результата) */
  useCpuFallback?: boolean
  /** VMAF скор (если был подобран) */
  vmafScore?: number
}

/** Расширенная информация о прогрессе транскодирования */
export interface ExtendedTranscodeProgress {
  percent: number
  fps?: number
  speed?: number
  bitrate?: number
  size?: number
  elapsedMs?: number
}

/** Прогресс отдельной аудиодорожки */
export interface AudioTrackProgress {
  trackId: string
  title: string
  language: string
  percent: number
  status: 'pending' | 'transcoding' | 'completed' | 'error'
  error?: string
}

/** Состояние импорта */
export interface ImportState {
  stage: ProcessingStage
  currentFile: number
  totalFiles: number
  currentFileName: string | null
  error: string | null
  /** Прогресс текущего транскодирования (общий) */
  transcodeProgress: ExtendedTranscodeProgress | null
  /** Количество аудиодорожек в текущем файле */
  audioTracksTotal: number
  /** Завершённых аудиодорожек */
  audioTracksCompleted: number
  /** Прогресс каждой аудиодорожки */
  audioTracksProgress: AudioTrackProgress[]
  /** Текущая обрабатываемая аудиодорожка (deprecated, для совместимости) */
  audioTrackCurrent: number
  /** Параллельный прогресс (для UI с dual encoders) */
  parallelProgress: AggregatedProgress | null
}

/** Начальное состояние импорта */
export const initialImportState: ImportState = {
  stage: 'idle',
  currentFile: 0,
  totalFiles: 0,
  currentFileName: null,
  error: null,
  transcodeProgress: null,
  audioTracksTotal: 0,
  audioTracksCompleted: 0,
  audioTracksProgress: [],
  audioTrackCurrent: 0,
  parallelProgress: null,
}

/** Действия для reducer импорта */
export type ImportAction =
  | { type: 'RESET' }
  | { type: 'SET_STAGE'; stage: ProcessingStage }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_FILE_PROGRESS'; currentFile: number; totalFiles: number; currentFileName: string | null }
  | { type: 'SET_TRANSCODE_PROGRESS'; progress: ExtendedTranscodeProgress | null }
  | { type: 'SET_AUDIO_TRACKS'; total: number; tracks: AudioTrackProgress[] }
  | { type: 'UPDATE_AUDIO_TRACK'; trackId: string; percent: number; status?: AudioTrackProgress['status'] }
  | { type: 'COMPLETE_AUDIO_TRACK'; trackId: string }
  | { type: 'SET_PARALLEL_PROGRESS'; progress: AggregatedProgress | null }

/** Метаданные о кодировании видео */
export interface VideoEncodingMeta {
  ffmpegCommand?: string
  transcodeDurationMs?: number
  activeGpuWorkers?: number
}

/** Refs для отслеживания состояния импорта */
export interface ImportRefs {
  /** Время начала транскодирования */
  transcodeStartTime: React.MutableRefObject<number | null>
  /** ID созданного аниме (для отката) */
  createdAnimeId: React.MutableRefObject<string | null>
  /** Путь к папке созданного аниме (для удаления) */
  createdAnimeFolder: React.MutableRefObject<string | null>
  /** Флаг отмены */
  isCancelled: React.MutableRefObject<boolean>
  /** Метаданные кодирования для каждого эпизода (episodeId → meta) */
  videoEncodingMeta: React.MutableRefObject<Map<string, VideoEncodingMeta>>
}

/** Связь между аниме */
export interface AnimeRelation {
  relatedAnimeId: string
  kind: RelationKind
}

/** Внешняя дорожка (аудио или субтитры) */
export interface ExternalTrack {
  type: 'audio' | 'subtitle'
  path: string
  language?: string
  title?: string
}

/** Результат сопоставления файлов донора с оригиналом */
export interface DonorMatchInfo {
  matched: number
  unmatched: number
  total: number
}

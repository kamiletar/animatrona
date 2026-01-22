/**
 * Типы для компонентов PreviewStep
 */

import type { EncodingProfile } from '@/generated/prisma'

import type { MediaInfo } from '../../../../../shared/types'
import type { ParsedFile } from '../FileScanStep'

/** Настройки импорта (профиль + потоки) */
export interface ImportSettings {
  /** ID выбранного профиля кодирования */
  profileId: string | null
  /** Полные данные профиля (для передачи в main process) */
  selectedProfile?: EncodingProfile | null
  /** Макс. количество параллельных аудио-потоков */
  audioMaxConcurrent: number
  /** Макс. количество параллельных видео-потоков (GPU NVENC) */
  videoMaxConcurrent: number
  /** Переопределённый CQ из VMAF авто-поиска */
  cqOverride?: number
  /** Требуется CPU fallback (GPU недоступен для контента) */
  useCpuFallback?: boolean
  /** Включить VMAF подбор CQ перед кодированием (в очереди) */
  vmafEnabled?: boolean
  /** Целевой VMAF для подбора CQ (по умолчанию 94) */
  targetVmaf?: number
}

/** Рекомендация для аудиодорожки */
export interface AudioRecommendation {
  trackIndex: number
  action: 'transcode' | 'skip'
  reason: string
  enabled: boolean
  /** Внешний файл? */
  isExternal?: boolean
  /** Путь к внешнему файлу */
  externalPath?: string
  /** Название группы (озвучки) для внешних аудио */
  groupName?: string
  /** Язык аудиодорожки (ru, en, ja и т.д.) */
  language?: string
}

/** Рекомендация для субтитров */
export interface SubtitleRecommendation {
  /** Индекс потока (или -1 для внешних) */
  streamIndex: number
  /** Язык */
  language: string
  /** Название */
  title: string
  /** Формат (ass, srt, vtt) */
  format: string
  /** Внешний файл? */
  isExternal: boolean
  /** Путь к внешнему файлу */
  externalPath?: string
  /** Шрифты (для ASS) */
  matchedFonts?: Array<{ name: string; path: string }>
  /** Включен для импорта */
  enabled: boolean
}

/** Результат анализа файла (используем probe, не demux) */
export interface FileAnalysis {
  file: ParsedFile
  mediaInfo: MediaInfo | null
  isAnalyzing: boolean
  error: string | null
  audioRecommendations: AudioRecommendation[]
  subtitleRecommendations: SubtitleRecommendation[]
}

/** Props для PreviewStep */
export interface PreviewStepProps {
  /** Выбранные файлы */
  files: ParsedFile[]
  /** Путь к папке с файлами (для сканирования внешних субтитров) */
  folderPath: string
  /** Обратный вызов при изменении анализа */
  onAnalysisComplete: (analyses: FileAnalysis[]) => void
  /** Обратный вызов при изменении настроек импорта */
  onSettingsChange?: (settings: ImportSettings) => void
}

/** Props для FileCard */
export interface FileCardProps {
  analysis: FileAnalysis
  folderPath: string
  onToggleTrack: (fileIndex: number, trackIndex: number, enabled: boolean) => void
  onToggleSubtitle: (episodeNumber: number, subtitleIndex: number, enabled: boolean) => void
}

/** Опции видео для VMAF теста */
export interface VideoOptionsForVmaf {
  codec: 'av1' | 'hevc' | 'h264'
  useGpu: boolean
  preset: 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'p7'
}

/** Состояние настроек кодирования */
export interface EncodingSettingsState {
  profiles: EncodingProfile[]
  selectedProfileId: string | null
  isLoadingProfiles: boolean
  audioMaxConcurrent: number
  videoMaxConcurrent: number
}

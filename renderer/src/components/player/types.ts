/**
 * Типы для VideoPlayer компонента
 */

import type { AudioTranscodeStatus } from '../../../../shared/types/manifest'

/** Аудиодорожка с информацией о транскодировании */
export interface AudioTrackInfo {
  id: string
  language: string
  title?: string
  codec: string
  channels: string
  isDefault: boolean
  /** Путь к транскодированному/skipped файлу */
  transcodedPath?: string
  /** Статус транскодирования */
  transcodeStatus: AudioTranscodeStatus
}

/** Информация о видео для оверлея (I) */
export interface VideoMetadata {
  /** Кодек видео (AV1, HEVC, H.264) */
  videoCodec?: string
  /** Ширина видео */
  videoWidth?: number
  /** Высота видео */
  videoHeight?: number
  /** Битрейт видео (bps) */
  videoBitrate?: number
  /** Битность видео (8, 10, 12) */
  videoBitDepth?: number
  /** Кодек аудио */
  audioCodec?: string
  /** Битрейт аудио */
  audioBitrate?: number
  /** Каналы аудио */
  audioChannels?: number
  /** Формат субтитров */
  subtitleFormat?: string
  /** Язык субтитров */
  subtitleLanguage?: string
  /** Размер файла (байты) */
  fileSize?: number
}

/** Пропсы компонента VideoPlayer */
export interface VideoPlayerProps {
  /** Путь к видеофайлу (локальный путь или URL) */
  src: string
  /** Метаданные видео для оверлея (I) */
  videoMetadata?: VideoMetadata
  /** Автоматически начать воспроизведение */
  autoPlay?: boolean
  /** Начальная позиция в секундах */
  startTime?: number
  /** Показывать контролы */
  showControls?: boolean
  /** Обработчик изменения времени */
  onTimeUpdate?: (currentTime: number, duration: number) => void
  /** Обработчик окончания видео */
  onEnded?: () => void
  /** Обработчик ошибки */
  onError?: (error: Error) => void
  /** Обработчик изменения состояния воспроизведения */
  onPlayStateChange?: (isPlaying: boolean) => void
  /** Аудиодорожки (для режима раздельных дорожек) */
  audioTracks?: AudioTrackInfo[]
  /** ID текущей аудиодорожки */
  currentAudioTrackId?: string
  /** Обработчик смены аудиодорожки */
  onAudioTrackChange?: (trackId: string) => void
  /** Путь к файлу субтитров */
  subtitlePath?: string | null
  /** Шрифты для субтитров */
  subtitleFonts?: string[]
  /** Главы для маркеров на прогресс-баре */
  chapters?: Array<{ id: string; title: string; startTime: number }>
  /** Переход к главе */
  onChapterSeek?: (time: number) => void
  /** Есть предыдущий эпизод */
  hasPrevEpisode?: boolean
  /** Есть следующий эпизод */
  hasNextEpisode?: boolean
  /** Переход к предыдущему эпизоду */
  onPrevEpisode?: () => void
  /** Переход к следующему эпизоду */
  onNextEpisode?: () => void
  /** Tooltip для предыдущего эпизода */
  prevEpisodeTooltip?: string
  /** Tooltip для следующего эпизода */
  nextEpisodeTooltip?: string
  /** Контент для левой части верхней панели (кнопка назад, название) */
  headerLeft?: React.ReactNode
  /** Контент для центра верхней панели (информация об эпизоде) */
  headerCenter?: React.ReactNode
  /** Контент для правой части верхней панели (выбор дорожек) */
  headerRight?: React.ReactNode
}

/** Публичный API плеера */
export interface VideoPlayerRef {
  play: () => void
  pause: () => void
  seek: (time: number) => void
  getCurrentTime: () => number
  getDuration: () => number
  setVolume: (volume: number) => void
  getVolume: () => number
  toggleFullscreen: () => void
  /** Получить video элемент (для синхронизации внешнего аудио) */
  getVideoElement: () => HTMLVideoElement | null
}

/** Состояние плеера */
export interface PlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isFullscreen: boolean
  isLoading: boolean
  showControlsOverlay: boolean
}

/** Тип формата субтитров */
export type SubtitleFormat = 'ass' | 'native' | null

/**
 * Утилитные функции для PreviewStep
 */

import type { AudioTrack } from '../../../../../shared/types'

/**
 * Форматирует размер файла
 */
export function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes === 0) {
    return '0 B'
  }
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

/**
 * Форматирует длительность
 */
export function formatDuration(seconds: number | undefined): string {
  if (!seconds || seconds === 0) {
    return '0:00'
  }
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Форматирует битрейт
 */
export function formatBitrate(bps: number | undefined): string {
  if (!bps || bps === 0) {
    return 'N/A'
  }
  return `${Math.round(bps / 1000)} kbps`
}

/**
 * Форматирует каналы
 */
export function formatChannels(channels: number): string {
  switch (channels) {
    case 1:
      return 'Mono'
    case 2:
      return 'Stereo'
    case 6:
      return '5.1'
    case 8:
      return '7.1'
    default:
      return `${channels}ch`
  }
}

/**
 * Получить относительный путь к файлу
 */
export function getRelativePath(fullPath: string, basePath: string): string {
  const normalized = fullPath.replace(/\\/g, '/')
  const normalizedBase = basePath.replace(/\\/g, '/')
  if (normalized.startsWith(normalizedBase)) {
    return normalized.slice(normalizedBase.length).replace(/^\//, '')
  }
  // Fallback: только имя файла
  return fullPath.split(/[/\\]/).pop() || fullPath
}

/**
 * Определяет рекомендацию для аудиодорожки
 */
export function getAudioRecommendation(track: AudioTrack): { action: 'transcode' | 'skip'; reason: string } {
  const codec = (track.codec || 'unknown').toLowerCase()
  const bitrate = track.bitrate || 0

  // AAC с битрейтом ≤ 256 kbps — не нужно транскодировать
  if (codec === 'aac' && bitrate > 0 && bitrate <= 256000) {
    return {
      action: 'skip',
      reason: `AAC ${formatBitrate(bitrate)} — уже оптимально`,
    }
  }

  // Opus — обычно не нужно транскодировать
  if (codec === 'opus') {
    return {
      action: 'skip',
      reason: 'Opus — современный кодек',
    }
  }

  // FLAC, PCM — нужно транскодировать
  if (codec === 'flac' || codec.includes('pcm')) {
    return {
      action: 'transcode',
      reason: `${codec.toUpperCase()} → AAC 256 kbps`,
    }
  }

  // AC3, DTS — высокий битрейт
  if (codec === 'ac3' || codec === 'eac3' || codec === 'dts') {
    return {
      action: 'transcode',
      reason: `${codec.toUpperCase()} ${formatBitrate(bitrate)} → AAC 256 kbps`,
    }
  }

  // AAC с высоким битрейтом
  if (codec === 'aac' && bitrate > 256000) {
    return {
      action: 'transcode',
      reason: `AAC ${formatBitrate(bitrate)} → AAC 256 kbps`,
    }
  }

  // По умолчанию — транскодировать
  return {
    action: 'transcode',
    reason: `${codec.toUpperCase()} → AAC 256 kbps`,
  }
}

/**
 * Получить количество ядер CPU
 */
export function getCpuCount(): number {
  // В Electron доступно через API, но fallback на 4
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
    return navigator.hardwareConcurrency
  }
  return 4
}

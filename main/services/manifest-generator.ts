/**
 * Генератор манифестов для эпизодов
 * Создаёт JSON файл с метаданными для плеера
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import type { Chapter as DemuxChapter, DemuxResult } from '../../shared/types'
import type {
  EpisodeManifest,
  GenerateManifestOptions,
  GenerateManifestResult,
  MANIFEST_VERSION,
  ManifestAudioTrack,
  ManifestChapter,
  ManifestChapterType,
  ManifestSubtitleFont,
  ManifestSubtitleTrack,
  ManifestVideo,
  TrackOverride,
} from '../../shared/types/manifest'
import { matchFonts } from './font-matcher'
import { getFontsFromASS } from './subtitle-parser'

/**
 * Определяет тип главы по названию
 */
function detectChapterType(title: string): ManifestChapterType {
  const lowerTitle = title.toLowerCase()

  // Опенинг
  if (lowerTitle.includes('open') || lowerTitle.includes('op') || lowerTitle.includes('opening')) {
    return 'op'
  }

  // Эндинг
  if (lowerTitle.includes('end') || lowerTitle.includes('ed') || lowerTitle.includes('ending')) {
    return 'ed'
  }

  // Рекап
  if (lowerTitle.includes('recap') || lowerTitle.includes('summary') || lowerTitle.includes('previous')) {
    return 'recap'
  }

  // Превью следующей серии
  if (lowerTitle.includes('preview') || lowerTitle.includes('next')) {
    return 'preview'
  }

  return 'chapter'
}

/**
 * Определяет, можно ли пропустить главу
 */
function isChapterSkippable(type: ManifestChapterType): boolean {
  return type === 'op' || type === 'ed' || type === 'recap' || type === 'preview'
}

/**
 * Конвертирует секунды в миллисекунды
 */
function secToMs(seconds: number): number {
  return Math.round(seconds * 1000)
}

/**
 * Преобразует каналы в строковый формат
 */
function formatChannels(channels: number): string {
  switch (channels) {
    case 1:
      return '1.0'
    case 2:
      return '2.0'
    case 6:
      return '5.1'
    case 8:
      return '7.1'
    default:
      return `${channels}.0`
  }
}

/**
 * Извлекает шрифты для ASS субтитров
 * Парсит ASS файл и сопоставляет с извлечёнными шрифтами из MKV
 */
function getSubtitleFonts(subtitlePath: string, fontsDir: string | null): ManifestSubtitleFont[] | undefined {
  // Только для ASS/SSA форматов
  const ext = path.extname(subtitlePath).toLowerCase()
  if (ext !== '.ass' && ext !== '.ssa') {
    return undefined
  }

  // Если нет папки шрифтов — нечего сопоставлять
  if (!fontsDir || !fs.existsSync(fontsDir)) {
    return undefined
  }

  try {
    // Получаем имена шрифтов из ASS файла
    const fontNames = getFontsFromASS(subtitlePath)
    if (fontNames.length === 0) {
      return undefined
    }

    // Сопоставляем с файлами шрифтов
    const matchedPaths = matchFonts(fontsDir, fontNames)
    if (matchedPaths.length === 0) {
      return undefined
    }

    // Преобразуем в ManifestSubtitleFont[]
    // matchFonts возвращает пути, нужно извлечь имена
    return matchedPaths.map((fontPath) => ({
      name: path.basename(fontPath, path.extname(fontPath)),
      path: fontPath,
    }))
  } catch {
    // Ошибка парсинга — возвращаем undefined
    return undefined
  }
}

/**
 * Находит переопределение для дорожки по streamIndex
 */
function findTrackOverride(overrides: TrackOverride[] | undefined, streamIndex: number): TrackOverride | undefined {
  return overrides?.find((o) => o.streamIndex === streamIndex)
}

/**
 * Генерирует манифест из результатов demux
 */
export function generateManifestFromDemux(
  demuxResult: DemuxResult,
  options: GenerateManifestOptions,
): GenerateManifestResult {
  try {
    const { episodeId, outputDir, animeInfo, audioTrackOverrides, subtitleTrackOverrides } = options

    // Проверяем наличие видео
    if (!demuxResult.video) {
      return { success: false, error: 'Видеопоток не найден в результатах demux' }
    }

    // Генерируем информацию о видео
    const video: ManifestVideo = {
      path: demuxResult.video.path,
      durationMs: secToMs(demuxResult.video.duration),
      width: demuxResult.video.width,
      height: demuxResult.video.height,
      codec: demuxResult.video.codec,
      bitrate: demuxResult.video.bitrate,
    }

    // Генерируем аудиодорожки с применением переопределений из UI
    const audioTracks: ManifestAudioTrack[] = demuxResult.audioTracks.map((track, index) => {
      const override = findTrackOverride(audioTrackOverrides, track.index)
      return {
        id: `audio-${track.index}`,
        streamIndex: track.index,
        // Приоритет: override > demuxResult > fallback
        language: override?.language || track.language || 'und',
        title: track.title || `Audio ${index + 1}`,
        codec: track.codec,
        channels: formatChannels(track.channels),
        bitrate: track.bitrate,
        isDefault: index === 0, // Первая дорожка по умолчанию
        extractedPath: track.path,
        // Пути к транскодированным файлам будут обновлены позже из БД
        transcodedPath: undefined,
        // Статус по умолчанию — queued, будет обновлён после транскодирования
        transcodeStatus: 'queued' as const,
        // Группа озвучки из UI (AniDUB, AniLibria и т.д.)
        dubGroup: override?.dubGroup,
      }
    })

    // Генерируем субтитры с шрифтами и переопределениями из UI
    const subtitleTracks: ManifestSubtitleTrack[] = demuxResult.subtitles.map((track, index) => {
      const override = findTrackOverride(subtitleTrackOverrides, track.index)
      return {
        id: `sub-${track.index}`,
        streamIndex: track.index,
        // Приоритет: override > demuxResult > fallback
        language: override?.language || track.language || 'und',
        title: track.title || `Subtitles ${index + 1}`,
        format: track.format,
        filePath: track.path,
        isDefault: index === 0,
        // Извлекаем шрифты из ASS файлов и сопоставляем с fontsDir
        fonts: getSubtitleFonts(track.path, demuxResult.fontsDir),
        // Группа субтитров из UI (HorribleSubs, FanSub Team и т.д.)
        dubGroup: override?.dubGroup,
      }
    })

    // Генерируем главы
    const chapters: ManifestChapter[] = demuxResult.metadata.chapters.map((chapter: DemuxChapter) => {
      const type = detectChapterType(chapter.title)
      return {
        startMs: secToMs(chapter.start),
        endMs: secToMs(chapter.end),
        title: chapter.title,
        type,
        skippable: isChapterSkippable(type),
      }
    })

    // Собираем манифест
    const manifest: EpisodeManifest = {
      version: 1 as typeof MANIFEST_VERSION,
      episodeId,
      info: animeInfo,
      video,
      audioTracks,
      subtitleTracks,
      chapters,
      // thumbnails и navigation обновляются после генерации через updateManifest*
      generatedAt: new Date().toISOString(),
    }

    // Записываем манифест в файл
    const manifestFileName = 'manifest.json'
    const manifestPath = path.join(outputDir, manifestFileName)

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

    return {
      success: true,
      manifestPath,
      manifest,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Читает существующий манифест
 */
export function readManifest(manifestPath: string): EpisodeManifest | null {
  try {
    if (!fs.existsSync(manifestPath)) {
      return null
    }

    const content = fs.readFileSync(manifestPath, 'utf-8')
    return JSON.parse(content) as EpisodeManifest
  } catch {
    return null
  }
}

/**
 * Обновляет навигацию в манифесте
 */
export function updateManifestNavigation(manifestPath: string, navigation: EpisodeManifest['navigation']): boolean {
  try {
    const manifest = readManifest(manifestPath)
    if (!manifest) {
      return false
    }

    manifest.navigation = navigation
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * Обновляет thumbnails в манифесте
 */
export function updateManifestThumbnails(manifestPath: string, thumbnails: EpisodeManifest['thumbnails']): boolean {
  try {
    const manifest = readManifest(manifestPath)
    if (!manifest) {
      return false
    }

    manifest.thumbnails = thumbnails
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * Обновляет информацию о кодировании в манифесте
 */
export function updateManifestEncoding(manifestPath: string, encoding: EpisodeManifest['encoding']): boolean {
  try {
    const manifest = readManifest(manifestPath)
    if (!manifest) {
      return false
    }

    manifest.encoding = encoding
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * FFmpeg Demux модуль — извлечение потоков из контейнера без перекодирования
 */

import { mkdir, stat, writeFile } from 'fs/promises'
import path from 'path'
import type {
  Chapter,
  DemuxedAudio,
  DemuxedMetadata,
  DemuxedSubtitle,
  DemuxedVideo,
  DemuxOptions,
  DemuxResult,
} from '../shared/types'
import { spawnFFmpeg, spawnFFprobe } from '../utils/ffmpeg-spawn'
import { extractBitrate, getBitDepth, getLanguageName, needsAudioTranscode } from './utils'

/** Типизация для ffprobe JSON вывода */
interface FFProbeOutput {
  format?: {
    format_name?: string
    duration?: string
    size?: string
    bit_rate?: string
    tags?: Record<string, string>
  }
  streams?: Array<{
    index: number
    codec_type: 'video' | 'audio' | 'subtitle' | 'attachment'
    codec_name?: string
    width?: number
    height?: number
    bit_rate?: string
    r_frame_rate?: string
    channels?: number
    sample_rate?: string
    /** Формат пикселей (yuv420p, yuv420p10le и т.д.) */
    pix_fmt?: string
    /** Теги потока — могут содержать BPS для MKV */
    tags?: {
      language?: string
      title?: string
      /** Имя файла для attachments (шрифты) */
      filename?: string
      /** MIME тип для attachments */
      mimetype?: string
      /** Битрейт в bps (часто в MKV) */
      BPS?: string
      /** Битрейт с языковым суффиксом */
      'BPS-eng'?: string
      /** Другие теги */
      [key: string]: string | undefined
    }
  }>
  chapters?: Array<{
    start_time: string
    end_time: string
    tags?: { title?: string }
  }>
}

/**
 * Получить полную информацию через ffprobe (JSON формат)
 */
async function getFullProbe(inputPath: string): Promise<FFProbeOutput> {
  return new Promise((resolve, reject) => {
    const ff = spawnFFprobe([
      '-v',
      'error',
      '-show_format',
      '-show_streams',
      '-show_chapters',
      '-of',
      'json',
      inputPath,
    ])

    let data = ''
    let stderr = ''

    ff.stdout.on('data', (chunk) => {
      data += chunk.toString()
    })

    ff.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    ff.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe error: ${stderr}`))
      }
      try {
        resolve(JSON.parse(data))
      } catch (e) {
        reject(new Error(`ffprobe JSON parse error: ${e}`))
      }
    })

    ff.on('error', reject)
  })
}

/**
 * Извлечь поток с помощью ffmpeg (без перекодирования)
 */
async function extractStream(inputPath: string, outputPath: string, streamSpec: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawnFFmpeg(['-y', '-i', inputPath, '-map', streamSpec, '-c', 'copy', outputPath])

    let stderr = ''

    ff.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    ff.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg extract error: ${stderr}`))
      }
    })

    ff.on('error', reject)
  })
}

/**
 * Получить размер файла
 */
async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await stat(filePath)
    return stats.size
  } catch {
    return 0
  }
}

/** Расширения файлов шрифтов */
const FONT_EXTENSIONS = ['.ttf', '.otf', '.ttc', '.woff', '.woff2']

/**
 * Извлечь attachments (шрифты) из MKV контейнера
 * Использует -dump_attachment для каждого attachment stream
 */
async function extractAttachments(
  inputPath: string,
  outputDir: string,
  streams: FFProbeOutput['streams']
): Promise<string | null> {
  // Находим attachment streams (шрифты)
  const attachmentStreams =
    streams?.filter((s) => {
      if (s.codec_type !== 'attachment') return false
      const filename = s.tags?.filename?.toLowerCase() || ''
      return FONT_EXTENSIONS.some((ext) => filename.endsWith(ext))
    }) || []

  if (attachmentStreams.length === 0) {
    return null
  }

  // Создаём папку для шрифтов
  const fontsDir = path.join(outputDir, 'fonts')
  await mkdir(fontsDir, { recursive: true })

  // Извлекаем каждый шрифт
  // FFmpeg: -dump_attachment:t:N filename -i input.mkv
  // Важно: -dump_attachment должен быть ПЕРЕД -i
  const args: string[] = ['-y']

  // Счётчик attachment потоков (не общих потоков)
  let attachmentIndex = 0
  for (const stream of streams || []) {
    if (stream.codec_type === 'attachment') {
      const filename = stream.tags?.filename
      if (filename && FONT_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext))) {
        const outputPath = path.join(fontsDir, filename)
        args.push(`-dump_attachment:t:${attachmentIndex}`, outputPath)
      }
      attachmentIndex++
    }
  }

  args.push('-i', inputPath)

  return new Promise((resolve) => {
    const ff = spawnFFmpeg(args)

    let stderr = ''
    ff.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    ff.on('close', (code) => {
      if (code === 0) {
        resolve(fontsDir)
      } else {
        // Не критическая ошибка — шрифты просто не извлеклись
        console.warn(`[Demux] Failed to extract attachments: ${stderr}`)
        resolve(null)
      }
    })

    ff.on('error', () => {
      resolve(null)
    })
  })
}

/**
 * Демультиплексирование видеофайла
 * Разделяет контейнер на отдельные потоки без перекодирования
 */
export async function demuxFile(
  inputPath: string,
  outputDir: string,
  options: DemuxOptions = {}
): Promise<DemuxResult> {
  const { extractSubs = true, extractChapters = true, skipVideo = false, audioExtractMode = 'all' } = options

  try {
    // Создаём выходную директорию
    await mkdir(outputDir, { recursive: true })

    // Получаем полную информацию о файле
    const probeData = await getFullProbe(inputPath)
    const streams = probeData.streams || []
    const format = probeData.format

    // Получаем размер исходного файла
    const sourceSize = await getFileSize(inputPath)

    // Результат
    let video: DemuxedVideo | null = null
    const audioTracks: DemuxedAudio[] = []
    const subtitles: DemuxedSubtitle[] = []

    // === Извлекаем видеопоток (или только метаданные если skipVideo=true) ===
    const videoStreams = streams.filter((s) => s.codec_type === 'video')
    if (videoStreams.length > 0) {
      const vs = videoStreams[0]

      // Парсим fps
      let fps: number | undefined
      if (vs.r_frame_rate) {
        const [num, den] = vs.r_frame_rate.split('/')
        fps = parseInt(num, 10) / parseInt(den || '1', 10)
      }

      if (skipVideo) {
        // Оптимизация: не извлекаем видео, используем исходный файл напрямую
        // Сохраняем только метаданные для транскодирования
        video = {
          path: inputPath, // Путь к ИСХОДНОМУ файлу
          codec: vs.codec_name || 'unknown',
          width: vs.width || 0,
          height: vs.height || 0,
          duration: format?.duration ? parseFloat(format.duration) : 0,
          size: sourceSize,
          fps,
          bitrate: extractBitrate(vs),
          bitDepth: getBitDepth(vs.pix_fmt),
        }
      } else {
        const videoPath = path.join(outputDir, 'video.mkv')

        await extractStream(inputPath, videoPath, '0:v:0')

        video = {
          path: videoPath,
          codec: vs.codec_name || 'unknown',
          width: vs.width || 0,
          height: vs.height || 0,
          duration: format?.duration ? parseFloat(format.duration) : 0,
          size: await getFileSize(videoPath),
          fps,
          bitrate: extractBitrate(vs),
          bitDepth: getBitDepth(vs.pix_fmt),
        }
      }
    }

    // === Извлекаем аудиодорожки ===
    const totalDuration = format?.duration ? parseFloat(format.duration) : 0
    const audioStreams = streams.filter((s) => s.codec_type === 'audio')
    for (let i = 0; i < audioStreams.length; i++) {
      const as = audioStreams[i]
      const lang = as.tags?.language || 'und'
      const codec = as.codec_name || 'unknown'
      const bitrate = extractBitrate(as)

      // Определяем нужно ли извлекать дорожку
      // 'all' — извлекать все (по умолчанию, обратная совместимость)
      // 'smart' — извлекать только те, что НЕ нужно транскодировать
      const shouldExtract = audioExtractMode === 'smart' ? !needsAudioTranscode(codec, bitrate ?? null) : true

      if (shouldExtract) {
        // Определяем расширение для веб-совместимости
        // AAC → .m4a (MP4 контейнер), MP3 → .mp3, остальные → .mka
        const ext = codec.toLowerCase() === 'aac' ? 'm4a' : codec.toLowerCase() === 'mp3' ? 'mp3' : 'mka'
        const audioPath = path.join(outputDir, `audio_${i}_${lang}.${ext}`)

        await extractStream(inputPath, audioPath, `0:a:${i}`)

        const audioSize = await getFileSize(audioPath)

        audioTracks.push({
          path: audioPath,
          index: i,
          codec,
          language: lang,
          title: as.tags?.title || getLanguageName(lang) || `Audio ${i + 1}`,
          channels: as.channels || 2,
          bitrate,
          duration: totalDuration,
          size: audioSize,
        })
      } else {
        // Не извлекаем — будет кодироваться напрямую из исходника

        audioTracks.push({
          path: null, // Не извлечено
          sourceFile: inputPath, // Кодировать из исходника
          index: i,
          codec,
          language: lang,
          title: as.tags?.title || getLanguageName(lang) || `Audio ${i + 1}`,
          channels: as.channels || 2,
          bitrate,
          duration: totalDuration,
          size: 0, // Не извлечено
        })
      }
    }

    // === Извлекаем субтитры ===
    if (extractSubs) {
      const subStreams = streams.filter((s) => s.codec_type === 'subtitle')
      for (let i = 0; i < subStreams.length; i++) {
        const ss = subStreams[i]
        const lang = ss.tags?.language || 'und'
        const codec = ss.codec_name || 'ass'

        // Определяем расширение по кодеку
        let ext = 'ass'
        if (codec === 'subrip' || codec === 'srt') {
          ext = 'srt'
        } else if (codec === 'webvtt') {
          ext = 'vtt'
        } else if (codec === 'ssa') {
          ext = 'ssa'
        }

        const subPath = path.join(outputDir, `subs_${i}_${lang}.${ext}`)

        try {
          await extractStream(inputPath, subPath, `0:s:${i}`)

          subtitles.push({
            path: subPath,
            index: i,
            format: ext,
            language: lang,
            title: ss.tags?.title || getLanguageName(lang) || `Subtitles ${i + 1}`,
            size: await getFileSize(subPath),
          })
        } catch {
          // Не удалось извлечь субтитры — пропускаем
        }
      }
    }

    // === Извлекаем главы ===
    const chapters: Chapter[] = []
    if (extractChapters && probeData.chapters) {
      for (const ch of probeData.chapters) {
        chapters.push({
          start: parseFloat(ch.start_time),
          end: parseFloat(ch.end_time),
          title: ch.tags?.title || 'Chapter',
        })
      }
    }

    // === Извлекаем шрифты (attachments) ===
    const fontsDir = await extractAttachments(inputPath, outputDir, streams)

    // === Сохраняем метаданные ===
    const metadataPath = path.join(outputDir, 'metadata.json')
    const metadata: DemuxedMetadata = {
      path: metadataPath,
      container: format?.format_name || 'unknown',
      totalDuration: format?.duration ? parseFloat(format.duration) : 0,
      totalSize: sourceSize,
      chapters,
      tags: format?.tags || {},
      ffprobeRaw: probeData,
    }

    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')

    return {
      success: true,
      source: inputPath,
      outputDir,
      video,
      audioTracks,
      subtitles,
      fontsDir,
      metadata,
    }
  } catch (error) {
    return {
      success: false,
      source: inputPath,
      outputDir,
      video: null,
      audioTracks: [],
      subtitles: [],
      fontsDir: null,
      metadata: {
        path: '',
        container: '',
        totalDuration: 0,
        totalSize: 0,
        chapters: [],
        tags: {},
        ffprobeRaw: null,
      },
      error: String(error),
    }
  }
}

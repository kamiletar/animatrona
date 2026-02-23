/**
 * IPC handlers для FFmpeg операций
 */

import { BrowserWindow } from 'electron'
import { mkdir, stat } from 'fs/promises'
import path from 'path'
import type {
  AudioTranscodeOptions,
  AudioTranscodeVBROptions,
  DemuxOptions,
  EncodingProfileOptions,
  MergeConfig,
  VideoTranscodeOptions,
} from '../../shared/types'
import {
  demuxFile,
  encodeSample,
  generateScreenshots,
  generateThumbnailSprite,
  mergeMKV,
  probeFile,
  type ScreenshotOptions,
  type SpriteSheetOptions,
  transcodeAudio,
  transcodeAudioVBR,
  transcodeVideo,
  transcodeVideoWithProfile,
} from '../ffmpeg'
import { getFFmpegVersion } from '../utils/ffmpeg-spawn'
import { getCpuModel, getGpuModel } from '../utils/hardware-info'
import { createHandler, createHandlerWithEvent } from '../utils/ipc-handler-factory'

/**
 * Регистрирует IPC handlers для FFmpeg
 */
export function registerFFmpegHandlers(): void {
  // Анализ медиафайла
  createHandler('ffmpeg:probe', (filePath: string) => probeFile(filePath))

  // Получить версию FFmpeg
  createHandler('ffmpeg:getVersion', () => getFFmpegVersion())

  // Получить модель оборудования
  createHandler('ffmpeg:getHardwareInfo', async () => {
    const [gpuModel, cpuModel] = await Promise.all([getGpuModel(), Promise.resolve(getCpuModel())])
    return { gpuModel, cpuModel }
  })

  // Демультиплексирование (извлечение потоков без перекодирования)
  createHandler('ffmpeg:demux', async (inputPath: string, outputDir: string, options?: DemuxOptions) => {
    try {
      return await demuxFile(inputPath, outputDir, options)
    } catch (error) {
      // Возвращаем структурированный результат при ошибке
      return {
        success: false,
        source: inputPath,
        outputDir,
        video: null,
        audioTracks: [],
        subtitles: [],
        metadata: {
          path: '',
          container: '',
          totalDuration: 0,
          totalSize: 0,
          chapters: [],
          tags: {},
          ffprobeRaw: null,
        },
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Генерация скриншотов из видео
  createHandler(
    'ffmpeg:generateScreenshots',
    async (inputPath: string, outputDir: string, duration: number, options: ScreenshotOptions) => {
      const result = await generateScreenshots(inputPath, outputDir, duration, options)
      return { thumbnails: result.thumbnails, fullSize: result.fullSize }
    },
  )

  // Генерация thumbnail sprite sheet для hover preview
  createHandler(
    'ffmpeg:generateThumbnailSprite',
    async (inputPath: string, outputDir: string, duration: number, options?: SpriteSheetOptions) => {
      const result = await generateThumbnailSprite(inputPath, outputDir, duration, options)
      return { spritePath: result.spritePath, vttPath: result.vttPath, spriteSize: result.spriteSize }
    },
  )

  // === Handlers с прогрессом (используют event.sender) ===

  // Транскодирование видео
  createHandlerWithEvent(
    'ffmpeg:transcodeVideo',
    async (event, input: string, output: string, options: VideoTranscodeOptions) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      await transcodeVideo(input, output, options, (progress) => {
        win?.webContents.send('ffmpeg:progress', { type: 'video', ...progress })
      })
    },
  )

  // Транскодирование аудио
  createHandlerWithEvent(
    'ffmpeg:transcodeAudio',
    async (event, input: string, output: string, options: AudioTranscodeOptions) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      await transcodeAudio(input, output, options, (progress) => {
        win?.webContents.send('ffmpeg:progress', { type: 'audio', ...progress })
      })
    },
  )

  // Мерж в MKV
  createHandlerWithEvent('ffmpeg:merge', async (event, config: MergeConfig) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    await mergeMKV(config, (progress) => {
      win?.webContents.send('ffmpeg:progress', { type: 'merge', ...progress })
    })
    return { outputPath: config.outputPath }
  })

  // Транскодирование аудио VBR (умный подбор битрейта)
  createHandlerWithEvent(
    'ffmpeg:transcodeAudioVBR',
    async (event, input: string, output: string, options: AudioTranscodeVBROptions) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      await transcodeAudioVBR(input, output, options, (progress) => {
        win?.webContents.send('ffmpeg:progress', { type: 'audio-vbr', trackId: input, ...progress })
      })
      const outputStat = await stat(output)
      return { outputPath: output, outputSize: outputStat.size }
    },
  )

  // Транскодирование видео с профилем
  createHandlerWithEvent(
    'ffmpeg:transcodeWithProfile',
    async (event, input: string, output: string, profile: EncodingProfileOptions, sourceBitDepth = 8) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      await transcodeVideoWithProfile(input, output, profile, sourceBitDepth, (progress) => {
        win?.webContents.send('ffmpeg:progress', { type: 'video-profile', profileName: profile.name, ...progress })
      })
      const outputStat = await stat(output)
      return { outputPath: output, outputSize: outputStat.size }
    },
  )

  // Кодирование тестового сэмпла
  createHandlerWithEvent(
    'ffmpeg:encodeSample',
    async (
      event,
      options: {
        inputPath: string
        outputPath: string
        profile: EncodingProfileOptions
        startTime?: number
        duration?: number
        sourceBitDepth?: number
      },
    ) => {
      const outputDir = path.dirname(options.outputPath)
      await mkdir(outputDir, { recursive: true })

      const win = BrowserWindow.fromWebContents(event.sender)
      return await encodeSample(
        options.inputPath,
        options.outputPath,
        options.profile,
        options.startTime ?? 0,
        options.duration ?? 300,
        options.sourceBitDepth ?? 8,
        (progress) => {
          win?.webContents.send('ffmpeg:progress', { type: 'sample', profileName: options.profile.name, ...progress })
        },
      )
    },
  )
}

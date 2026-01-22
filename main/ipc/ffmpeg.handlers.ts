/**
 * IPC handlers для FFmpeg операций
 */

import { BrowserWindow, ipcMain } from 'electron'
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

/**
 * Регистрирует IPC handlers для FFmpeg
 */
export function registerFFmpegHandlers(): void {
  // Анализ медиафайла
  ipcMain.handle('ffmpeg:probe', async (_event, filePath: string) => {
    try {
      const info = await probeFile(filePath)
      return { success: true, data: info }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Транскодирование видео
  ipcMain.handle(
    'ffmpeg:transcodeVideo',
    async (event, input: string, output: string, options: VideoTranscodeOptions) => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender)

        await transcodeVideo(input, output, options, (progress) => {
          // Отправляем прогресс в renderer
          win?.webContents.send('ffmpeg:progress', {
            type: 'video',
            ...progress,
          })
        })

        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // Транскодирование аудио
  ipcMain.handle(
    'ffmpeg:transcodeAudio',
    async (event, input: string, output: string, options: AudioTranscodeOptions) => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender)

        await transcodeAudio(input, output, options, (progress) => {
          win?.webContents.send('ffmpeg:progress', {
            type: 'audio',
            ...progress,
          })
        })

        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // Мерж в MKV
  ipcMain.handle('ffmpeg:merge', async (event, config: MergeConfig) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)

      await mergeMKV(config, (progress) => {
        win?.webContents.send('ffmpeg:progress', {
          type: 'merge',
          ...progress,
        })
      })

      return { success: true, outputPath: config.outputPath }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Демультиплексирование (извлечение потоков без перекодирования)
  ipcMain.handle('ffmpeg:demux', async (_event, inputPath: string, outputDir: string, options?: DemuxOptions) => {
    try {
      const result = await demuxFile(inputPath, outputDir, options)
      return result
    } catch (error) {
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

  // Транскодирование аудио VBR (умный подбор битрейта)
  ipcMain.handle(
    'ffmpeg:transcodeAudioVBR',
    async (event, input: string, output: string, options: AudioTranscodeVBROptions) => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender)

        await transcodeAudioVBR(input, output, options, (progress) => {
          // Отправляем прогресс в renderer с идентификатором дорожки
          win?.webContents.send('ffmpeg:progress', {
            type: 'audio-vbr',
            trackId: input, // Используем путь как идентификатор
            ...progress,
          })
        })

        // Получаем размер выходного файла
        const outputStat = await stat(output)

        return {
          success: true,
          outputPath: output,
          outputSize: outputStat.size,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // Транскодирование видео с профилем
  ipcMain.handle(
    'ffmpeg:transcodeWithProfile',
    async (event, input: string, output: string, profile: EncodingProfileOptions, sourceBitDepth = 8) => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender)

        await transcodeVideoWithProfile(input, output, profile, sourceBitDepth, (progress) => {
          win?.webContents.send('ffmpeg:progress', {
            type: 'video-profile',
            profileName: profile.name,
            ...progress,
          })
        })

        // Получаем размер выходного файла
        const outputStat = await stat(output)

        return {
          success: true,
          outputPath: output,
          outputSize: outputStat.size,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // Кодирование тестового сэмпла
  ipcMain.handle(
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
      }
    ) => {
      try {
        // Создаём папку для вывода если не существует
        const outputDir = path.dirname(options.outputPath)
        await mkdir(outputDir, { recursive: true })

        const win = BrowserWindow.fromWebContents(event.sender)

        const result = await encodeSample(
          options.inputPath,
          options.outputPath,
          options.profile,
          options.startTime ?? 0,
          options.duration ?? 300,
          options.sourceBitDepth ?? 8,
          (progress) => {
            win?.webContents.send('ffmpeg:progress', {
              type: 'sample',
              profileName: options.profile.name,
              ...progress,
            })
          }
        )

        return result
      } catch (error) {
        return {
          success: false,
          outputPath: options.outputPath,
          encodingTime: 0,
          outputSize: 0,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // Генерация скриншотов из видео
  ipcMain.handle(
    'ffmpeg:generateScreenshots',
    async (_event, inputPath: string, outputDir: string, duration: number, options: ScreenshotOptions) => {
      try {
        const result = await generateScreenshots(inputPath, outputDir, duration, options)

        return {
          success: true,
          thumbnails: result.thumbnails,
          fullSize: result.fullSize,
        }
      } catch (error) {
        return {
          success: false,
          thumbnails: [],
          fullSize: [],
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // Генерация thumbnail sprite sheet для hover preview
  ipcMain.handle(
    'ffmpeg:generateThumbnailSprite',
    async (_event, inputPath: string, outputDir: string, duration: number, options?: SpriteSheetOptions) => {
      try {
        const result = await generateThumbnailSprite(inputPath, outputDir, duration, options)

        return {
          success: true,
          spritePath: result.spritePath,
          vttPath: result.vttPath,
          spriteSize: result.spriteSize,
        }
      } catch (error) {
        return {
          success: false,
          spritePath: '',
          vttPath: '',
          spriteSize: 0,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // Получить версию FFmpeg
  ipcMain.handle('ffmpeg:getVersion', async () => {
    try {
      const version = await getFFmpegVersion()
      return { success: true, data: version }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Получить модель оборудования
  ipcMain.handle('ffmpeg:getHardwareInfo', async () => {
    try {
      const [gpuModel, cpuModel] = await Promise.all([getGpuModel(), Promise.resolve(getCpuModel())])
      return {
        success: true,
        data: {
          gpuModel,
          cpuModel,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })
}

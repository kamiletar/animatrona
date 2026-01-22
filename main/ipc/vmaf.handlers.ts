/**
 * IPC handlers для VMAF операций
 */

import { BrowserWindow, ipcMain } from 'electron'
import type { VideoTranscodeOptions } from '../../shared/types'
import type { CqSearchOptions, CqSearchProgress, SampleConfig, VmafOptions } from '../../shared/types/vmaf'
import { ParallelTranscodeManager } from '../services/parallel-transcode-manager'
import { calculateVMAF, calculateVMAFBatch, cleanupSamples, extractSamples, findOptimalCQ } from '../src/ffmpeg'

/**
 * Регистрирует IPC handlers для VMAF
 */
export function registerVmafHandlers(): void {
  // Расчёт VMAF между двумя видео
  ipcMain.handle('vmaf:calculate', async (_event, encoded: string, original: string, options?: VmafOptions) => {
    try {
      const result = await calculateVMAF(encoded, original, options)
      return { success: true, data: result }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Пакетный расчёт VMAF
  ipcMain.handle('vmaf:calculateBatch', async (_event, pairs: Array<[string, string]>, options?: VmafOptions) => {
    try {
      const results = await calculateVMAFBatch(pairs, options)
      return { success: true, data: results }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Поиск оптимального CQ
  ipcMain.handle(
    'vmaf:findOptimalCQ',
    async (
      event,
      inputPath: string,
      videoOptions: Omit<VideoTranscodeOptions, 'cq'>,
      options?: Partial<CqSearchOptions>,
      preferCpu = false,
      itemId?: string // Опциональный ID для сохранения прогресса в main
    ) => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender)
        const manager = ParallelTranscodeManager.getInstance()

        const result = await findOptimalCQ(
          inputPath,
          videoOptions,
          options,
          (progress: CqSearchProgress) => {
            // Сохраняем прогресс в manager для восстановления при навигации
            if (itemId) {
              manager.setVmafProgress(itemId, progress)
            }

            // Отправляем прогресс в renderer (legacy способ)
            win?.webContents.send('vmaf:progress', progress)
          },
          preferCpu
        )

        // Очищаем прогресс после завершения
        if (itemId) {
          manager.clearVmafProgress(itemId)
        }

        return { success: true, data: result }
      } catch (error) {
        // Очищаем прогресс при ошибке
        if (itemId) {
          const manager = ParallelTranscodeManager.getInstance()
          manager.clearVmafProgress(itemId)
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // Извлечение сэмплов из видео
  ipcMain.handle(
    'vmaf:extractSamples',
    async (_event, inputPath: string, outputDir: string, config?: Partial<SampleConfig>) => {
      try {
        const samples = await extractSamples(inputPath, outputDir, config)
        return { success: true, data: samples }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // Очистка временных файлов
  ipcMain.handle('vmaf:cleanup', async (_event, sampleDir: string) => {
    try {
      cleanupSamples(sampleDir)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })
}

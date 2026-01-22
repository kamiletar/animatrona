/**
 * IPC handlers для работы с субтитрами
 */

import { ipcMain } from 'electron'
import {
  previewShift,
  shiftSubtitles,
  type ShiftSubtitlesOptions,
  type ShiftSubtitlesResult,
} from '../services/subtitle-shifter'

/**
 * Регистрирует IPC handlers для субтитров
 */
export function registerSubtitleHandlers(): void {
  // Сдвиг таймкодов субтитров
  ipcMain.handle('subtitle:shift', async (_event, options: ShiftSubtitlesOptions): Promise<ShiftSubtitlesResult> => {
    console.warn(`[IPC] subtitle:shift: ${options.inputPath} → ${options.outputPath}, offset: ${options.offsetMs}ms`)
    try {
      const result = await shiftSubtitles(options)
      if (result.success) {
        console.warn(
          `[IPC] subtitle:shift: success, processed ${result.totalEvents} events, removed ${result.removedEvents}`
        )
      } else {
        console.error(`[IPC] subtitle:shift: failed - ${result.error}`)
      }
      return result
    } catch (error) {
      console.error('[IPC] subtitle:shift error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Предпросмотр сдвига (первые N событий)
  ipcMain.handle(
    'subtitle:previewShift',
    async (
      _event,
      inputPath: string,
      offsetMs: number,
      limit = 5
    ): Promise<{
      events: Array<{ start: string; end: string; text: string }>
      total: number
      error?: string
    }> => {
      console.warn(`[IPC] subtitle:previewShift: ${inputPath}, offset: ${offsetMs}ms, limit: ${limit}`)
      try {
        return await previewShift(inputPath, offsetMs, limit)
      } catch (error) {
        console.error('[IPC] subtitle:previewShift error:', error)
        return {
          events: [],
          total: 0,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )
}

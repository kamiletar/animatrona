/**
 * IPC handlers для работы с файловой системой
 */

import { ipcMain, nativeImage, shell } from 'electron'
import { existsSync } from 'fs'
import { copyFile, mkdir, readdir, rm, stat } from 'fs/promises'
import path from 'path'
import { type ExternalAudioScanResult, scanForExternalAudio } from '../services/external-audio-scanner'
import { type ExternalSubtitleScanResult, scanForExternalSubtitles } from '../services/external-subtitle-scanner'
import { getDefaultLibraryPath } from '../services/output-path-resolver'

/**
 * Проверяет что путь находится внутри библиотеки
 * Использует path.resolve() для защиты от path traversal (../)
 *
 * КРИТИЧЕСКАЯ ФУНКЦИЯ БЕЗОПАСНОСТИ:
 * Предотвращает удаление файлов вне папки библиотеки
 */
function isPathInsideLibrary(targetPath: string): { safe: boolean; reason?: string } {
  const libraryPath = getDefaultLibraryPath()
  const resolvedTarget = path.resolve(targetPath)
  const resolvedLibrary = path.resolve(libraryPath)

  // Запретить удаление самой библиотеки
  if (resolvedTarget === resolvedLibrary) {
    return { safe: false, reason: 'Нельзя удалить корень библиотеки' }
  }

  // Путь должен начинаться с libraryPath + разделитель
  // Это защищает от:
  // 1. Path traversal: C:/Videos/Animatrona/../../../Windows → C:/Windows (не матчит)
  // 2. Похожих путей: C:/Videos/Animatrona2 (не начинается с libraryPath + sep)
  if (!resolvedTarget.startsWith(resolvedLibrary + path.sep)) {
    return { safe: false, reason: `Путь "${resolvedTarget}" вне библиотеки "${resolvedLibrary}"` }
  }

  return { safe: true }
}

/** Информация о медиафайле */
interface MediaFileInfo {
  path: string
  name: string
  size: number
  extension: string
}

/** Типы медиафайлов */
type MediaType = 'video' | 'audio'

/** Расширения по типам медиа */
const EXTENSIONS_BY_TYPE: Record<MediaType, Set<string>> = {
  video: new Set(['.mkv', '.mp4', '.avi', '.webm', '.mov', '.wmv', '.flv', '.m4v']),
  audio: new Set(['.mka', '.m4a', '.flac', '.opus', '.mp3', '.aac', '.wav', '.ogg', '.ac3', '.dts']),
}

/**
 * Регистрирует IPC handlers для файловой системы
 */
export function registerFsHandlers(): void {
  // Сканирование папки на медиафайлы
  ipcMain.handle(
    'fs:scanFolder',
    async (_event, folderPath: string, recursive = true, mediaTypes: MediaType[] = ['video']) => {
      try {
        const files = await scanFolderForMedia(folderPath, recursive, mediaTypes)
        return { success: true, files }
      } catch (error) {
        return { success: false, error: String(error), files: [] }
      }
    }
  )

  // Удаление файла или папки
  ipcMain.handle('fs:delete', async (_event, targetPath: string, moveToTrash = true) => {
    try {
      // === КРИТИЧЕСКАЯ ЗАЩИТА: Проверка что путь в библиотеке ===
      const { safe, reason } = isPathInsideLibrary(targetPath)
      if (!safe) {
        return { success: false, error: reason }
      }

      if (!existsSync(targetPath)) {
        return { success: true }
      }

      if (moveToTrash) {
        // Перемещаем в корзину (безопаснее)
        await shell.trashItem(targetPath)
      } else {
        // Полное удаление
        await rm(targetPath, { recursive: true, force: true })
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Проверка существования пути
  ipcMain.handle('fs:exists', async (_event, targetPath: string) => {
    return existsSync(targetPath)
  })

  // Получение информации о файле (размер, дата)
  ipcMain.handle('fs:stat', async (_event, filePath: string) => {
    try {
      const stats = await stat(filePath)
      return { success: true, size: stats.size, mtime: stats.mtime }
    } catch (error) {
      return { success: false, size: 0, error: String(error) }
    }
  })

  // Копирование файла
  ipcMain.handle('fs:copyFile', async (_event, sourcePath: string, destPath: string) => {
    try {
      await mkdir(path.dirname(destPath), { recursive: true })
      await copyFile(sourcePath, destPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Сканирование внешних субтитров
  ipcMain.handle(
    'fs:scanExternalSubtitles',
    async (
      _event,
      videoFolderPath: string,
      videoFiles: Array<{ path: string; episodeNumber: number }>
    ): Promise<ExternalSubtitleScanResult> => {
      return scanForExternalSubtitles(videoFolderPath, videoFiles)
    }
  )

  // Сканирование внешних аудиодорожек
  ipcMain.handle(
    'fs:scanExternalAudio',
    async (
      _event,
      videoFolderPath: string,
      videoFiles: Array<{ path: string; episodeNumber: number }>
    ): Promise<ExternalAudioScanResult> => {
      return scanForExternalAudio(videoFolderPath, videoFiles)
    }
  )

  // Получение метаданных изображения (размеры, blur placeholder)
  ipcMain.handle('fs:getImageMetadata', async (_event, filePath: string) => {
    try {
      if (!existsSync(filePath)) {
        return { success: false, error: 'Файл не существует' }
      }

      const stats = await stat(filePath)
      const image = nativeImage.createFromPath(filePath)

      if (image.isEmpty()) {
        return { success: false, error: 'Не удалось загрузить изображение' }
      }

      const { width, height } = image.getSize()

      // Генерируем blur placeholder (10x10px JPEG в base64)
      const blurImage = image.resize({ width: 10, height: 10, quality: 'low' })
      const blurBuffer = blurImage.toJPEG(50)
      const blurDataURL = `data:image/jpeg;base64,${blurBuffer.toString('base64')}`

      // Определяем MIME тип по расширению
      const ext = path.extname(filePath).toLowerCase()
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
      }
      const mimeType = mimeTypes[ext] || 'image/jpeg'

      return {
        success: true,
        width,
        height,
        size: stats.size,
        mimeType,
        blurDataURL,
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}

/**
 * Рекурсивно сканирует папку на медиафайлы указанных типов
 */
async function scanFolderForMedia(
  folderPath: string,
  recursive: boolean,
  mediaTypes: MediaType[]
): Promise<MediaFileInfo[]> {
  const results: MediaFileInfo[] = []

  // Собираем все нужные расширения из указанных типов
  const allowedExtensions = new Set<string>()
  for (const type of mediaTypes) {
    for (const ext of EXTENSIONS_BY_TYPE[type]) {
      allowedExtensions.add(ext)
    }
  }

  try {
    const entries = await readdir(folderPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name)

      if (entry.isDirectory() && recursive) {
        // Рекурсивно сканируем поддиректории
        const subResults = await scanFolderForMedia(fullPath, recursive, mediaTypes)
        results.push(...subResults)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (allowedExtensions.has(ext)) {
          try {
            const stats = await stat(fullPath)
            results.push({
              path: fullPath,
              name: entry.name,
              size: stats.size,
              extension: ext,
            })
          } catch {
            // Не удалось получить stat файла — пропускаем
          }
        }
      }
    }
  } catch {
    // Ошибка чтения директории — возвращаем пустой массив
  }

  return results
}

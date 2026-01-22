/**
 * Хук для удаления аниме из библиотеки вместе с файлами
 *
 * БЕЗОПАСНОСТЬ: Главная защита от удаления файлов вне библиотеки находится
 * в Electron main process (fs.handlers.ts → isPathInsideLibrary).
 * Проверка здесь — дополнительный рубеж для UX.
 */

import { useDeleteAnime as useDeleteAnimeMutation } from '@/lib/hooks'

interface DeleteAnimeOptions {
  /** ID аниме */
  animeId: string
  /** Путь к папке аниме (libraryPath/AnimeName/) */
  animeFolderPath?: string | null
  /** Удалять файлы в корзину (по умолчанию true) */
  moveToTrash?: boolean
}

interface DeleteAnimeResult {
  success: boolean
  deletedFolders: number
  errors: string[]
}

/**
 * Извлекает путь к папке аниме из пути эпизода
 * Структура: libraryPath/AnimeName/Season X/Episode Y/manifest.json
 * Поднимаемся на 3 уровня вверх
 */
export function deriveAnimeFolderFromEpisodePath(episodePath: string): string | null {
  if (!episodePath) {
    return null
  }

  // Разбиваем путь по разделителям
  const parts = episodePath.replace(/\\/g, '/').split('/')

  // Удаляем файл + Episode + Season = 3 части
  if (parts.length < 4) {
    return null
  }

  // Собираем путь к папке аниме
  const animeFolderParts = parts.slice(0, -3)
  return animeFolderParts.join('/')
}

/**
 * Удаляет аниме из БД и связанные файлы с диска
 */
export function useDeleteAnimeWithFiles() {
  const deleteMutation = useDeleteAnimeMutation()

  const deleteAnime = async (options: DeleteAnimeOptions): Promise<DeleteAnimeResult> => {
    const { animeId, animeFolderPath, moveToTrash = true } = options
    const errors: string[] = []
    let deletedFolders = 0

    // === ОТЛАДКА ===
    console.warn('[DeleteAnime] ========== НАЧАЛО УДАЛЕНИЯ ==========')
    console.warn('[DeleteAnime] Input:', { animeId, animeFolderPath, moveToTrash })

    const api = window.electronAPI
    if (!api) {
      console.error('[DeleteAnime] Electron API недоступен!')
      return { success: false, deletedFolders: 0, errors: ['Electron API недоступен'] }
    }

    // Получаем путь к библиотеке для проверки безопасности
    const libraryPath = await api.library.getDefaultPath()
    console.warn('[DeleteAnime] Library path:', libraryPath)

    // 1. Удаляем папку аниме целиком (включая все сезоны, эпизоды и постер)
    if (animeFolderPath) {
      // ЗАЩИТА (дополнительный рубеж): проверяем что путь находится В БИБЛИОТЕКЕ
      // Главная защита в Electron (fs.handlers.ts → isPathInsideLibrary)
      const normalizedFolder = animeFolderPath.replace(/\\/g, '/')
      const normalizedLibrary = (libraryPath?.replace(/\\/g, '/') || '') + '/'

      console.warn('[DeleteAnime] Normalized paths:', { normalizedFolder, normalizedLibrary })
      console.warn('[DeleteAnime] Starts with check:', normalizedFolder.startsWith(normalizedLibrary))

      // Проверяем что путь начинается с libraryPath/
      // (добавляем / чтобы /Videos/Anim не матчил /Videos/Animatrona)
      if (!libraryPath || !normalizedFolder.startsWith(normalizedLibrary)) {
        console.error(`[DeleteAnime] ОТКАЗ: путь "${animeFolderPath}" не в библиотеке "${libraryPath}"`)
        errors.push(`Отказ в удалении: путь не находится в библиотеке`)
        return { success: false, deletedFolders: 0, errors }
      }
      console.warn('[DeleteAnime] ✓ Путь проверен, находится в библиотеке')

      try {
        console.warn(`[DeleteAnime] Удаляем папку: ${animeFolderPath}`)
        const result = await api.fs.delete(animeFolderPath, moveToTrash)
        if (result.success) {
          deletedFolders++
          console.warn(`[DeleteAnime] Папка удалена успешно`)
        } else if (result.error) {
          // Не блокируем удаление из БД если файлы не удалились
          // (файл занят, aborted, нет доступа — пользователь удалит вручную)
          console.warn('[DeleteAnime] ⚠️ Не удалось удалить папку (удалите вручную):', result.error)
        }
      } catch (e) {
        // Не блокируем удаление из БД при ошибке файловой системы
        console.warn('[DeleteAnime] ⚠️ Exception при удалении папки (удалите вручную):', e)
      }
      // Постер хранится в папке аниме и удаляется вместе с ней
    } else {
      console.warn('[DeleteAnime] ⚠️ animeFolderPath не указан — файлы НЕ будут удалены')
    }

    // 2. Удаляем из базы данных
    console.warn('[DeleteAnime] Удаляем из БД, animeId:', animeId)
    try {
      await deleteMutation.mutateAsync({ where: { id: animeId } })
      console.warn('[DeleteAnime] ✓ Удалено из БД')
    } catch (e) {
      // P2025 = запись не найдена — это нормально если данные неконсистентны (краш, отмена импорта)
      const prismaError = e as { code?: string }
      if (prismaError.code === 'P2025') {
        console.warn('[DeleteAnime] Запись уже удалена (P2025) — считаем успехом')
      } else {
        console.error('[DeleteAnime] ✗ Ошибка удаления из БД:', e)
        errors.push(`Ошибка при удалении из БД: ${e}`)
        return { success: false, deletedFolders, errors }
      }
    }

    console.warn('[DeleteAnime] ========== ЗАВЕРШЕНО ==========')
    console.warn('[DeleteAnime] Результат:', {
      success: errors.length === 0,
      deletedFolders,
      errorsCount: errors.length,
    })

    return {
      success: errors.length === 0,
      deletedFolders,
      errors,
    }
  }

  return {
    deleteAnime,
    isDeleting: deleteMutation.isPending,
  }
}

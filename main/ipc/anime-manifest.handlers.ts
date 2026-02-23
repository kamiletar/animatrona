/**
 * IPC handlers для AnimeManifest
 *
 * Обеспечивает генерацию и получение манифестов аниме из IPFS.
 */

import type { AnimeManifest, GenerateAnimeManifestInput } from '../../shared/types/anime-manifest'
import {
  generateAnimeManifest,
  getAnimeManifestFromIpfs,
  importAnimeFromManifest,
  updateAnimeManifest,
} from '../services/anime-manifest-generator'
import { prisma } from '../utils/db'
import { createHandler } from '../utils/ipc-handler-factory'
import { createModuleLogger } from '../utils/logger'

const log = createModuleLogger('AnimeManifestHandlers')

/**
 * Регистрирует IPC handlers для работы с AnimeManifest
 */
export function registerAnimeManifestHandlers(): void {
  /**
   * Генерировать манифест аниме и опубликовать в IPFS
   *
   * Собирает все метаданные из БД, создаёт AnimeManifest JSON,
   * публикует в IPFS и возвращает CID.
   */
  createHandler(
    'animeManifest:generate',
    async (input: GenerateAnimeManifestInput) => {
      log.info('Генерация AnimeManifest', { animeId: input.animeId })
      return generateAnimeManifest(input)
    },
  )

  /**
   * Генерировать манифест и сохранить CID в БД
   *
   * Как generate, но дополнительно обновляет поле Anime.manifestCid.
   */
  createHandler(
    'animeManifest:update',
    async (animeId: string) => {
      log.info('Обновление AnimeManifest', { animeId })
      return updateAnimeManifest(animeId)
    },
  )

  /**
   * Получить манифест из IPFS по CID
   *
   * Используется для загрузки детальной информации при открытии страницы аниме.
   */
  createHandler(
    'animeManifest:get',
    async (manifestCid: string): Promise<AnimeManifest> => {
      log.info('Получение AnimeManifest', { manifestCid })
      const manifest = await getAnimeManifestFromIpfs(manifestCid)
      if (!manifest) {
        throw new Error(`Манифест не найден: ${manifestCid}`)
      }
      return manifest
    },
  )

  /**
   * Получить манифест аниме по ID аниме
   *
   * Если manifestCid есть в БД — загружает из IPFS.
   * Если нет — генерирует новый и сохраняет.
   */
  createHandler(
    'animeManifest:getByAnimeId',
    async (animeId: string): Promise<AnimeManifest> => {
      log.info('Получение AnimeManifest по animeId', { animeId })

      // Проверяем есть ли manifestCid в БД
      const anime = await prisma.anime.findUnique({
        where: { id: animeId },
        select: { manifestCid: true, name: true },
      })

      if (!anime) {
        throw new Error(`Аниме не найдено: ${animeId}`)
      }

      // Если манифест уже есть — загружаем из IPFS
      if (anime.manifestCid) {
        const manifest = await getAnimeManifestFromIpfs(anime.manifestCid)
        if (manifest) {
          return manifest
        }
        log.warn('Манифест не найден в IPFS, генерируем новый', { manifestCid: anime.manifestCid })
      }

      // Генерируем новый манифест
      const result = await updateAnimeManifest(animeId)
      if (!result.success || !result.manifest) {
        throw new Error(result.error || 'Не удалось сгенерировать манифест')
      }

      return result.manifest
    },
  )

  /**
   * Batch-генерация манифестов для нескольких аниме
   *
   * Используется при миграции существующей библиотеки.
   */
  createHandler(
    'animeManifest:generateBatch',
    async (
      animeIds: string[],
      onProgress?: (current: number, total: number, animeName: string) => void,
    ): Promise<{ success: number; failed: number; errors: Array<{ animeId: string; error: string }> }> => {
      log.info('Batch-генерация AnimeManifest', { count: animeIds.length })

      const result = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ animeId: string; error: string }>,
      }

      for (let i = 0; i < animeIds.length; i++) {
        const animeId = animeIds[i]

        try {
          // Получаем имя для прогресса
          const anime = await prisma.anime.findUnique({
            where: { id: animeId },
            select: { name: true },
          })

          onProgress?.(i + 1, animeIds.length, anime?.name || animeId)

          const generateResult = await updateAnimeManifest(animeId)
          if (generateResult.success) {
            result.success++
          } else {
            result.failed++
            result.errors.push({ animeId, error: generateResult.error || 'Unknown error' })
          }
        } catch (error) {
          result.failed++
          result.errors.push({
            animeId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      log.info('Batch-генерация завершена', { success: result.success, failed: result.failed })
      return result
    },
  )

  /**
   * Получить список аниме без manifestCid
   *
   * Возвращает ID аниме, которым нужно сгенерировать манифесты.
   */
  createHandler(
    'animeManifest:getAnimesWithoutManifest',
    async (): Promise<Array<{ id: string; name: string }>> => {
      const animes = await prisma.anime.findMany({
        where: { manifestCid: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
      return animes
    },
  )

  /**
   * Импортировать аниме из IPFS манифеста
   *
   * Создаёт минимальные записи в БД для списка библиотеки.
   * Эпизоды создаются без локальных файлов — для стриминга из IPFS.
   */
  createHandler(
    'animeManifest:import',
    async (
      manifestCid: string,
    ): Promise<{ success: boolean; animeId?: string; animeName?: string; episodeCount?: number; error?: string }> => {
      log.info('Импорт аниме из манифеста', { manifestCid })
      return importAnimeFromManifest(manifestCid)
    },
  )
}

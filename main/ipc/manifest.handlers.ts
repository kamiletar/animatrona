/**
 * IPC handlers для генерации манифестов
 */

import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import type { DemuxResult } from '../../shared/types'
import type { EpisodeManifest, GenerateManifestOptions } from '../../shared/types/manifest'
import { addFile, cat } from '../services/ipfs/unixfs-service'
import {
  generateManifestFromDemux,
  readManifest,
  updateManifestEncoding,
  updateManifestNavigation,
  updateManifestThumbnails,
} from '../services/manifest-generator'
import { createHandler } from '../utils/ipc-handler-factory'
import { createModuleLogger } from '../utils/logger'

const log = createModuleLogger('ManifestHandlers')

/**
 * Регистрирует IPC handlers для работы с манифестами
 */
export function registerManifestHandlers(): void {
  // Генерация манифеста из результатов demux
  createHandler(
    'manifest:generate',
    (demuxResult: DemuxResult, options: GenerateManifestOptions) => generateManifestFromDemux(demuxResult, options),
  )

  // Чтение существующего манифеста
  createHandler('manifest:read', (manifestPath: string) => {
    const manifest = readManifest(manifestPath)
    if (!manifest) {
      throw new Error('Манифест не найден')
    }
    return manifest
  })

  // Обновление навигации в манифесте
  createHandler(
    'manifest:updateNavigation',
    (
      manifestPath: string,
      navigation: {
        nextEpisode?: { id: string; manifestPath: string }
        prevEpisode?: { id: string; manifestPath: string }
      },
    ) => {
      const success = updateManifestNavigation(manifestPath, navigation)
      return { success }
    },
  )

  // Обновление thumbnails в манифесте (с CID для IPFS)
  createHandler(
    'manifest:updateThumbnails',
    (manifestPath: string, thumbnails: EpisodeManifest['thumbnails']) => {
      const success = updateManifestThumbnails(manifestPath, thumbnails)
      return { success }
    },
  )

  // Обновление информации о кодировании в манифесте
  createHandler(
    'manifest:updateEncoding',
    (manifestPath: string, encoding: EpisodeManifest['encoding']) => {
      const success = updateManifestEncoding(manifestPath, encoding)
      return { success }
    },
  )

  /**
   * Batch-обновление навигации между эпизодами через IPFS
   *
   * Алгоритм:
   * 1. Скачать все манифесты из IPFS
   * 2. Обновить навигацию (prev/next) с placeholder CID
   * 3. Загрузить обратно в IPFS, получить новые CID
   * 4. Обновить ссылки в манифестах на реальные CID
   * 5. Перезагрузить манифесты с финальными CID
   * 6. Вернуть map episodeId -> newManifestCid
   */
  createHandler(
    'manifest:updateNavigationBatch',
    async (
      episodes: Array<{ id: string; manifestCid: string }>,
    ): Promise<Record<string, string>> => {
      const tempDir = path.join(os.tmpdir(), `animatrona-nav-${Date.now()}`)

      try {
        log.info('Обновление навигации для эпизодов', { count: episodes.length })

        // Создаём временную директорию
        await fs.mkdir(tempDir, { recursive: true })

        // Шаг 1: Скачать все манифесты из IPFS
        const manifests = new Map<string, EpisodeManifest>()

        for (const ep of episodes) {
          try {
            const content = await cat(ep.manifestCid)
            const json = content.toString('utf-8')
            manifests.set(ep.id, JSON.parse(json))
          } catch (error) {
            log.warn('Не удалось скачать манифест для эпизода', {
              episodeId: ep.id,
              error: error instanceof Error ? error.message : String(error),
            })
            // Пропускаем эпизоды с недоступными манифестами
          }
        }

        log.info('Манифесты скачаны', { count: manifests.size })

        // Фильтруем только эпизоды с успешно скачанными манифестами
        const validEpisodes = episodes.filter((ep) => manifests.has(ep.id))

        if (validEpisodes.length < 2) {
          // Нечего связывать
          return {}
        }

        // Шаг 2: Обновить навигацию в каждом манифесте (с placeholder)
        for (let i = 0; i < validEpisodes.length; i++) {
          const ep = validEpisodes[i]
          const manifest = manifests.get(ep.id)
          if (!manifest) continue

          const prev = validEpisodes[i - 1]
          const next = validEpisodes[i + 1]

          manifest.navigation = {
            prevEpisode: prev ? { id: prev.id, manifestCid: '' } : undefined,
            nextEpisode: next ? { id: next.id, manifestCid: '' } : undefined,
          }
        }

        // Шаг 3: Загрузить все манифесты в IPFS, получить промежуточные CID
        const intermediateCids = new Map<string, string>()

        for (const ep of validEpisodes) {
          const manifest = manifests.get(ep.id)
          if (!manifest) continue

          const tempPath = path.join(tempDir, `${ep.id}.json`)
          await fs.writeFile(tempPath, JSON.stringify(manifest, null, 2), 'utf-8')

          const result = await addFile(tempPath)
          intermediateCids.set(ep.id, result.cid)
        }

        log.info('Промежуточные манифесты загружены', { count: intermediateCids.size })

        // Шаг 4: Обновить ссылки в навигации на реальные CID
        for (const ep of validEpisodes) {
          const manifest = manifests.get(ep.id)
          if (!manifest?.navigation) continue

          if (manifest.navigation.prevEpisode) {
            const prevCid = intermediateCids.get(manifest.navigation.prevEpisode.id)
            if (prevCid) {
              manifest.navigation.prevEpisode.manifestCid = prevCid
            }
          }

          if (manifest.navigation.nextEpisode) {
            const nextCid = intermediateCids.get(manifest.navigation.nextEpisode.id)
            if (nextCid) {
              manifest.navigation.nextEpisode.manifestCid = nextCid
            }
          }
        }

        // Шаг 5: Перезагрузить манифесты с финальными CID
        const finalCids = new Map<string, string>()

        for (const ep of validEpisodes) {
          const manifest = manifests.get(ep.id)
          if (!manifest) continue

          const tempPath = path.join(tempDir, `${ep.id}-final.json`)
          await fs.writeFile(tempPath, JSON.stringify(manifest, null, 2), 'utf-8')

          const result = await addFile(tempPath)
          finalCids.set(ep.id, result.cid)
        }

        log.info('Финальные манифесты загружены', { count: finalCids.size })

        // Шаг 6: Очистка
        try {
          await fs.rm(tempDir, { recursive: true })
        } catch {
          // Игнорируем ошибки очистки
        }

        // Преобразуем Map в Record для возврата через IPC
        const result: Record<string, string> = {}
        for (const [id, cid] of finalCids) {
          result[id] = cid
        }

        return result
      } catch (error) {
        // Очистка при ошибке
        try {
          await fs.rm(tempDir, { recursive: true })
        } catch {
          // Игнорируем
        }
        throw error
      }
    },
  )
}

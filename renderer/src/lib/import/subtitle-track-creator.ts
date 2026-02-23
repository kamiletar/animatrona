'use client'

/**
 * Создание субтитров для эпизодов
 */

import type { ParsedFile } from '@/components/import/FileScanStep'
import type { FileAnalysis } from '@/components/import/PreviewStep'
import type { ExternalSubtitleMatch } from '@/types/electron'
import type { DemuxedSubtitle, DemuxResult } from '../../../../shared/types'
import { uploadToIpfs } from '../ipfs-upload'
import type { ImportMutations } from './use-import-mutations'

/**
 * Создаёт субтитры из demux результата и внешних файлов
 *
 * @param episodeId - ID эпизода
 * @param demuxResult - Результат demux
 * @param fileAnalyses - Анализ файлов с рекомендациями
 * @param file - Обрабатываемый файл
 * @param episodeOutputDir - Папка вывода эпизода
 * @param externalSubsMap - Карта внешних субтитров
 * @param api - Electron API
 * @param mutations - Мутации для создания треков
 */
export async function createSubtitleTracks(
  episodeId: string,
  demuxResult: DemuxResult,
  fileAnalyses: FileAnalysis[] | undefined,
  file: ParsedFile & { episodeNumber: number },
  episodeOutputDir: string,
  externalSubsMap: Map<number, ExternalSubtitleMatch[]>,
  api: NonNullable<typeof window.electronAPI>,
  mutations: ImportMutations
): Promise<void> {
  const fileAnalysis = fileAnalyses?.find((a) => a.file.episodeNumber === file.episodeNumber)
  const selectedSubs = fileAnalysis?.subtitleRecommendations.filter((r) => r.enabled) || []

  if (selectedSubs.length > 0) {
    console.warn(`[SubtitleTrackCreator] Using ${selectedSubs.length} selected subtitles for ep ${file.episodeNumber}`)
    await processSelectedSubtitles(episodeId, demuxResult, selectedSubs, episodeOutputDir, api, mutations)
  } else {
    // Fallback: все встроенные субтитры
    await processEmbeddedSubtitles(episodeId, demuxResult, mutations)
    await processExternalSubtitles(episodeId, file.episodeNumber, episodeOutputDir, externalSubsMap, api, mutations)
  }
}

/**
 * Обработка выбранных субтитров из fileAnalysis
 */
async function processSelectedSubtitles(
  episodeId: string,
  demuxResult: DemuxResult,
  selectedSubs: Array<{
    enabled: boolean
    isExternal?: boolean
    externalPath?: string
    language?: string
    title?: string
    format: string
    streamIndex?: number
    matchedFonts?: Array<{ name: string; path: string }>
    dubGroup?: string
    subtitleType?: string
  }>,
  episodeOutputDir: string,
  api: NonNullable<typeof window.electronAPI>,
  mutations: ImportMutations
): Promise<void> {
  let isFirstSub = true

  for (const rec of selectedSubs) {
    try {
      if (rec.isExternal && rec.externalPath) {
        await processExternalSubtitle(episodeId, rec, episodeOutputDir, isFirstSub, api, mutations)
      } else {
        const embeddedTrack = demuxResult.subtitles?.find((s: DemuxedSubtitle) => s.index === rec.streamIndex)
        if (embeddedTrack) {
          const fileCid = await uploadToIpfs(embeddedTrack.path)

          await mutations.createSubtitleTrack.mutateAsync({
            data: {
              episodeId,
              streamIndex: embeddedTrack.index,
              language: rec.language || embeddedTrack.language || 'und',
              title: embeddedTrack.title || undefined,
              format: embeddedTrack.format,
              isDefault: isFirstSub,
              fileCid: fileCid ?? undefined,
              dubGroup: rec.dubGroup || undefined,
              subtitleType: rec.subtitleType || 'full',
            },
          })

          // Удаляем локальный файл после загрузки в IPFS
          if (fileCid) {
            try {
              await api.fs.delete(embeddedTrack.path, false)
            } catch {
              /* ignore */
            }
          }
        }
      }
      isFirstSub = false
    } catch (subError) {
      console.warn(`[SubtitleTrackCreator] Failed to process subtitle:`, subError)
    }
  }
}

/**
 * Обработка внешнего субтитра
 */
async function processExternalSubtitle(
  episodeId: string,
  rec: {
    externalPath?: string
    language?: string
    title?: string
    format: string
    matchedFonts?: Array<{ name: string; path: string }>
    dubGroup?: string
    subtitleType?: string
  },
  episodeOutputDir: string,
  isDefault: boolean,
  api: NonNullable<typeof window.electronAPI>,
  mutations: ImportMutations
): Promise<void> {
  const extPath = rec.externalPath
  if (!extPath) return

  const subFileName = extPath.split(/[/\\]/).pop() || `external_${rec.language}.${rec.format}`
  const destSubPath = `${episodeOutputDir}/${subFileName}`
  await api.fs.copyFile(extPath, destSubPath)

  const fileCid = await uploadToIpfs(destSubPath)

  const subtitleTrack = await mutations.createSubtitleTrack.mutateAsync({
    data: {
      episodeId,
      streamIndex: -1,
      language: rec.language || 'und',
      title: rec.title || undefined,
      format: rec.format,
      isDefault,
      fileCid: fileCid ?? undefined,
      dubGroup: rec.dubGroup || undefined,
      subtitleType: rec.subtitleType || 'full',
    },
  })

  // Удаляем локальный файл после загрузки в IPFS
  if (fileCid) {
    try {
      await api.fs.delete(destSubPath, false)
    } catch {
      /* ignore */
    }
  }

  // Копируем и загружаем шрифты
  if (rec.matchedFonts && rec.matchedFonts.length > 0) {
    await processFonts(subtitleTrack.id, rec.matchedFonts, episodeOutputDir, api, mutations)
  }
}

/**
 * Обработка встроенных субтитров
 */
async function processEmbeddedSubtitles(
  episodeId: string,
  demuxResult: DemuxResult,
  mutations: ImportMutations
): Promise<void> {
  if (!demuxResult.subtitles || demuxResult.subtitles.length === 0) return

  await Promise.all(
    demuxResult.subtitles.map(async (track: DemuxedSubtitle, idx: number) => {
      const fileCid = await uploadToIpfs(track.path)

      return mutations.createSubtitleTrack.mutateAsync({
        data: {
          episodeId,
          streamIndex: track.index,
          language: track.language || 'und',
          title: track.title || undefined,
          format: track.format,
          isDefault: idx === 0,
          fileCid: fileCid ?? undefined,
        },
      })
    })
  )
}

/**
 * Обработка внешних субтитров из externalSubsMap
 */
async function processExternalSubtitles(
  episodeId: string,
  episodeNumber: number,
  episodeOutputDir: string,
  externalSubsMap: Map<number, ExternalSubtitleMatch[]>,
  api: NonNullable<typeof window.electronAPI>,
  mutations: ImportMutations
): Promise<void> {
  const extSubs = externalSubsMap.get(episodeNumber) || []

  for (const extSub of extSubs) {
    try {
      const subFileName = extSub.filePath.split(/[/\\]/).pop() || `external_${extSub.language}.${extSub.format}`
      const destSubPath = `${episodeOutputDir}/${subFileName}`
      await api.fs.copyFile(extSub.filePath, destSubPath)

      const fileCid = await uploadToIpfs(destSubPath)

      const subtitleTrack = await mutations.createSubtitleTrack.mutateAsync({
        data: {
          episodeId,
          streamIndex: -1,
          language: extSub.language || 'und',
          title: extSub.title || undefined,
          format: extSub.format,
          isDefault: false,
          fileCid: fileCid ?? undefined,
        },
      })

      // Удаляем локальный файл после загрузки в IPFS
      if (fileCid) {
        try {
          await api.fs.delete(destSubPath, false)
        } catch {
          /* ignore */
        }
      }

      if (extSub.matchedFonts && extSub.matchedFonts.length > 0) {
        await processFonts(subtitleTrack.id, extSub.matchedFonts, episodeOutputDir, api, mutations)
      }
    } catch (extSubError) {
      console.warn(`[SubtitleTrackCreator] Failed to process external subtitle:`, extSubError)
    }
  }
}

/**
 * Обработка шрифтов для субтитров
 */
async function processFonts(
  subtitleTrackId: string,
  matchedFonts: Array<{ name: string; path: string }>,
  episodeOutputDir: string,
  api: NonNullable<typeof window.electronAPI>,
  mutations: ImportMutations
): Promise<void> {
  const fontsDir = `${episodeOutputDir}/fonts`

  for (const font of matchedFonts) {
    try {
      const fontFileName = font.path.split(/[/\\]/).pop() || `${font.name}.ttf`
      const destFontPath = `${fontsDir}/${fontFileName}`
      await api.fs.copyFile(font.path, destFontPath)

      const fontCid = await uploadToIpfs(destFontPath)

      await mutations.createSubtitleFont.mutateAsync({
        data: {
          subtitleTrackId,
          fontName: font.name,
          fileCid: fontCid ?? undefined,
        },
      })

      // Удаляем локальный файл после загрузки в IPFS
      if (fontCid) {
        try {
          await api.fs.delete(destFontPath, false)
        } catch {
          /* ignore */
        }
      }
    } catch (fontError) {
      console.warn(`[SubtitleTrackCreator] Failed to copy font ${font.name}:`, fontError)
    }
  }
}

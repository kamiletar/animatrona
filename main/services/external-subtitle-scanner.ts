/**
 * Сканер внешних субтитров — поиск ASS/SRT/VTT файлов в папках рядом с видео
 *
 * Поддерживает:
 * - Несколько папок субтитров (Rus Sub/, Eng Sub/, Subs/ и т.д.)
 * - Fuzzy matching субтитров к эпизодам по имени файла
 * - Автоматический поиск шрифтов для ASS
 * - Warning для несматченных файлов
 */

import { readdir } from 'fs/promises'
import path from 'path'
import { scanDirectoryRecursive } from '../utils/fs-utils'
import { getSubtitleInfo } from './subtitle-parser'

/** Паттерны папок субтитров (case-insensitive) */
const SUBTITLE_FOLDER_PATTERNS = [
  'rus sub',
  'eng sub',
  'jpn sub',
  'subs',
  'sub',
  'subtitles',
  'russian',
  'english',
  'japanese',
  'субтитры',
  'рус',
]

/** Паттерны папок шрифтов (case-insensitive) */
const FONT_FOLDER_PATTERNS = ['fonts', 'font', 'шрифты']

/** Расширения файлов субтитров */
const SUBTITLE_EXTENSIONS = new Set(['.ass', '.ssa', '.srt', '.vtt'])

/** Расширения файлов шрифтов */
const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.woff', '.woff2', '.eot'])

/** Результат матчинга субтитра */
export interface ExternalSubtitleMatch {
  /** Путь к файлу субтитров */
  filePath: string
  /** Код языка (ru, en, ja, und) */
  language: string
  /** Название дорожки */
  title: string
  /** Формат (ass, srt, vtt) */
  format: 'ass' | 'srt' | 'vtt' | 'ssa'
  /** Номер эпизода (null если не удалось определить) */
  episodeNumber: number | null
  /** Имена шрифтов из ASS файла */
  fontNames: string[]
  /** Найденные файлы шрифтов */
  matchedFonts: Array<{
    name: string
    path: string
  }>
}

/** Результат сканирования */
export interface ExternalSubtitleScanResult {
  /** Найденные папки субтитров */
  subsDirs: string[]
  /** Найденные папки шрифтов */
  fontsDirs: string[]
  /** Сматченные субтитры */
  subtitles: ExternalSubtitleMatch[]
  /** Несматченные файлы (для warning в UI) */
  unmatchedFiles: string[]
}

/**
 * Извлечь номер эпизода из имени файла
 *
 * Паттерны:
 * - [01], [12], [001]
 * - E01, EP01, Ep12
 * - -01-, _12_
 * - episode 01
 * - S01E05
 */
function _extractEpisodeNumber(fileName: string): number | null {
  const baseName = path.basename(fileName, path.extname(fileName))

  const patterns = [
    // [01], [001], [12] — минимум 2 цифры (исключает [2] в названии типа "Black Butler 2")
    /\[(\d{2,3})\]/,
    // [OVA1], [OVA01] — специальный паттерн для OVA
    /\[OVA(\d{1,2})\]/i,
    // S01E05, S1E12
    /s\d{1,2}e(\d{1,3})/i,
    // E01, EP01, Ep12
    /[eе]p?(\d{1,3})/i,
    // -01-, _12_, .01.
    /[-_.](\d{2,3})[-_.]/,
    // episode 01, Episode 12
    /episode\s*(\d{1,3})/i,
    // Просто число в конце: filename 01
    /\s(\d{2,3})$/,
  ]

  for (const pattern of patterns) {
    const match = baseName.match(pattern)
    if (match) {
      return parseInt(match[1], 10)
    }
  }

  return null
}

/** Результат матчинга с опциональным суффиксом */
interface MatchResult {
  episodeNumber: number
  /** Суффикс из имени файла (.jp_netflix → { lang: 'jp', group: 'netflix' }) */
  suffix?: { lang: string; group: string }
}

/**
 * Нормализовать код языка в ISO 639-1 (2 буквы)
 * ru, rus → ru | en, eng → en | ja, jp, jpn → ja
 */
function normalizeLanguageCode(code: string): string {
  const lower = code.toLowerCase()

  // Русский
  if (lower === 'ru' || lower === 'rus') {
    return 'ru'
  }
  // Английский
  if (lower === 'en' || lower === 'eng') {
    return 'en'
  }
  // Японский
  if (lower === 'ja' || lower === 'jp' || lower === 'jpn') {
    return 'ja'
  }

  return lower.slice(0, 2) // Вернуть первые 2 символа как есть
}

/**
 * Match субтитра к видеофайлу
 *
 * Алгоритм:
 * 1. Точный матч по basename (без расширения)
 * 2. Fallback: убрать суффикс .lang_group и попробовать снова
 *
 * Это предотвращает ложные матчи OVA субтитров к обычным эпизодам
 * когда OVA видео не выбраны пользователем.
 *
 * Суффикс формата `.jp_netflix` содержит язык и источник субтитров.
 */
function fuzzyMatchToVideo(
  subtitleFileName: string,
  videoFiles: Array<{ path: string; episodeNumber: number }>
): MatchResult | null {
  const subBaseName = path.basename(subtitleFileName, path.extname(subtitleFileName)).toLowerCase()

  // 1. Точный матч по имени файла (без расширения)
  for (const video of videoFiles) {
    const videoBaseName = path.basename(video.path, path.extname(video.path)).toLowerCase()
    if (subBaseName === videoBaseName) {
      return { episodeNumber: video.episodeNumber }
    }
    if (subBaseName.startsWith(videoBaseName)) {
      return { episodeNumber: video.episodeNumber }
    }
  }

  // 2. Fallback: попробовать убрать суффикс .lang_group
  // Паттерн: .{lang}_{group} где lang = 2-3 буквы, group = любое название
  const suffixMatch = subBaseName.match(/\.([a-z]{2,3})_([^.]+)$/i)
  if (suffixMatch) {
    const strippedName = subBaseName.replace(/\.[a-z]{2,3}_[^.]+$/i, '')

    for (const video of videoFiles) {
      const videoBaseName = path.basename(video.path, path.extname(video.path)).toLowerCase()
      if (strippedName === videoBaseName) {
        return {
          episodeNumber: video.episodeNumber,
          suffix: { lang: suffixMatch[1].toLowerCase(), group: suffixMatch[2] },
        }
      }
    }
  }

  // Не нашли матч → unmatched
  return null
}

/**
 * Проверить является ли директория папкой субтитров
 */
function isSubtitleFolder(dirName: string): boolean {
  const lower = dirName.toLowerCase()
  return SUBTITLE_FOLDER_PATTERNS.some((pattern) => lower.includes(pattern))
}

/**
 * Проверить является ли директория папкой шрифтов
 */
function isFontFolder(dirName: string): boolean {
  const lower = dirName.toLowerCase()
  return FONT_FOLDER_PATTERNS.some((pattern) => lower === pattern || lower.includes(pattern))
}

/**
 * Найти папки шрифтов внутри директории
 */
async function findFontFolders(dir: string): Promise<string[]> {
  const fontDirs: string[] = []

  try {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory() && isFontFolder(entry.name)) {
        fontDirs.push(path.join(dir, entry.name))
      }
    }
  } catch (e) {
    console.warn(`[ExternalSubScanner] Cannot read dir for fonts: ${dir}`, e)
  }

  return fontDirs
}

/**
 * Собрать все шрифты из папок
 */
async function collectFonts(fontDirs: string[]): Promise<Map<string, string>> {
  /** Map: lowercase fontName → filePath */
  const fonts = new Map<string, string>()

  for (const fontDir of fontDirs) {
    try {
      const entries = await readdir(fontDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (FONT_EXTENSIONS.has(ext)) {
            const fontPath = path.join(fontDir, entry.name)
            // Используем имя файла без расширения как ключ
            const fontName = path.basename(entry.name, ext).toLowerCase()
            fonts.set(fontName, fontPath)
          }
        }
      }
    } catch (e) {
      console.warn(`[ExternalSubScanner] Cannot read font dir: ${fontDir}`, e)
    }
  }

  return fonts
}

/**
 * Матчить имена шрифтов из ASS к файлам
 */
function matchFontsToFiles(
  fontNames: string[],
  availableFonts: Map<string, string>
): Array<{ name: string; path: string }> {
  const matched: Array<{ name: string; path: string }> = []

  for (const fontName of fontNames) {
    const lowerName = fontName.toLowerCase()

    // Точный матч
    const exactMatch = availableFonts.get(lowerName)
    if (exactMatch) {
      matched.push({ name: fontName, path: exactMatch })
      continue
    }

    // Частичный матч (имя шрифта содержится в имени файла или наоборот)
    for (const [fileName, filePath] of availableFonts) {
      if (fileName.includes(lowerName) || lowerName.includes(fileName)) {
        matched.push({ name: fontName, path: filePath })
        break
      }
    }
  }

  return matched
}

/**
 * Сканировать папку на внешние субтитры
 *
 * @param videoFolderPath Путь к папке с видеофайлами
 * @param videoFiles Список видеофайлов с номерами эпизодов
 */
export async function scanForExternalSubtitles(
  videoFolderPath: string,
  videoFiles: Array<{ path: string; episodeNumber: number }>
): Promise<ExternalSubtitleScanResult> {
  console.warn(`[ExternalSubScanner] Scanning: ${videoFolderPath}`)
  console.warn(`[ExternalSubScanner] Video files: ${videoFiles.length}`)

  const result: ExternalSubtitleScanResult = {
    subsDirs: [],
    fontsDirs: [],
    subtitles: [],
    unmatchedFiles: [],
  }

  try {
    // 1. Найти папки субтитров
    const entries = await readdir(videoFolderPath, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory() && isSubtitleFolder(entry.name)) {
        const subsDir = path.join(videoFolderPath, entry.name)
        result.subsDirs.push(subsDir)
        console.warn(`[ExternalSubScanner] Found subs dir: ${entry.name}`)

        // Найти папки шрифтов внутри
        const fontDirs = await findFontFolders(subsDir)
        result.fontsDirs.push(...fontDirs)
      }
    }

    if (result.subsDirs.length === 0) {
      console.warn('[ExternalSubScanner] No subtitle folders found')
      return result
    }

    // 2. Собрать все шрифты
    const availableFonts = await collectFonts(result.fontsDirs)
    console.warn(`[ExternalSubScanner] Found ${availableFonts.size} font files`)

    // 3. Сканировать каждую папку субтитров (рекурсивно до глубины 3)
    for (const subsDir of result.subsDirs) {
      try {
        // Используем рекурсивный сканер для поиска субтитров в подпапках
        for await (const subPath of scanDirectoryRecursive(subsDir, SUBTITLE_EXTENSIONS, 3)) {
          const subFileName = path.basename(subPath)

          // Матчим к эпизоду
          const matchResult = fuzzyMatchToVideo(subFileName, videoFiles)

          if (matchResult === null) {
            result.unmatchedFiles.push(subPath)
            console.warn(`[ExternalSubScanner] Unmatched: ${subFileName}`)
            continue
          }

          // Получаем информацию о субтитрах
          const subInfo = getSubtitleInfo(subPath)

          // Если из суффикса имени файла извлечены язык и группа — используем их
          // Иначе используем данные из файла субтитров
          const finalLanguage = matchResult.suffix?.lang
            ? normalizeLanguageCode(matchResult.suffix.lang)
            : subInfo.language
          const finalTitle = matchResult.suffix?.group || subInfo.title

          // Матчим шрифты для ASS
          const matchedFonts =
            subInfo.format === 'ass' || subInfo.format === 'ssa'
              ? matchFontsToFiles(subInfo.fontNames, availableFonts)
              : []

          result.subtitles.push({
            filePath: subPath,
            language: finalLanguage,
            title: finalTitle,
            format: subInfo.format as 'ass' | 'srt' | 'vtt' | 'ssa',
            episodeNumber: matchResult.episodeNumber,
            fontNames: subInfo.fontNames,
            matchedFonts,
          })

          console.warn(
            `[ExternalSubScanner] Matched: ${subFileName} → ep${matchResult.episodeNumber} [${finalLanguage}/${finalTitle}] (${matchedFonts.length} fonts)`
          )
        }
      } catch (e) {
        console.warn(`[ExternalSubScanner] Cannot read subs dir: ${subsDir}`, e)
      }
    }

    console.warn(
      `[ExternalSubScanner] Result: ${result.subtitles.length} matched, ${result.unmatchedFiles.length} unmatched`
    )
  } catch (e) {
    console.error('[ExternalSubScanner] Error:', e)
  }

  return result
}

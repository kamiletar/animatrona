/**
 * Сканер внешних аудиофайлов — поиск MKA/M4A/FLAC и др. в папках рядом с видео
 *
 * Поддерживает:
 * - Несколько папок аудио (Rus Sound/, Eng Dub/, Audio/ и т.д.)
 * - Fuzzy matching аудио к эпизодам по имени файла
 * - Получение информации о кодеке через FFprobe
 */

import { exec } from 'child_process'
import { readdir } from 'fs/promises'
import path from 'path'
import { promisify } from 'util'
import { scanDirectoryRecursive } from '../utils/fs-utils'

const execAsync = promisify(exec)

/** Паттерны папок аудио (case-insensitive) */
const AUDIO_FOLDER_PATTERNS = [
  // Русские
  'rus sound',
  'rus audio',
  'rus dub',
  'russian',
  'озвучка',
  'рус',
  // Английские
  'eng sound',
  'eng audio',
  'eng dub',
  'english',
  // Японские
  'jpn sound',
  'jpn audio',
  'jpn dub',
  'japanese',
  'jap sound',
  'jap audio',
  'jap dub',
  // Общие
  'sound',
  'audio',
  'dub',
  'voices',
]

/** Расширения аудиофайлов */
const AUDIO_EXTENSIONS = new Set(['.mka', '.m4a', '.flac', '.opus', '.mp3', '.aac', '.wav', '.ogg', '.ac3', '.dts'])

/** Результат матчинга аудио */
export interface ExternalAudioMatch {
  /** Путь к файлу аудио */
  filePath: string
  /** Номер эпизода (null если не удалось определить) */
  episodeNumber: number | null
  /** Код языка (ru, en, ja, und) */
  language: string
  /** Название дорожки */
  title: string
  /** Название папки-группы (озвучки) */
  groupName: string
  /** Кодек (aac, opus, flac и т.д.) */
  codec: string
  /** Количество каналов (2, 6, 8) */
  channels: number
  /** Битрейт в bps */
  bitrate: number
}

/** Результат сканирования */
export interface ExternalAudioScanResult {
  /** Найденные папки аудио */
  audioDirs: string[]
  /** Сматченные аудиофайлы */
  audioTracks: ExternalAudioMatch[]
  /** Несматченные файлы (для warning в UI) */
  unmatchedFiles: string[]
}

/**
 * Проверить является ли директория папкой аудио
 */
function isAudioFolder(dirName: string): boolean {
  const lower = dirName.toLowerCase()
  return AUDIO_FOLDER_PATTERNS.some((pattern) => lower.includes(pattern))
}

/**
 * Является ли директория подпапкой с аудио (любая подпапка не являющаяся корнем)
 * Используется когда явных паттернов нет, но есть подпапки с аудиофайлами
 */
function isAudioExtension(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase()
  return AUDIO_EXTENSIONS.has(ext)
}

/** Результат матчинга с опциональным суффиксом */
interface MatchResult {
  episodeNumber: number
  /** Суффикс из имени файла (.ru_Anilibria → { lang: 'ru', group: 'Anilibria' }) */
  suffix?: { lang: string; group: string }
}

/**
 * Match аудио к видеофайлу
 *
 * Алгоритм:
 * 1. Точный матч по basename (без расширения)
 * 2. Fallback: убрать суффикс .lang_group и попробовать снова
 *
 * Суффикс формата `.ru_Anilibria` содержит язык и имя группы перевода.
 */
function fuzzyMatchToVideo(
  audioFileName: string,
  videoFiles: Array<{ path: string; episodeNumber: number }>
): MatchResult | null {
  const audioBaseName = path.basename(audioFileName, path.extname(audioFileName)).toLowerCase()

  // 1. Точный матч по имени файла (без расширения)
  for (const video of videoFiles) {
    const videoBaseName = path.basename(video.path, path.extname(video.path)).toLowerCase()
    if (audioBaseName === videoBaseName) {
      return { episodeNumber: video.episodeNumber }
    }
  }

  // 2. Fallback: попробовать убрать суффикс .lang_group
  // Паттерн: .{lang}_{group} где lang = 2-3 буквы, group = любое название
  const suffixMatch = audioBaseName.match(/\.([a-z]{2,3})_([^.]+)$/i)
  if (suffixMatch) {
    const strippedName = audioBaseName.replace(/\.[a-z]{2,3}_[^.]+$/i, '')

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

  // 3. Точный матч по имени файла (без расширения)
  for (const video of videoFiles) {
    const videoBaseName = path.basename(video.path, path.extname(video.path)).toLowerCase()
    if (audioBaseName.startsWith(videoBaseName)) {
      return { episodeNumber: video.episodeNumber }
    }
  }

  // Не нашли матч → unmatched
  return null
}

/**
 * Извлечь название дорожки из имени аудиофайла
 *
 * Паттерны:
 * - "video.[5.1].mka" → "5.1"
 * - "video.[Commentary].mka" → "Commentary"
 * - "video.suffix.mka" → "suffix"
 *
 * @returns Название дорожки или null если не найдено
 */
function extractTitleFromAudioFilename(fileName: string): string | null {
  const ext = path.extname(fileName) // .mka, .m4a, etc.
  const nameWithoutExt = path.basename(fileName, ext)

  // Паттерн 1: .[название].ext — название в квадратных скобках
  const bracketMatch = nameWithoutExt.match(/\.\[([^\]]+)\]$/)
  if (bracketMatch) {
    return bracketMatch[1]
  }

  // Паттерн 2: .suffix.ext — суффикс после последней точки
  const lastDotIndex = nameWithoutExt.lastIndexOf('.')
  if (lastDotIndex > 0) {
    const suffix = nameWithoutExt.slice(lastDotIndex + 1).trim()
    // Проверяем что суффикс не похож на технические данные (не "x264", не "FLAC", etc.)
    const technicalSuffixes = ['x264', 'x265', 'hevc', 'av1', 'flac', 'aac', 'opus', 'dts', 'ac3', 'bdremux', 'bdrip']
    if (suffix.length >= 2 && !technicalSuffixes.includes(suffix.toLowerCase())) {
      return suffix
    }
  }

  return null
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
 * Определить язык по названию папки
 */
function detectLanguageFromFolder(folderName: string): string {
  const lower = folderName.toLowerCase()

  if (lower.includes('rus') || lower.includes('рус') || lower.includes('озвучк')) {
    return 'ru'
  }
  if (lower.includes('eng') || lower.includes('english')) {
    return 'en'
  }
  if (lower.includes('jpn') || lower.includes('jap') || lower.includes('japan')) {
    return 'ja'
  }

  return 'und' // undefined
}

/**
 * Получить информацию об аудиофайле через FFprobe
 */
async function probeAudioFile(filePath: string): Promise<{ codec: string; channels: number; bitrate: number }> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_streams -select_streams a:0 "${filePath}"`
    )

    const data = JSON.parse(stdout)
    const stream = data.streams?.[0]

    if (!stream) {
      return { codec: 'unknown', channels: 2, bitrate: 0 }
    }

    return {
      codec: stream.codec_name || 'unknown',
      channels: stream.channels || 2,
      bitrate: parseInt(stream.bit_rate || '0', 10),
    }
  } catch (e) {
    console.warn(`[ExternalAudioScanner] FFprobe error for ${filePath}:`, e)
    return { codec: 'unknown', channels: 2, bitrate: 0 }
  }
}

/**
 * Сканировать папку на внешние аудиофайлы
 *
 * @param videoFolderPath Путь к папке с видеофайлами
 * @param videoFiles Список видеофайлов с номерами эпизодов
 */
export async function scanForExternalAudio(
  videoFolderPath: string,
  videoFiles: Array<{ path: string; episodeNumber: number }>
): Promise<ExternalAudioScanResult> {
  console.warn(`[ExternalAudioScanner] Scanning: ${videoFolderPath}`)
  console.warn(`[ExternalAudioScanner] Video files: ${videoFiles.length}`)

  const result: ExternalAudioScanResult = {
    audioDirs: [],
    audioTracks: [],
    unmatchedFiles: [],
  }

  try {
    // 1. Найти папки аудио (по паттернам ИЛИ любые подпапки с аудиофайлами)
    const entries = await readdir(videoFolderPath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      const dirPath = path.join(videoFolderPath, entry.name)

      // Проверяем по паттерну
      if (isAudioFolder(entry.name)) {
        result.audioDirs.push(dirPath)
        console.warn(`[ExternalAudioScanner] Found audio dir (pattern): ${entry.name}`)
        continue
      }

      // Проверяем содержит ли папка аудиофайлы
      try {
        const subEntries = await readdir(dirPath, { withFileTypes: true })
        const hasAudioFiles = subEntries.some((e) => e.isFile() && isAudioExtension(e.name))

        if (hasAudioFiles) {
          result.audioDirs.push(dirPath)
          console.warn(`[ExternalAudioScanner] Found audio dir (by content): ${entry.name}`)
        }
      } catch {
        // Игнорируем ошибки чтения подпапок
      }
    }

    if (result.audioDirs.length === 0) {
      console.warn('[ExternalAudioScanner] No audio folders found')
      return result
    }

    // 2. Сканировать каждую папку аудио (рекурсивно до глубины 3)
    for (const audioDir of result.audioDirs) {
      const groupName = path.basename(audioDir)
      const language = detectLanguageFromFolder(groupName)

      try {
        // Используем рекурсивный сканер для поиска аудио в подпапках
        for await (const audioPath of scanDirectoryRecursive(audioDir, AUDIO_EXTENSIONS, 3)) {
          const audioFileName = path.basename(audioPath)

          // Матчим к эпизоду
          const matchResult = fuzzyMatchToVideo(audioFileName, videoFiles)

          if (matchResult === null) {
            result.unmatchedFiles.push(audioPath)
            console.warn(`[ExternalAudioScanner] Unmatched: ${audioFileName}`)
            continue
          }

          // Получаем информацию об аудио
          const audioInfo = await probeAudioFile(audioPath)

          // Приоритет извлечения:
          // 1. Суффикс .lang_group из имени файла (Anilibria паттерн)
          // 2. Название в скобках: .[5.1].mka, .[Commentary].mka
          // 3. Название папки
          const finalLanguage = matchResult.suffix?.lang ? normalizeLanguageCode(matchResult.suffix.lang) : language
          const titleFromFilename = extractTitleFromAudioFilename(audioFileName)
          const finalTitle = matchResult.suffix?.group || titleFromFilename || groupName
          const finalGroupName = matchResult.suffix?.group || groupName

          result.audioTracks.push({
            filePath: audioPath,
            episodeNumber: matchResult.episodeNumber,
            language: finalLanguage,
            title: finalTitle, // Название дорожки (5.1, Commentary, etc.)
            groupName: finalGroupName, // Группа озвучки (JAP Sound, RUS Sound, etc.)
            codec: audioInfo.codec,
            channels: audioInfo.channels,
            bitrate: audioInfo.bitrate,
          })

          console.warn(
            `[ExternalAudioScanner] Matched: ${audioFileName} → ep${matchResult.episodeNumber} [${finalLanguage}/${finalTitle}] (${audioInfo.codec}, ${audioInfo.channels}ch)`
          )
        }
      } catch (e) {
        console.warn(`[ExternalAudioScanner] Cannot read audio dir: ${audioDir}`, e)
      }
    }

    console.warn(
      `[ExternalAudioScanner] Result: ${result.audioTracks.length} matched, ${result.unmatchedFiles.length} unmatched`
    )
  } catch (e) {
    console.error('[ExternalAudioScanner] Error:', e)
  }

  return result
}

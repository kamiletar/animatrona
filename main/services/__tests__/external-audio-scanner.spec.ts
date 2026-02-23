import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  detectLanguageFromFolder,
  extractGroupNameFromAudioDir,
  extractTitleFromAudioFilename,
  fuzzyMatchToVideo,
  normalizeLanguageCode,
} from '../external-audio-scanner'

// === extractGroupNameFromAudioDir ===

describe('extractGroupNameFromAudioDir', () => {
  it('извлекает группу из скобок в конце', () => {
    expect(extractGroupNameFromAudioDir('C:/anime/RUS Sound [badPuss]')).toBe('badPuss')
  })

  it('извлекает группу когда имя — только скобки', () => {
    expect(extractGroupNameFromAudioDir('/path/[negaushi]')).toBe('negaushi')
  })

  it('извлекает группу с пробелами и спецсимволами', () => {
    expect(extractGroupNameFromAudioDir('/path/[DemonOFmooN & MezIdA]')).toBe('DemonOFmooN & MezIdA')
  })

  it('извлекает группу с кириллицей', () => {
    expect(extractGroupNameFromAudioDir('/path/[Мирра & JeFerson]')).toBe('Мирра & JeFerson')
  })

  it('извлекает группу из RUS Sound [Team]', () => {
    expect(extractGroupNameFromAudioDir('/path/RUS Sound [Yakusub Studio]')).toBe('Yakusub Studio')
  })

  it('возвращает undefined без скобок', () => {
    expect(extractGroupNameFromAudioDir('/path/RUS Sound')).toBeUndefined()
  })

  it('возвращает undefined для пустой строки', () => {
    expect(extractGroupNameFromAudioDir('')).toBeUndefined()
  })

  it('использует только basename, игнорируя родительские скобки', () => {
    // Путь содержит [BDRip] в родителе, но basename "RUS Sound" без скобок
    expect(extractGroupNameFromAudioDir('C:/Downloads/Anime [BDRip] [1080p]/RUS Sound')).toBeUndefined()
  })

  it('извлекает группу из подпапки внутри аудиопапки', () => {
    // Основной кейс бага: RUS Sound/[badPuss]/
    expect(extractGroupNameFromAudioDir('C:/Downloads/Anime [BDRip]/RUS Sound/[badPuss]')).toBe('badPuss')
  })

  it('обрезает пробелы в имени группы', () => {
    expect(extractGroupNameFromAudioDir('/path/[ spaced ]')).toBe('spaced')
  })
})

// === detectLanguageFromFolder ===

describe('detectLanguageFromFolder', () => {
  it('определяет русский по "RUS Sound"', () => {
    expect(detectLanguageFromFolder('RUS Sound')).toBe('ru')
  })

  it('определяет русский по "Озвучка"', () => {
    expect(detectLanguageFromFolder('Озвучка')).toBe('ru')
  })

  it('определяет русский по "rus dub"', () => {
    expect(detectLanguageFromFolder('rus dub')).toBe('ru')
  })

  it('определяет английский по "ENG Sound"', () => {
    expect(detectLanguageFromFolder('ENG Sound')).toBe('en')
  })

  it('определяет английский по "English"', () => {
    expect(detectLanguageFromFolder('English')).toBe('en')
  })

  it('определяет японский по "JPN Sound"', () => {
    expect(detectLanguageFromFolder('JPN Sound')).toBe('ja')
  })

  it('определяет японский по "Japanese"', () => {
    expect(detectLanguageFromFolder('Japanese')).toBe('ja')
  })

  it('возвращает "und" для неизвестных папок', () => {
    expect(detectLanguageFromFolder('Audio')).toBe('und')
    expect(detectLanguageFromFolder('[badPuss]')).toBe('und')
  })
})

// === normalizeLanguageCode ===

describe('normalizeLanguageCode', () => {
  it('нормализует "rus" → "ru"', () => {
    expect(normalizeLanguageCode('rus')).toBe('ru')
  })

  it('оставляет "ru" как "ru"', () => {
    expect(normalizeLanguageCode('ru')).toBe('ru')
  })

  it('нормализует "eng" → "en"', () => {
    expect(normalizeLanguageCode('eng')).toBe('en')
  })

  it('нормализует "jpn" → "ja"', () => {
    expect(normalizeLanguageCode('jpn')).toBe('ja')
  })

  it('нормализует "jp" → "ja"', () => {
    expect(normalizeLanguageCode('jp')).toBe('ja')
  })

  it('обрезает неизвестные до 2 символов', () => {
    expect(normalizeLanguageCode('kor')).toBe('ko')
  })
})

// === extractTitleFromAudioFilename ===

describe('extractTitleFromAudioFilename', () => {
  it('извлекает название из квадратных скобок перед расширением', () => {
    expect(extractTitleFromAudioFilename('video.[5.1].mka')).toBe('5.1')
  })

  it('извлекает Commentary', () => {
    expect(extractTitleFromAudioFilename('video.[Commentary].mka')).toBe('Commentary')
  })

  it('извлекает суффикс после точки', () => {
    expect(extractTitleFromAudioFilename('video.stereo.mka')).toBe('stereo')
  })

  it('не извлекает технические суффиксы', () => {
    expect(extractTitleFromAudioFilename('video.flac.mka')).toBeNull()
    expect(extractTitleFromAudioFilename('video.aac.m4a')).toBeNull()
  })

  it('возвращает null для обычного имени', () => {
    expect(extractTitleFromAudioFilename('episode01.mka')).toBeNull()
  })

  it('не возвращает слишком короткие суффиксы', () => {
    expect(extractTitleFromAudioFilename('video.a.mka')).toBeNull()
  })
})

// === fuzzyMatchToVideo ===

describe('fuzzyMatchToVideo', () => {
  const videoFiles = [
    { path: '[Yousei-raws] Haiyore! Nyaruko-san 01 [BDrip 1920x1080 x264 FLAC].mkv', episodeNumber: 1 },
    { path: '[Yousei-raws] Haiyore! Nyaruko-san 02 [BDrip 1920x1080 x264 FLAC].mkv', episodeNumber: 2 },
    { path: '[Yousei-raws] Haiyore! Nyaruko-san 12 [BDrip 1920x1080 x264 FLAC].mkv', episodeNumber: 12 },
  ]

  it('точный матч по имени (без расширения)', () => {
    const result = fuzzyMatchToVideo(
      '[Yousei-raws] Haiyore! Nyaruko-san 01 [BDrip 1920x1080 x264 FLAC].mka',
      videoFiles
    )
    expect(result).toEqual({ episodeNumber: 1 })
  })

  it('матч по префиксу (startsWith)', () => {
    const result = fuzzyMatchToVideo(
      '[Yousei-raws] Haiyore! Nyaruko-san 02 [BDrip 1920x1080 x264 FLAC].extra.mka',
      videoFiles
    )
    expect(result).toEqual({ episodeNumber: 2 })
  })

  it('матч с суффиксом .lang_group', () => {
    const result = fuzzyMatchToVideo(
      '[Yousei-raws] Haiyore! Nyaruko-san 12 [BDrip 1920x1080 x264 FLAC].ru_AniLibria.mka',
      videoFiles
    )
    expect(result).toEqual({
      episodeNumber: 12,
      suffix: { lang: 'ru', group: 'anilibria' },
    })
  })

  it('возвращает null для несматченного файла', () => {
    const result = fuzzyMatchToVideo('random_file.mka', videoFiles)
    expect(result).toBeNull()
  })

  it('case-insensitive матч', () => {
    const result = fuzzyMatchToVideo(
      '[YOUSEI-RAWS] HAIYORE! NYARUKO-SAN 01 [BDRIP 1920X1080 X264 FLAC].mka',
      videoFiles
    )
    expect(result).toEqual({ episodeNumber: 1 })
  })
})

// === Интеграционный тест: логика определения groupName для подпапок ===

describe('логика определения groupName из подпапок', () => {
  it('RUS Sound/[badPuss]/episode.mka → groupName = "badPuss"', () => {
    // Симулируем логику из scanForExternalAudio
    const audioDir = 'C:/Downloads/Anime/RUS Sound'
    const audioPath = 'C:/Downloads/Anime/RUS Sound/[badPuss]/episode.mka'

    const topGroupName = extractGroupNameFromAudioDir(audioDir) || 'RUS Sound'

    // Логика из фикса: проверяем непосредственного родителя
    const parentDir = path.dirname(audioPath)
    const groupName = parentDir !== audioDir ? extractGroupNameFromAudioDir(parentDir) || topGroupName : topGroupName

    expect(groupName).toBe('badPuss')
  })

  it('RUS Sound/episode.mka → groupName = "RUS Sound"', () => {
    const audioDir = 'C:/Downloads/Anime/RUS Sound'
    const audioPath = 'C:/Downloads/Anime/RUS Sound/episode.mka'

    const topGroupName = extractGroupNameFromAudioDir(audioDir) || 'RUS Sound'

    const parentDir = path.dirname(audioPath)
    const groupName = parentDir !== audioDir ? extractGroupNameFromAudioDir(parentDir) || topGroupName : topGroupName

    expect(groupName).toBe('RUS Sound')
  })

  it('RUS Sound [Team]/episode.mka → groupName = "Team"', () => {
    const audioDir = 'C:/Downloads/Anime/RUS Sound [Team]'
    const audioPath = 'C:/Downloads/Anime/RUS Sound [Team]/episode.mka'

    const topGroupName = extractGroupNameFromAudioDir(audioDir) || 'RUS Sound [Team]'

    const parentDir = path.dirname(audioPath)
    const groupName = parentDir !== audioDir ? extractGroupNameFromAudioDir(parentDir) || topGroupName : topGroupName

    expect(groupName).toBe('Team')
  })

  it('RUS Sound/[Мирра & JeFerson]/episode.mka → groupName с кириллицей', () => {
    const audioDir = 'C:/Downloads/Anime/RUS Sound'
    const audioPath = 'C:/Downloads/Anime/RUS Sound/[Мирра & JeFerson]/episode.mka'

    const topGroupName = extractGroupNameFromAudioDir(audioDir) || 'RUS Sound'

    const parentDir = path.dirname(audioPath)
    const groupName = parentDir !== audioDir ? extractGroupNameFromAudioDir(parentDir) || topGroupName : topGroupName

    expect(groupName).toBe('Мирра & JeFerson')
  })

  it('RUS Sound/plain_subfolder/episode.mka → fallback к "RUS Sound"', () => {
    // Подпапка без скобок — fallback к имени корневой аудио-папки
    const audioDir = 'C:/Downloads/Anime/RUS Sound'
    const audioPath = 'C:/Downloads/Anime/RUS Sound/plain_subfolder/episode.mka'

    const topGroupName = extractGroupNameFromAudioDir(audioDir) || 'RUS Sound'

    const parentDir = path.dirname(audioPath)
    const groupName = parentDir !== audioDir ? extractGroupNameFromAudioDir(parentDir) || topGroupName : topGroupName

    expect(groupName).toBe('RUS Sound')
  })
})

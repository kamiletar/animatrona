import { describe, expect, it } from 'vitest'
import { parseEpisodeInfo, parseEpisodeNumber } from '../parse-filename'

describe('parseEpisodeNumber', () => {
  describe('fansub формат с сезоном и годом: [Group] Title Season (Year) - XX [Quality]', () => {
    it('распознаёт [VARYG] Dan Da Dan 2 (2025) - 01 [WEB-DL 1080p x264 AAC].mkv', () => {
      expect(parseEpisodeNumber('[VARYG] Dan Da Dan 2 (2025) - 01 [WEB-DL 1080p x264 AAC].mkv')).toBe(1)
    })

    it('распознаёт [VARYG] Dan Da Dan 2 (2025) - 12 [WEB-DL 1080p x264 AAC].mkv', () => {
      expect(parseEpisodeNumber('[VARYG] Dan Da Dan 2 (2025) - 12 [WEB-DL 1080p x264 AAC].mkv')).toBe(12)
    })

    it('распознаёт [Group] Anime Name 3 (2024) - 05 [1080p].mkv', () => {
      expect(parseEpisodeNumber('[Group] Anime Name 3 (2024) - 05 [1080p].mkv')).toBe(5)
    })

    it('не путает номер сезона с номером эпизода', () => {
      // Номер сезона "2" не должен быть распознан как эпизод
      const result = parseEpisodeNumber('[VARYG] Dan Da Dan 2 (2025) - 01 [WEB-DL 1080p x264 AAC].mkv')
      expect(result).not.toBe(2)
      expect(result).toBe(1)
    })
  })

  describe('S01E01 формат', () => {
    it('распознаёт S01E01', () => {
      expect(parseEpisodeNumber('Anime S01E01.mkv')).toBe(1)
    })

    it('распознаёт S02E13', () => {
      expect(parseEpisodeNumber('Anime S02E13 [1080p].mkv')).toBe(13)
    })
  })

  describe('формат [XX]', () => {
    it('распознаёт [01]', () => {
      expect(parseEpisodeNumber('[SubGroup] Anime [01] [1080p].mkv')).toBe(1)
    })

    it('распознаёт [12]', () => {
      expect(parseEpisodeNumber('Anime [12].mkv')).toBe(12)
    })
  })

  describe('формат ][XX][', () => {
    it('распознаёт ][01][', () => {
      expect(parseEpisodeNumber('[SubGroup][Anime][01][1080p].mkv')).toBe(1)
    })

    it('распознаёт ][13][', () => {
      expect(parseEpisodeNumber('[Group][Title][13][720p].mkv')).toBe(13)
    })
  })

  describe('формат - XX [', () => {
    it('распознаёт - 01 [', () => {
      expect(parseEpisodeNumber('Anime - 01 [1080p].mkv')).toBe(1)
    })

    it('распознаёт - 25 [', () => {
      expect(parseEpisodeNumber('[Group] Anime Title - 25 [BDRip].mkv')).toBe(25)
    })
  })

  describe('формат XX (Quality)', () => {
    it('распознаёт 01 (720p)', () => {
      expect(parseEpisodeNumber('Anime 01 (720p).mkv')).toBe(1)
    })

    it('не матчит год как эпизод: 2 (2025)', () => {
      // "Title 2 (2025)" — 2 это сезон, 2025 это год. Не должно матчить 2 как эпизод
      const result = parseEpisodeNumber('Title 2 (2025).mkv')
      expect(result).not.toBe(2)
    })
  })

  describe('формат Episode XX', () => {
    it('распознаёт Episode 01', () => {
      expect(parseEpisodeNumber('Anime Episode 01.mkv')).toBe(1)
    })

    it('распознаёт Ep12', () => {
      expect(parseEpisodeNumber('Anime Ep12.mkv')).toBe(12)
    })
  })

  describe('формат Name_XX или Name-XX', () => {
    it('распознаёт Name_01', () => {
      expect(parseEpisodeNumber('Anime_01.mkv')).toBe(1)
    })

    it('распознаёт Name-12', () => {
      expect(parseEpisodeNumber('Anime-12.mkv')).toBe(12)
    })
  })

  describe('формат XX.ext в начале', () => {
    it('распознаёт 01.mkv', () => {
      expect(parseEpisodeNumber('01.mkv')).toBe(1)
    })

    it('распознаёт 01v2.mkv', () => {
      expect(parseEpisodeNumber('01v2.mkv')).toBe(1)
    })
  })

  describe('OVA и Special', () => {
    it('распознаёт OVA01', () => {
      const result = parseEpisodeInfo('Anime OVA01.mkv')
      expect(result?.number).toBe(1)
      expect(result?.type).toBe('ova')
    })

    it('распознаёт Special 02', () => {
      const result = parseEpisodeInfo('Anime Special 02.mkv')
      expect(result?.number).toBe(2)
      expect(result?.type).toBe('ova')
    })
  })

  describe('граничные случаи', () => {
    it('возвращает null для файла без номера', () => {
      expect(parseEpisodeNumber('Anime Movie.mkv')).toBeNull()
    })

    it('не матчит слишком большие числа', () => {
      // 99999 > 9999, должен быть null
      expect(parseEpisodeNumber('Anime 99999.mkv')).toBeNull()
    })
  })

  describe('реальные файлы из Downloads (regression tests)', () => {
    // SK8 the Infinity — формат ` - XX [`
    it('[IrizaRaws] SK8 the Infinity - 01 [BDRip 1080p x264 FLAC].mkv', () => {
      expect(parseEpisodeNumber('[IrizaRaws] SK8 the Infinity - 01 [BDRip 1080p x264 FLAC].mkv')).toBe(1)
    })

    // Phi Brain — формат [XX]
    it('[SHIZA Project] Phi Brain - Kami no Puzzle TV3 [01] [Mustadio & Oni].mkv', () => {
      expect(parseEpisodeNumber('[SHIZA Project] Phi Brain - Kami no Puzzle TV3 [01] [Mustadio & Oni].mkv')).toBe(1)
    })

    // Kimetsu no Yaiba — формат ` - XX [`
    it('[VCB-Studio] Kimetsu no Yaiba - Mugen Ressha-Hen - 01 [BDRip 1080p x265 FLAC].mkv', () => {
      expect(
        parseEpisodeNumber('[VCB-Studio] Kimetsu no Yaiba - Mugen Ressha-Hen - 01 [BDRip 1080p x265 FLAC].mkv')
      ).toBe(1)
    })

    // Phi Brain — формат Name_XX
    it('[Raizel] Phi_Brain_01.mkv', () => {
      expect(parseEpisodeNumber('[Raizel] Phi_Brain_01.mkv')).toBe(1)
    })

    // Danganronpa — формат ep.XX
    it('[anti-raws]Danganronpa - Kibou no Gakuen to Zetsubou no Koukousei The Animation ep.01[BDRemux].mkv', () => {
      expect(
        parseEpisodeNumber(
          '[anti-raws]Danganronpa - Kibou no Gakuen to Zetsubou no Koukousei The Animation ep.01[BDRemux].mkv'
        )
      ).toBe(1)
    })

    // Danganronpa 3 — формат ep.XX
    it('[anti-raws]Danganronpa 3 The End of Kibougamine Gakuen - Mirai Hen ep.12[BDRemux].mkv', () => {
      expect(
        parseEpisodeNumber('[anti-raws]Danganronpa 3 The End of Kibougamine Gakuen - Mirai Hen ep.12[BDRemux].mkv')
      ).toBe(12)
    })

    // Phi Brain TV-2 — формат XX_ в начале
    it('01_Phi_Brain_TV_2_[ru_&_jp]_[Persona99_&_AnimeReactor].mkv', () => {
      expect(parseEpisodeNumber('01_Phi_Brain_TV_2_[ru_&_jp]_[Persona99_&_AnimeReactor].mkv')).toBe(1)
    })

    // Undead Unluck — формат ` - XX [`
    it('Undead Unluck - 01 [BDRip 1080p HEVC 10bits FLAC].mkv', () => {
      expect(parseEpisodeNumber('Undead Unluck - 01 [BDRip 1080p HEVC 10bits FLAC].mkv')).toBe(1)
    })

    // Dan Da Dan 2 — проблемный формат с сезоном и годом
    it('[VARYG] Dan Da Dan 2 (2025) - 01 [WEB-DL 1080p x264 AAC].mkv', () => {
      expect(parseEpisodeNumber('[VARYG] Dan Da Dan 2 (2025) - 01 [WEB-DL 1080p x264 AAC].mkv')).toBe(1)
    })

    it('[VARYG] Dan Da Dan 2 (2025) - 12 [WEB-DL 1080p x264 AAC].mkv', () => {
      expect(parseEpisodeNumber('[VARYG] Dan Da Dan 2 (2025) - 12 [WEB-DL 1080p x264 AAC].mkv')).toBe(12)
    })
  })
})

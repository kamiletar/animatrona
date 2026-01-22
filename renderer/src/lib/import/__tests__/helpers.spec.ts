import { describe, expect, it } from 'vitest'
import {
  createConcurrencyLimiter,
  detectChapterType,
  formatChannels,
  getPosterUrl,
  isChapterSkippable,
  mapSeasonType,
  mapShikimoriStatus,
  needsAudioTranscode,
} from '../helpers'

describe('helpers', () => {
  describe('createConcurrencyLimiter', () => {
    it('ограничивает количество параллельных задач', async () => {
      const limit = createConcurrencyLimiter(2)
      const running: number[] = []
      const results: number[] = []

      const task = (id: number, delay: number) =>
        limit(async () => {
          running.push(id)
          await new Promise((resolve) => setTimeout(resolve, delay))
          results.push(id)
          running.splice(running.indexOf(id), 1)
          return id
        })

      // Запускаем 4 задачи с разными задержками
      const promises = [task(1, 50), task(2, 50), task(3, 50), task(4, 50)]

      // Даём время первым двум задачам начаться
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(running.length).toBeLessThanOrEqual(2)

      await Promise.all(promises)
      expect(results.length).toBe(4)
    })

    it('возвращает результат функции', async () => {
      const limit = createConcurrencyLimiter(1)
      const result = await limit(async () => 42)
      expect(result).toBe(42)
    })

    it('пробрасывает ошибки', async () => {
      const limit = createConcurrencyLimiter(1)
      await expect(
        limit(async () => {
          throw new Error('Test error')
        })
      ).rejects.toThrow('Test error')
    })
  })

  describe('getPosterUrl', () => {
    it('возвращает null для пустых значений', () => {
      expect(getPosterUrl(null)).toBeNull()
      expect(getPosterUrl(undefined)).toBeNull()
      expect(getPosterUrl('')).toBeNull()
    })

    it('возвращает полный URL без изменений', () => {
      const url = 'https://example.com/poster.jpg'
      expect(getPosterUrl(url)).toBe(url)
    })

    it('добавляет домен Shikimori к относительному URL', () => {
      expect(getPosterUrl('/uploads/poster.jpg')).toBe('https://shikimori.one/uploads/poster.jpg')
    })

    it('обрабатывает http URL', () => {
      const url = 'http://example.com/poster.jpg'
      expect(getPosterUrl(url)).toBe(url)
    })
  })

  describe('needsAudioTranscode', () => {
    describe('MP3', () => {
      it('никогда не перекодирует MP3', () => {
        expect(needsAudioTranscode('mp3', 320000)).toBe(false)
        expect(needsAudioTranscode('MP3', 128000)).toBe(false)
        expect(needsAudioTranscode('mp3', null)).toBe(false)
      })
    })

    describe('AAC', () => {
      it('не перекодирует AAC с низким битрейтом (≤256kbps)', () => {
        expect(needsAudioTranscode('aac', 128000)).toBe(false)
        expect(needsAudioTranscode('aac', 256000)).toBe(false)
        expect(needsAudioTranscode('AAC', 192000)).toBe(false)
      })

      it('перекодирует AAC с высоким битрейтом (>256kbps)', () => {
        expect(needsAudioTranscode('aac', 320000)).toBe(true)
        expect(needsAudioTranscode('aac', 512000)).toBe(true)
      })

      it('перекодирует AAC без известного битрейта', () => {
        expect(needsAudioTranscode('aac', null)).toBe(true)
        expect(needsAudioTranscode('aac', undefined)).toBe(true)
        expect(needsAudioTranscode('aac', 0)).toBe(true)
      })
    })

    describe('Lossless кодеки', () => {
      it('перекодирует FLAC', () => {
        expect(needsAudioTranscode('flac', null)).toBe(true)
        expect(needsAudioTranscode('FLAC', 1411000)).toBe(true)
      })

      it('перекодирует WAV/PCM', () => {
        expect(needsAudioTranscode('pcm_s16le', null)).toBe(true)
        expect(needsAudioTranscode('pcm_s24le', null)).toBe(true)
      })
    })

    describe('Другие кодеки', () => {
      it('перекодирует Opus', () => {
        expect(needsAudioTranscode('opus', 128000)).toBe(true)
      })

      it('перекодирует Vorbis', () => {
        expect(needsAudioTranscode('vorbis', 192000)).toBe(true)
      })

      it('перекодирует DTS', () => {
        expect(needsAudioTranscode('dts', 1536000)).toBe(true)
      })

      it('перекодирует AC3', () => {
        expect(needsAudioTranscode('ac3', 384000)).toBe(true)
      })
    })
  })

  describe('formatChannels', () => {
    it('форматирует моно', () => {
      expect(formatChannels(1)).toBe('1.0')
    })

    it('форматирует стерео', () => {
      expect(formatChannels(2)).toBe('2.0')
    })

    it('форматирует 5.1', () => {
      expect(formatChannels(6)).toBe('5.1')
    })

    it('форматирует 7.1', () => {
      expect(formatChannels(8)).toBe('7.1')
    })

    it('форматирует нестандартное количество каналов', () => {
      expect(formatChannels(4)).toBe('4.0')
      expect(formatChannels(10)).toBe('10.0')
    })
  })

  describe('mapShikimoriStatus', () => {
    it('маппит ongoing', () => {
      expect(mapShikimoriStatus('ongoing')).toBe('ONGOING')
    })

    it('маппит released', () => {
      expect(mapShikimoriStatus('released')).toBe('COMPLETED')
    })

    it('маппит anons', () => {
      expect(mapShikimoriStatus('anons')).toBe('ANNOUNCED')
    })

    it('возвращает ONGOING для неизвестных статусов', () => {
      expect(mapShikimoriStatus('unknown')).toBe('ONGOING')
      expect(mapShikimoriStatus('')).toBe('ONGOING')
    })
  })

  describe('mapSeasonType', () => {
    it('маппит tv', () => {
      expect(mapSeasonType('tv')).toBe('TV')
    })

    it('маппит ova', () => {
      expect(mapSeasonType('ova')).toBe('OVA')
    })

    it('маппит ona', () => {
      expect(mapSeasonType('ona')).toBe('ONA')
    })

    it('маппит movie', () => {
      expect(mapSeasonType('movie')).toBe('MOVIE')
    })

    it('маппит special', () => {
      expect(mapSeasonType('special')).toBe('SPECIAL')
    })

    it('возвращает TV для null', () => {
      expect(mapSeasonType(null)).toBe('TV')
    })

    it('возвращает TV для неизвестных типов', () => {
      expect(mapSeasonType('unknown')).toBe('TV')
    })
  })

  describe('detectChapterType', () => {
    it('определяет OP', () => {
      expect(detectChapterType('Opening')).toBe('OP')
      expect(detectChapterType('OP')).toBe('OP')
      expect(detectChapterType('op1')).toBe('OP')
    })

    it('определяет ED', () => {
      expect(detectChapterType('Ending')).toBe('ED')
      expect(detectChapterType('ED')).toBe('ED')
      expect(detectChapterType('ed2')).toBe('ED')
    })

    it('определяет RECAP', () => {
      expect(detectChapterType('Recap')).toBe('RECAP')
      expect(detectChapterType('Previously on...')).toBe('RECAP')
      expect(detectChapterType('previous episode')).toBe('RECAP')
    })

    it('определяет PREVIEW', () => {
      expect(detectChapterType('Preview')).toBe('PREVIEW')
      expect(detectChapterType('Next Episode')).toBe('PREVIEW')
      expect(detectChapterType('next time')).toBe('PREVIEW')
    })

    it('возвращает CHAPTER для обычных глав', () => {
      expect(detectChapterType('Chapter 1')).toBe('CHAPTER')
      expect(detectChapterType('Part A')).toBe('CHAPTER')
      expect(detectChapterType('Episode Start')).toBe('CHAPTER')
    })

    it('возвращает CHAPTER для null', () => {
      expect(detectChapterType(null)).toBe('CHAPTER')
    })
  })

  describe('isChapterSkippable', () => {
    it('возвращает true для OP', () => {
      expect(isChapterSkippable('Opening')).toBe(true)
    })

    it('возвращает true для ED', () => {
      expect(isChapterSkippable('Ending')).toBe(true)
    })

    it('возвращает true для RECAP', () => {
      expect(isChapterSkippable('Recap')).toBe(true)
    })

    it('возвращает true для PREVIEW', () => {
      expect(isChapterSkippable('Preview')).toBe(true)
    })

    it('возвращает false для обычных глав', () => {
      expect(isChapterSkippable('Chapter 1')).toBe(false)
      expect(isChapterSkippable('Part A')).toBe(false)
      expect(isChapterSkippable(null)).toBe(false)
    })
  })
})

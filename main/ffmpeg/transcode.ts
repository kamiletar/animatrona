/**
 * Модуль транскодирования — перекодирование видео и аудио
 */

import * as path from 'path'
import { spawnFFmpeg } from '../utils/ffmpeg-spawn'
import { getVideoDuration } from './probe'
import type {
  AudioTranscodeOptions,
  AudioTranscodeVBROptions,
  EncodingProfileOptions,
  TranscodeProgress,
  VideoTranscodeOptions,
} from './types'
import { parseTimeToSeconds } from './utils'

/**
 * Транскодирование видео в AV1
 *
 * @param inputPath Путь к исходному видео
 * @param outputPath Путь для выходного файла
 * @param options Настройки кодирования
 * @param onProgress Callback для прогресса
 */
export async function transcodeVideo(
  inputPath: string,
  outputPath: string,
  options: VideoTranscodeOptions,
  onProgress?: (progress: TranscodeProgress) => void
): Promise<void> {
  const duration = await getVideoDuration(inputPath)

  const args = ['-y', '-i', inputPath]

  // Выбор кодека на основе настроек
  const codec = options.codec || 'av1'

  if (options.useGpu) {
    // NVIDIA NVENC кодеки
    const nvencCodecs = {
      av1: 'av1_nvenc',
      hevc: 'hevc_nvenc',
      h264: 'h264_nvenc',
    }
    args.push(
      '-c:v',
      nvencCodecs[codec],
      '-cq',
      options.cq.toString(),
      '-preset',
      options.preset,
      '-tune',
      'hq',
      '-rc',
      'constqp',
      '-g',
      '360',
      '-spatial-aq',
      '1',
      '-temporal-aq',
      '1',
      '-aq-strength',
      '15'
    )
  } else {
    // CPU кодеки
    const cpuCodecs = {
      av1: 'libsvtav1',
      hevc: 'libx265',
      h264: 'libx264',
    }
    args.push('-c:v', cpuCodecs[codec], '-crf', options.cq.toString(), '-preset', options.preset, '-g', '360')
  }

  // Без аудио (обрабатываем отдельно)
  args.push('-an')

  // Выходной файл
  args.push(outputPath)

  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const ff = spawnFFmpeg(args)

    ff.stderr.on('data', (data) => {
      const str = data.toString()
      const currentTime = parseTimeToSeconds(str)

      if (currentTime !== null && onProgress) {
        const percent = Math.min(100, (currentTime / duration) * 100)
        const elapsed = (Date.now() - startTime) / 1000
        const eta = elapsed > 0 ? (elapsed / percent) * (100 - percent) : 0

        onProgress({
          percent,
          currentTime,
          totalDuration: duration,
          eta,
          stage: 'video',
        })
      }
    })

    ff.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg video transcode exited with code ${code}`))
      }
    })

    ff.on('error', reject)
  })
}

/**
 * Конвертация аудио в AAC
 *
 * @param inputPath Путь к исходному аудио/видео
 * @param outputPath Путь для выходного файла
 * @param options Настройки кодирования
 * @param onProgress Callback для прогресса
 */
export async function transcodeAudio(
  inputPath: string,
  outputPath: string,
  options: AudioTranscodeOptions,
  onProgress?: (progress: TranscodeProgress) => void
): Promise<void> {
  const duration = await getVideoDuration(inputPath)
  const { syncOffset } = options

  // Временный WAV файл для промежуточной обработки
  const tempWav = outputPath.replace(path.extname(outputPath), '.wav')

  // Шаг 1: Декодирование в WAV
  await new Promise<void>((resolve, reject) => {
    const startTime = Date.now()

    // Аргументы для FFmpeg
    const args: string[] = ['-y']

    // Положительное смещение: донор опережает → обрезать начало через -ss (до -i)
    if (syncOffset && syncOffset > 0) {
      args.push('-ss', (syncOffset / 1000).toFixed(3))
    }

    args.push('-i', inputPath)

    // Если указан streamIndex — выбираем конкретный аудиопоток (для MKV без demux)
    if (options.streamIndex !== undefined) {
      args.push('-map', `0:a:${options.streamIndex}`)
    }

    args.push('-ar', options.sampleRate.toString(), '-ac', options.channels.toString())

    // Отрицательное смещение: донор отстаёт → добавить тишину через adelay
    if (syncOffset && syncOffset < 0) {
      const delayMs = Math.abs(syncOffset)
      // adelay формат: delay_left|delay_right (для стерео)
      // Для многоканального аудио — все каналы получат одинаковую задержку
      args.push('-af', `adelay=${delayMs}|${delayMs}|${delayMs}|${delayMs}|${delayMs}|${delayMs}|${delayMs}|${delayMs}`)
    }

    args.push(tempWav)

    const ff = spawnFFmpeg(args)

    ff.stderr.on('data', (data) => {
      const str = data.toString()
      const currentTime = parseTimeToSeconds(str)

      if (currentTime !== null && onProgress) {
        const percent = Math.min(50, (currentTime / duration) * 50)
        const elapsed = (Date.now() - startTime) / 1000
        const eta = elapsed > 0 ? (elapsed / percent) * (100 - percent) : 0

        onProgress({
          percent,
          currentTime,
          totalDuration: duration,
          eta,
          stage: 'audio',
        })
      }
    })

    ff.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg audio decode exited with code ${code}`))
      }
    })

    ff.on('error', reject)
  })

  // Шаг 2: Кодирование в AAC
  await new Promise<void>((resolve, reject) => {
    const startTime = Date.now()
    const ff = spawnFFmpeg(['-y', '-i', tempWav, '-c:a', 'aac', '-b:a', `${options.bitrate}k`, outputPath])

    ff.stderr.on('data', (data) => {
      const str = data.toString()
      const currentTime = parseTimeToSeconds(str)

      if (currentTime !== null && onProgress) {
        const percent = Math.min(100, 50 + (currentTime / duration) * 50)
        const elapsed = (Date.now() - startTime) / 1000
        const eta = elapsed > 0 ? (elapsed / (percent - 50)) * (100 - percent) : 0

        onProgress({
          percent,
          currentTime,
          totalDuration: duration,
          eta,
          stage: 'audio',
        })
      }
    })

    ff.on('close', async (code) => {
      // Удаляем временный WAV файл
      try {
        const fs = await import('fs')
        fs.unlinkSync(tempWav)
      } catch {
        // Игнорируем ошибки удаления
      }

      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg audio encode exited with code ${code}`))
      }
    })

    ff.on('error', reject)
  })
}

/** Дефолтные настройки видео */
export const defaultVideoOptions: VideoTranscodeOptions = {
  codec: 'av1',
  useGpu: true,
  cq: 24,
  preset: 'p5',
}

/** Дефолтные настройки аудио */
export const defaultAudioOptions: AudioTranscodeOptions = {
  bitrate: 256,
  sampleRate: 48000,
  channels: 2,
}

/**
 * Конвертация аудио в AAC с VBR (target bitrate)
 *
 * Отличия от transcodeAudio():
 * - Напрямую конвертирует без промежуточного WAV
 * - Target bitrate вместо CBR
 * - Опциональные sampleRate/channels (по умолчанию сохраняет исходные)
 *
 * @param inputPath Путь к исходному аудио/видео
 * @param outputPath Путь для выходного файла (.m4a или .aac)
 * @param options Настройки VBR кодирования
 * @param onProgress Callback для прогресса
 */
export async function transcodeAudioVBR(
  inputPath: string,
  outputPath: string,
  options: AudioTranscodeVBROptions,
  onProgress?: (progress: TranscodeProgress) => void
): Promise<void> {
  const duration = await getVideoDuration(inputPath)

  // Собираем аргументы ffmpeg
  const args = [
    '-y',
    '-threads',
    '0', // Использовать все доступные потоки
    '-i',
    inputPath,
    '-c:a',
    'aac',
    '-b:a',
    `${options.targetBitrate}k`,
    '-vn', // Без видео
  ]

  // Опциональный sample rate
  if (options.sampleRate) {
    args.push('-ar', options.sampleRate.toString())
  }

  // Опциональное количество каналов
  if (options.channels) {
    args.push('-ac', options.channels.toString())
  }

  args.push(outputPath)

  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const ff = spawnFFmpeg(args)

    ff.stderr.on('data', (data) => {
      const str = data.toString()
      const currentTime = parseTimeToSeconds(str)

      if (currentTime !== null && onProgress) {
        const percent = Math.min(100, (currentTime / duration) * 100)
        const elapsed = (Date.now() - startTime) / 1000
        const eta = elapsed > 0 && percent > 0 ? (elapsed / percent) * (100 - percent) : 0

        onProgress({
          percent,
          currentTime,
          totalDuration: duration,
          eta,
          stage: 'audio',
        })
      }
    })

    ff.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg audio VBR transcode exited with code ${code}`))
      }
    })

    ff.on('error', reject)
  })
}

/** Дефолтные настройки VBR аудио */
export const defaultAudioVBROptions: AudioTranscodeVBROptions = {
  targetBitrate: 256,
}

/**
 * Построение аргументов FFmpeg из профиля кодирования
 *
 * @param profile Профиль кодирования
 * @param sourceBitDepth Битность исходного видео (8, 10, 12)
 * @returns Массив аргументов для ffmpeg
 */
function buildProfileArgs(profile: EncodingProfileOptions, sourceBitDepth = 8): string[] {
  const args: string[] = []

  // Маппинг кодеков
  const nvencCodecs: Record<string, string> = {
    AV1: 'av1_nvenc',
    HEVC: 'hevc_nvenc',
    H264: 'h264_nvenc',
  }
  const cpuCodecs: Record<string, string> = {
    AV1: 'libsvtav1',
    HEVC: 'libx265',
    H264: 'libx264',
  }

  if (profile.useGpu) {
    // === NVIDIA NVENC кодирование ===

    // Hardware acceleration
    args.push('-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda')

    // Кодек
    args.push('-c:v', nvencCodecs[profile.codec])

    // Rate Control
    switch (profile.rateControl) {
      case 'VBR':
        args.push('-rc', 'vbr', '-cq', profile.cq.toString())
        if (profile.maxBitrate) {
          args.push('-maxrate', `${profile.maxBitrate}M`, '-bufsize', `${profile.maxBitrate * 2}M`)
        }
        break
      case 'CONSTQP':
        args.push('-rc', 'constqp', '-qp', profile.cq.toString())
        break
      case 'CQ':
        args.push('-cq', profile.cq.toString())
        break
    }

    // Пресет
    args.push('-preset', profile.preset)

    // Tune (если не NONE)
    if (profile.tune !== 'NONE') {
      args.push('-tune', profile.tune.toLowerCase())
    }

    // Multipass
    if (profile.multipass !== 'DISABLED') {
      args.push('-multipass', profile.multipass.toLowerCase())
    }

    // Adaptive Quantization
    args.push('-spatial-aq', profile.spatialAq ? '1' : '0')
    args.push('-temporal-aq', profile.temporalAq ? '1' : '0')
    args.push('-aq-strength', profile.aqStrength.toString())

    // Lookahead
    if (profile.lookahead !== undefined && profile.lookahead !== null && profile.lookahead > 0) {
      args.push('-rc-lookahead', profile.lookahead.toString())
    }
    if (profile.lookaheadLevel !== undefined && profile.lookaheadLevel !== null) {
      args.push('-lookahead_level', profile.lookaheadLevel.toString())
    }

    // GOP Size
    args.push('-g', profile.gopSize.toString())

    // B-Ref Mode
    if (profile.bRefMode !== 'DISABLED') {
      args.push('-b_ref_mode', profile.bRefMode.toLowerCase())
    }

    // 10-bit output — только если НЕ используем hwaccel cuda
    // При -hwaccel_output_format cuda формат пикселей управляется GPU автоматически
    // и -pix_fmt вызывает конфликт "Invalid argument"
    // NVENC автоматически сохраняет битность источника
    // Примечание: если нужен принудительный 10-bit без hwaccel,
    // используйте profile.force10Bit с useGpu=false

    // Temporal Filter (Blackwell+)
    // ПРИМЕЧАНИЕ: tf_level пока не поддерживается драйвером 572.90 на RTX 5080
    // FFmpeg выдаёт "Invalid temporal filtering level" для любых значений кроме 0
    // TODO: Включить когда NVIDIA выпустит драйвер с поддержкой Temporal Filter
    // if (profile.temporalFilter) {
    //   args.push('-tf_level', '1')
    // }
  } else {
    // === CPU кодирование ===

    // Кодек
    args.push('-c:v', cpuCodecs[profile.codec])

    // CRF (аналог CQ для CPU)
    args.push('-crf', profile.cq.toString())

    // Пресет
    args.push('-preset', profile.preset)

    // GOP Size
    args.push('-g', profile.gopSize.toString())

    // 10-bit output для libsvtav1
    if ((profile.force10Bit || sourceBitDepth >= 10) && profile.codec === 'AV1') {
      args.push('-pix_fmt', 'yuv420p10le')
    }
  }

  return args
}

/**
 * Транскодирование видео с использованием профиля
 *
 * @param inputPath Путь к исходному видео
 * @param outputPath Путь для выходного файла
 * @param profile Профиль кодирования
 * @param sourceBitDepth Битность исходного видео (опционально, для автоопределения 10-bit)
 * @param onProgress Callback для прогресса
 */
export async function transcodeVideoWithProfile(
  inputPath: string,
  outputPath: string,
  profile: EncodingProfileOptions,
  sourceBitDepth = 8,
  onProgress?: (progress: TranscodeProgress) => void
): Promise<void> {
  const duration = await getVideoDuration(inputPath)

  // Коррекция: -hwaccel и -hwaccel_output_format должны быть до -i
  // Перестраиваем аргументы правильно
  const finalArgs: string[] = ['-y']

  // Сначала hwaccel опции (если есть)
  if (profile.useGpu) {
    finalArgs.push('-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda')
  }

  // Затем input
  finalArgs.push('-i', inputPath)

  // Deband фильтр для аниме контента (убирает banding в градиентах)
  // Параметры 0.02 — мягкие, не вызывают артефактов но эффективно убирают banding
  // Опционально отключается через profile.deband для тяжёлых файлов
  if (profile.deband !== false) {
    if (profile.useGpu) {
      // GPU: hwdownload → deband (CPU) → hwupload_cuda
      // hwdownload переносит данные из VRAM в RAM для CPU фильтра
      // format=nv12 для совместимости между GPU и CPU
      // hwupload_cuda возвращает данные обратно в VRAM для NVENC
      finalArgs.push(
        '-vf',
        'hwdownload,format=nv12,deband=1thr=0.02:2thr=0.02:3thr=0.02:4thr=0.02,format=nv12,hwupload_cuda'
      )
    } else {
      // CPU кодирование — deband напрямую без трансфера
      finalArgs.push('-vf', 'deband=1thr=0.02:2thr=0.02:3thr=0.02:4thr=0.02')
    }
  }

  // Затем все остальные аргументы кодирования (без hwaccel)
  const encodingArgs = buildProfileArgs(profile, sourceBitDepth).filter(
    (arg) => !['cuda', '-hwaccel', '-hwaccel_output_format'].includes(arg)
  )
  finalArgs.push(...encodingArgs)

  // Без аудио
  finalArgs.push('-an')

  // Output
  finalArgs.push(outputPath)

  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const ff = spawnFFmpeg(finalArgs)

    ff.stderr.on('data', (data) => {
      const str = data.toString()
      const currentTime = parseTimeToSeconds(str)

      if (currentTime !== null && onProgress) {
        const percent = Math.min(100, (currentTime / duration) * 100)
        const elapsed = (Date.now() - startTime) / 1000
        const eta = elapsed > 0 ? (elapsed / percent) * (100 - percent) : 0

        onProgress({
          percent,
          currentTime,
          totalDuration: duration,
          eta,
          stage: 'video',
        })
      }
    })

    ff.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg video transcode with profile "${profile.name}" exited with code ${code}`))
      }
    })

    ff.on('error', reject)
  })
}

/**
 * Кодирование тестового сэмпла (первые N секунд)
 *
 * @param inputPath Путь к исходному видео
 * @param outputPath Путь для выходного файла
 * @param profile Профиль кодирования
 * @param startTime Начало сэмпла (секунды)
 * @param duration Длительность сэмпла (секунды)
 * @param sourceBitDepth Битность исходного видео
 * @param onProgress Callback для прогресса
 */
export async function encodeSample(
  inputPath: string,
  outputPath: string,
  profile: EncodingProfileOptions,
  startTime = 0,
  duration = 300,
  sourceBitDepth = 8,
  onProgress?: (progress: TranscodeProgress) => void
): Promise<{ success: boolean; outputPath: string; encodingTime: number; outputSize: number }> {
  const encodingArgs = buildProfileArgs(profile, sourceBitDepth).filter(
    (arg) => !['cuda', '-hwaccel', '-hwaccel_output_format'].includes(arg)
  )

  const args: string[] = ['-y']

  // Hardware acceleration
  if (profile.useGpu) {
    args.push('-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda')
  }

  // Seek to start (до -i для быстрого seek'а)
  args.push('-ss', startTime.toString())

  // Duration
  args.push('-t', duration.toString())

  // Input
  args.push('-i', inputPath)

  // Deband фильтр для аниме контента (опционально)
  if (profile.deband !== false) {
    if (profile.useGpu) {
      args.push(
        '-vf',
        'hwdownload,format=nv12,deband=1thr=0.02:2thr=0.02:3thr=0.02:4thr=0.02,format=nv12,hwupload_cuda'
      )
    } else {
      args.push('-vf', 'deband=1thr=0.02:2thr=0.02:3thr=0.02:4thr=0.02')
    }
  }

  // Encoding args
  args.push(...encodingArgs)

  // Без аудио для теста
  args.push('-an')

  // Output
  args.push(outputPath)

  const encodingStartTime = Date.now()

  return new Promise((resolve, reject) => {
    const ff = spawnFFmpeg(args)
    let stderrBuffer = '' // Буфер для сбора stderr

    ff.stderr.on('data', (data) => {
      const str = data.toString()
      stderrBuffer += str // Собираем весь stderr
      const currentTime = parseTimeToSeconds(str)

      if (currentTime !== null && onProgress) {
        const percent = Math.min(100, (currentTime / duration) * 100)
        const elapsed = (Date.now() - encodingStartTime) / 1000
        const eta = elapsed > 0 && percent > 0 ? (elapsed / percent) * (100 - percent) : 0

        onProgress({
          percent,
          currentTime,
          totalDuration: duration,
          eta,
          stage: 'video',
        })
      }
    })

    ff.on('error', (err) => {
      // Обработка ошибки spawn (ENOENT, etc)
      reject(new Error(`FFmpeg spawn error: ${err.message}`))
    })

    ff.on('close', async (code) => {
      const encodingTime = (Date.now() - encodingStartTime) / 1000

      if (code === 0) {
        // Получаем размер выходного файла
        const fs = await import('fs')
        let outputSize = 0
        try {
          const stats = fs.statSync(outputPath)
          outputSize = stats.size
        } catch {
          // Игнорируем ошибки
        }

        resolve({
          success: true,
          outputPath,
          encodingTime,
          outputSize,
        })
      } else {
        // Последние 500 символов stderr для диагностики
        const stderrTail = stderrBuffer.slice(-500)
        reject(
          new Error(
            `ffmpeg sample encode with profile "${profile.name}" exited with code ${code}\nStderr: ${stderrTail}`
          )
        )
      }
    })
  })
}

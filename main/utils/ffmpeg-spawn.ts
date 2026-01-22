/**
 * Хелпер для запуска FFmpeg/FFprobe
 *
 * Автоматически использует бандлед версию если доступна,
 * иначе fallback на системную.
 */

import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'child_process'
import { getFFmpegPath, getFFprobePath } from './ffmpeg-installer'

/**
 * Запустить FFmpeg с правильным путём
 */
export function spawnFFmpeg(args: string[], options?: SpawnOptions): ChildProcess {
  const ffmpegPath = getFFmpegPath()
  return nodeSpawn(ffmpegPath, args, options)
}

/**
 * Запустить FFprobe с правильным путём
 */
export function spawnFFprobe(args: string[], options?: SpawnOptions): ChildProcess {
  const ffprobePath = getFFprobePath()
  return nodeSpawn(ffprobePath, args, options)
}

/**
 * Запустить FFmpeg и вернуть Promise
 */
export function runFFmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawnFFmpeg(args)
    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`FFmpeg exited with code ${code}\n${stderr.slice(-500)}`))
      }
    })
  })
}

/** Кэш для версии FFmpeg */
let cachedFFmpegVersion: string | null = null

/**
 * Получить версию FFmpeg
 * Кэшируется после первого вызова
 */
export async function getFFmpegVersion(): Promise<string> {
  if (cachedFFmpegVersion) {
    return cachedFFmpegVersion
  }

  try {
    const { stdout } = await runFFmpeg(['-version'])
    // FFmpeg выводит версию в stdout
    // Формат: "ffmpeg version N-xxxxx-gxxxxxxxx ..." или "ffmpeg version 6.1.1 ..."
    const match = stdout.match(/ffmpeg version ([^\s]+)/)
    if (match) {
      cachedFFmpegVersion = match[1]
      return cachedFFmpegVersion
    }
    // Fallback
    cachedFFmpegVersion = 'unknown'
    return cachedFFmpegVersion
  } catch {
    cachedFFmpegVersion = 'unavailable'
    return cachedFFmpegVersion
  }
}

/**
 * Запустить FFprobe и вернуть Promise
 */
export function runFFprobe(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawnFFprobe(args)
    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`FFprobe exited with code ${code}\n${stderr.slice(-500)}`))
      }
    })
  })
}

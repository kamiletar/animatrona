/**
 * IPFS HTTP Gateway — Локальный сервер для воспроизведения контента
 *
 * Предоставляет HTTP доступ к IPFS контенту для видеоплеера (Shaka Player).
 * Поддерживает Range requests для seek в видео.
 *
 * Маршруты:
 * - GET /ipfs/:cid — Получить контент по CID
 * - GET /ipfs/:cid/:path — Получить файл из директории
 * - GET /health — Проверка работоспособности
 */

import { EventEmitter } from 'events'
import type { IncomingMessage, Server, ServerResponse } from 'http'
import { createServer } from 'http'

import { createModuleLogger } from '../../utils/logger'
import { getKuboService } from '../kubo'
import { catAbortable } from './unified-ipfs-service'
import { cat, stat } from './unixfs-service'

const log = createModuleLogger('Gateway')

/** MIME-типы для медиафайлов */
const MIME_TYPES: Record<string, string> = {
  // Видео
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  ts: 'video/mp2t',
  // Аудио
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  flac: 'audio/flac',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  // Субтитры
  vtt: 'text/vtt',
  srt: 'text/plain',
  ass: 'text/plain',
  ssa: 'text/plain',
  // Изображения
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  // Данные
  json: 'application/json',
  xml: 'application/xml',
  // HTML/CSS/JS
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  mjs: 'application/javascript',
  // Шрифты
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  // WASM
  wasm: 'application/wasm',
}

/** Magic bytes для определения типа файла */
const MAGIC_BYTES: Array<{ bytes: number[]; mask?: number[]; offset?: number; mime: string }> = [
  // WebM (EBML header: 0x1A45DFA3)
  { bytes: [0x1a, 0x45, 0xdf, 0xa3], mime: 'video/webm' },
  // MP4/M4V/MOV (ftyp box)
  { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, mime: 'video/mp4' },
  // MKV (EBML header, same as WebM but different doctype)
  { bytes: [0x1a, 0x45, 0xdf, 0xa3], mime: 'video/x-matroska' },
  // AVI (RIFF....AVI)
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'video/x-msvideo' },
  // PNG
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
  // JPEG
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  // WebP (RIFF....WEBP)
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' },
  // GIF
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' },
  // MP3 (ID3 or sync word)
  { bytes: [0x49, 0x44, 0x33], mime: 'audio/mpeg' },
  { bytes: [0xff, 0xfb], mime: 'audio/mpeg' },
  // OGG
  { bytes: [0x4f, 0x67, 0x67, 0x53], mime: 'audio/ogg' },
  // FLAC
  { bytes: [0x66, 0x4c, 0x61, 0x43], mime: 'audio/flac' },
  // WAV (RIFF....WAVE)
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'audio/wav' },
]

/** Статус Gateway сервера */
export interface GatewayStatus {
  /** Запущен ли сервер */
  isRunning: boolean
  /** Порт сервера */
  port: number | null
  /** Базовый URL */
  baseUrl: string | null
  /** Количество обработанных запросов */
  requestCount: number
}

/** Опции Gateway */
export interface GatewayOptions {
  /** Предпочтительный порт (по умолчанию 8765) */
  port?: number
  /** Хост (по умолчанию localhost) */
  host?: string
  /** Таймаут запроса в мс (по умолчанию 30000) */
  timeout?: number
}

const DEFAULT_PORT = 8765
const DEFAULT_HOST = 'localhost'
const DEFAULT_TIMEOUT = 30000

/**
 * IPFS Gateway Server
 *
 * Singleton сервер для HTTP доступа к IPFS контенту
 */
export class GatewayServer extends EventEmitter {
  private static instance: GatewayServer | null = null
  private server: Server | null = null
  private port: number | null = null
  private host = DEFAULT_HOST
  private requestCount = 0

  private constructor() {
    super()
  }

  /** Получить singleton instance */
  static getInstance(): GatewayServer {
    if (!GatewayServer.instance) {
      GatewayServer.instance = new GatewayServer()
    }
    return GatewayServer.instance
  }

  /** Запустить сервер */
  async start(options: GatewayOptions = {}): Promise<void> {
    if (this.server) {
      log.info('Сервер уже запущен')
      return
    }

    // Проверяем, что Kubo запущен
    const kuboService = getKuboService()
    if (!kuboService.isRunning()) {
      throw new Error('Kubo нода не запущена. Запустите IPFS сначала.')
    }

    const preferredPort = options.port ?? DEFAULT_PORT
    this.host = options.host ?? DEFAULT_HOST
    const timeout = options.timeout ?? DEFAULT_TIMEOUT

    this.server = createServer((req, res) => this.handleRequest(req, res, timeout))

    // Пробуем запустить на предпочтительном порту, при ошибке — на случайном
    this.port = await this.tryListen(preferredPort)

    log.info('HTTP сервер запущен', { url: `http://${this.host}:${this.port}` })
    this.emit('started', this.getStatus())
  }

  /** Попытаться запустить сервер на порту */
  private tryListen(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        reject(new Error('Сервер не создан'))
        return
      }

      this.server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          log.info('Порт занят, пробую случайный', { port })
          // Порт занят — пробуем случайный (0)
          this.server!.listen(0, this.host, () => {
            const addr = this.server!.address()
            if (addr && typeof addr === 'object') {
              resolve(addr.port)
            } else {
              reject(new Error('Не удалось получить порт'))
            }
          })
        } else {
          reject(err)
        }
      })

      this.server.listen(port, this.host, () => {
        resolve(port)
      })
    })
  }

  /** Остановить сервер */
  async stop(): Promise<void> {
    if (!this.server) {
      return
    }

    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        if (err) {
          log.error('Ошибка при остановке', { error: String(err) })
          reject(err)
        } else {
          log.info('HTTP сервер остановлен')
          this.server = null
          this.port = null
          this.emit('stopped')
          resolve()
        }
      })
    })
  }

  /** Получить статус сервера */
  getStatus(): GatewayStatus {
    return {
      isRunning: this.server !== null,
      port: this.port,
      baseUrl: this.port ? `http://${this.host}:${this.port}` : null,
      requestCount: this.requestCount,
    }
  }

  /** Получить URL для CID */
  getContentUrl(cid: string, path?: string): string | null {
    if (!this.port) return null
    const base = `http://${this.host}:${this.port}/ipfs/${cid}`
    return path ? `${base}/${path}` : base
  }

  /** Обработка HTTP запроса */
  private async handleRequest(req: IncomingMessage, res: ServerResponse, timeout: number): Promise<void> {
    this.requestCount++

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')

    // Preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = req.url || '/'

    try {
      // Health check
      if (url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok', requests: this.requestCount }))
        return
      }

      // IPFS content: /ipfs/:cid или /ipfs/:cid/:path
      const ipfsMatch = url.match(/^\/ipfs\/([^/]+)(\/.*)?$/)
      if (ipfsMatch) {
        const cid = ipfsMatch[1]
        const filePath = ipfsMatch[2]?.slice(1) // Убираем начальный /

        await this.handleIpfsRequest(req, res, cid, filePath, timeout)
        return
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
    } catch (error) {
      log.error('Ошибка обработки запроса', { error: String(error) })
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(error instanceof Error ? error.message : 'Internal Server Error')
    }
  }

  /** Обработка IPFS запроса */
  private async handleIpfsRequest(
    req: IncomingMessage,
    res: ServerResponse,
    cid: string,
    filePath: string | undefined,
    _timeout: number,
  ): Promise<void> {
    // Отслеживаем закрытие клиентского соединения для ранней отмены
    let clientClosed = false
    res.on('close', () => {
      clientClosed = true
    })

    try {
      // Формируем полный путь для UnixFS
      // Если есть filePath, используем его для навигации внутри директории
      let targetPath = cid
      if (filePath) {
        targetPath = `${cid}/${filePath}`
      }

      // Получаем статистику для определения типа и размера
      let contentLength: number | null = null
      let isDirectory = false

      try {
        const statResult = await stat(targetPath)
        // Проверяем тип — директория или файл
        isDirectory = statResult.type === 'directory'

        // Если директория без указания файла — редирект на URL с trailing slash
        // Это важно для корректного резолвинга относительных путей браузером
        if (isDirectory && !filePath) {
          // Проверяем, заканчивается ли URL на /
          const originalUrl = req.url || ''
          if (!originalUrl.endsWith('/')) {
            // Редирект на URL с trailing slash
            res.writeHead(301, { Location: `${originalUrl}/` })
            res.end()
            return
          }
          // URL уже с trailing slash — отдаём index.html
          return this.handleIpfsRequest(req, res, cid, 'index.html', _timeout)
        }

        // Проверяем что size валидный (не NaN, не undefined, не 0)
        if (statResult.size && Number.isFinite(statResult.size) && statResult.size > 0) {
          contentLength = statResult.size
        }
      } catch {
        // stat может не работать для некоторых CID — пробуем читать напрямую
      }

      // Если stat не вернул размер, читаем контент для определения
      let contentBuffer: Uint8Array | null = null
      if (contentLength === null) {
        log.debug('stat не вернул размер, читаю контент', { targetPath })
        contentBuffer = await cat(targetPath)
        contentLength = contentBuffer.length
      }

      // Определяем Content-Type: сначала по расширению (используем filePath если есть), потом по magic bytes
      const pathForType = filePath || cid
      let contentType = this.guessContentType(pathForType)
      if (contentType === 'application/octet-stream') {
        // Пробуем определить по magic bytes
        const buffer = contentBuffer ?? (await cat(targetPath))
        if (!contentBuffer) {
          contentBuffer = buffer
        }
        const detectedType = this.detectContentTypeByMagic(buffer)
        if (detectedType) {
          log.debug('Определён тип по magic bytes', { contentType: detectedType })
          contentType = detectedType
        }
      }

      // Обработка Range requests
      const rangeHeader = req.headers.range
      if (rangeHeader && req.method !== 'HEAD') {
        await this.handleRangeRequest(
          req,
          res,
          targetPath,
          contentLength,
          contentType,
          rangeHeader,
          contentBuffer,
          () => clientClosed,
        )
      } else {
        // Полный контент (переиспользуем буфер если уже прочитан)
        const content = contentBuffer ?? (clientClosed ? null : await catAbortable(targetPath, () => clientClosed))
        if (!content) {
          // Клиент отключился — не отправляем
          return
        }

        res.setHeader('Accept-Ranges', 'bytes')
        res.setHeader('Content-Type', contentType)
        res.setHeader('Content-Length', content.length)
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

        if (req.method === 'HEAD') {
          res.writeHead(200)
          res.end()
        } else {
          res.writeHead(200)
          res.end(content)
        }
      }
    } catch (error) {
      const targetPath = filePath ? `${cid}/${filePath}` : cid
      log.error('Ошибка получения контента', { targetPath, error: String(error) })
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end(`Content not found: ${targetPath}`)
    }
  }

  /** Обработка Range request */
  private async handleRangeRequest(
    _req: IncomingMessage,
    res: ServerResponse,
    cid: string,
    totalSize: number,
    contentType: string,
    rangeHeader: string,
    cachedContent?: Uint8Array | null,
    shouldAbort?: () => boolean,
  ): Promise<void> {
    // Парсим Range header: bytes=start-end
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/)
    if (!match) {
      res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` })
      res.end('Invalid Range')
      return
    }

    const start = match[1] ? parseInt(match[1], 10) : 0
    const end = match[2] ? parseInt(match[2], 10) : totalSize - 1

    // Валидация
    if (start >= totalSize || end >= totalSize || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` })
      res.end('Range Not Satisfiable')
      return
    }

    // NOTE: Не ограничиваем размер chunk — FFmpeg требует полный файл для мержа.
    // Если клиент запросил весь файл (bytes=0-), отдаём весь файл.

    // Получаем контент (переиспользуем кэш если есть, с поддержкой отмены)
    const fullContent = cachedContent
      ?? (shouldAbort ? await catAbortable(cid, shouldAbort) : await cat(cid))
    if (!fullContent) {
      // Клиент отключился во время чтения — не отправляем
      return
    }
    const chunk = fullContent.slice(start, end + 1)

    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', chunk.length)
    res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

    res.writeHead(206)
    res.end(chunk)
  }

  /** Определить Content-Type по CID/расширению */
  private guessContentType(cidOrPath: string): string {
    // Пробуем определить по расширению если есть
    const ext = cidOrPath.split('.').pop()?.toLowerCase()
    if (ext && MIME_TYPES[ext]) {
      return MIME_TYPES[ext]
    }

    // Для неизвестных типов
    return 'application/octet-stream'
  }

  /** Определить Content-Type по magic bytes (первые байты файла) */
  private detectContentTypeByMagic(buffer: Uint8Array): string | null {
    for (const magic of MAGIC_BYTES) {
      const offset = magic.offset ?? 0
      if (buffer.length < offset + magic.bytes.length) {
        continue
      }

      let matches = true
      for (let i = 0; i < magic.bytes.length; i++) {
        if (buffer[offset + i] !== magic.bytes[i]) {
          matches = false
          break
        }
      }

      if (matches) {
        return magic.mime
      }
    }

    return null
  }
}

/** Получить singleton instance Gateway */
export function getGatewayServer(): GatewayServer {
  return GatewayServer.getInstance()
}

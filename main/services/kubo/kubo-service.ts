/**
 * KuboService — Управление Kubo (Go IPFS) демоном
 *
 * Стратегия:
 * 1. Проверяем наличие IPFS Desktop → используем если есть
 * 2. Иначе запускаем embedded Kubo через child_process.spawn
 *
 * Преимущества Kubo:
 * - Стабильный DHT (Go реализация, проверена годами)
 * - Лучший NAT traversal (hole punching, relay)
 * - Один бинарник (без native модулей)
 */

import { type ChildProcess, spawn } from 'child_process'
import { app } from 'electron'
import { EventEmitter } from 'events'
import { promises as fs } from 'fs'
import http from 'http'
import type { KuboRPCClient } from 'kubo-rpc-client'
import path from 'path'

import type { IpfsServiceStatus } from '../../../shared/types/ipfs'
import { createModuleLogger } from '../../utils/logger'
import { getAvailablePort } from '../../utils/port-finder'
import { KUBO_PORTS } from './kubo-config'
import { detectIpfsDesktop, type IpfsDesktopInfo, isIpfsDesktopAlive } from './kubo-detector'

const log = createModuleLogger('KuboService')

/**
 * Режим работы KuboService
 */
export type KuboMode = 'external' | 'embedded' | 'none'

/**
 * Статус KuboService
 */
export interface KuboServiceStatus {
  /** Запущен ли сервис */
  isRunning: boolean
  /** Режим работы */
  mode: KuboMode
  /** PeerId ноды */
  peerId: string | null
  /** URL API */
  apiUrl: string | null
  /** Порт Gateway */
  gatewayPort: number | null
  /** Версия Kubo */
  version: string | null
  /** Количество подключённых пиров */
  connectedPeers: number
}

/**
 * События KuboService
 */
export interface KuboServiceEvents {
  'status:changed': (status: KuboServiceStatus) => void
  'peer:connected': (peerId: string) => void
  'peer:disconnected': (peerId: string) => void
  error: (error: Error) => void
}

/**
 * Singleton сервис для управления Kubo
 */
export class KuboService extends EventEmitter {
  private static instance: KuboService | null = null

  /** Режим работы */
  private mode: KuboMode = 'none'

  /** Kubo RPC клиент */
  private client: KuboRPCClient | null = null

  /** Kubo daemon процесс (для embedded режима) */
  private kuboProcess: ChildProcess | null = null

  /** Информация о внешнем IPFS Desktop */
  private externalInfo: IpfsDesktopInfo | null = null

  /** PeerId ноды */
  private peerId: string | null = null

  /** Версия Kubo */
  private version: string | null = null

  /** Флаг инициализации */
  private isInitializing = false

  /** Флаг shutdown */
  private isShuttingDown = false

  /** Интервал проверки здоровья */
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null

  /** Интервал обновления статуса пиров */
  private peerCountInterval: ReturnType<typeof setInterval> | null = null

  /** Количество подключённых пиров */
  private connectedPeers = 0

  /** Текущие порты (для embedded режима, могут отличаться от дефолтных если заняты) */
  private currentPorts = {
    api: KUBO_PORTS.api,
    gateway: KUBO_PORTS.gateway,
    swarmTcp: KUBO_PORTS.swarmTcp,
    swarmQuic: KUBO_PORTS.swarmQuic,
  }

  private constructor() {
    super()
  }

  /**
   * Получить singleton экземпляр
   */
  static getInstance(): KuboService {
    if (!KuboService.instance) {
      KuboService.instance = new KuboService()
    }
    return KuboService.instance
  }

  /**
   * Инициализировать KuboService
   *
   * 1. Проверяет IPFS Desktop → использует если есть
   * 2. Иначе запускает embedded Kubo
   */
  async initialize(): Promise<void> {
    if (this.client) {
      log.info('Уже инициализирован', { mode: this.mode })
      return
    }

    if (this.isInitializing) {
      log.info('Инициализация уже в процессе')
      return
    }

    this.isInitializing = true

    try {
      log.info('Начинаю инициализацию...')

      // Проверяем IPFS Desktop
      const externalInfo = await detectIpfsDesktop()

      if (externalInfo) {
        // Используем внешний IPFS Desktop
        await this.connectToExternal(externalInfo)
      } else {
        // Запускаем embedded Kubo
        await this.startEmbedded()
      }

      // Запускаем периодические проверки
      this.startHealthCheck()
      this.startPeerCountUpdates()

      log.info('Инициализация завершена', {
        mode: this.mode,
        peerId: this.peerId?.slice(-8),
      })

      this.emitStatusChanged()
    } catch (error) {
      log.error('Ошибка инициализации', { error: String(error) })
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      this.isInitializing = false
    }
  }

  /**
   * Подключиться к внешнему IPFS Desktop
   */
  private async connectToExternal(info: IpfsDesktopInfo): Promise<void> {
    log.info('Подключаюсь к IPFS Desktop...', { peerId: info.peerId.slice(-8) })

    // Динамический импорт kubo-rpc-client (ESM модуль)
    const { create } = await import('kubo-rpc-client')

    this.client = create({ url: info.apiUrl })
    this.mode = 'external'
    this.externalInfo = info
    this.peerId = info.peerId
    this.version = info.version

    log.info('Подключён к IPFS Desktop', {
      peerId: info.peerId.slice(-8),
      version: info.version,
    })
  }

  /**
   * Запустить embedded Kubo
   */
  private async startEmbedded(): Promise<void> {
    log.info('Запускаю embedded Kubo...')

    // Путь к бинарнику Kubo
    const kuboBin = this.getKuboBinaryPath()
    log.info('Путь к Kubo бинарнику', { kuboBin, isPacked: app.isPackaged })

    // Проверяем что бинарник существует
    try {
      await fs.access(kuboBin)
      const stat = await fs.stat(kuboBin)
      log.info('Kubo бинарник найден', { size: stat.size })
    } catch (err) {
      log.error('Kubo бинарник не найден', { kuboBin, error: String(err) })
      throw new Error(`Kubo бинарник не найден: ${kuboBin}\n` + 'Запустите: npx tsx scripts/download-kubo.ts')
    }

    // Путь для данных Kubo
    const repoPath = this.getKuboRepoPath()
    await fs.mkdir(repoPath, { recursive: true })
    log.info('Kubo repo path', { repoPath })

    // Инициализируем репозиторий если его нет
    const configPath = path.join(repoPath, 'config')
    try {
      await fs.access(configPath)
      log.info('Kubo репозиторий уже существует')
    } catch {
      log.info('Инициализирую новый Kubo репозиторий...')
      await this.initKuboRepo(kuboBin, repoPath)
    }

    // Ищем свободные порты (если дефолтные заняты)
    await this.findFreePorts()

    // Применяем конфигурацию (порты, bootstrap peers и т.д.)
    await this.applyKuboConfig(kuboBin, repoPath)

    // Запускаем Kubo демон через spawn
    log.info('Запускаю Kubo демон через spawn...', { repoPath })
    await this.spawnKuboDaemon(kuboBin, repoPath)

    // Динамический импорт kubo-rpc-client
    const { create } = await import('kubo-rpc-client')

    // Создаём клиент вручную
    const apiUrl = `http://127.0.0.1:${this.currentPorts.api}`
    log.debug('Создаю RPC клиент...', { apiUrl })

    // Используем globalThis.fetch (Node.js undici) вместо net.fetch (Electron)
    // undici имеет connection pooling — переиспользует TCP соединения
    // net.fetch создаёт новый сокет на каждый запрос → утечка NonPaged Pool
    this.client = create({ url: apiUrl })

    // Получаем информацию о ноде
    log.debug('Получаю информацию о ноде...')
    const id = await this.client.id()
    this.peerId = id.id.toString()

    // Получаем версию
    const versionInfo = await this.client.version()
    this.version = versionInfo.version

    this.mode = 'embedded'

    log.info('Embedded Kubo запущен', {
      peerId: this.peerId.slice(-8),
      version: this.version,
      apiPort: this.currentPorts.api,
      gatewayPort: this.currentPorts.gateway,
    })
  }

  /**
   * Инициализировать Kubo репозиторий
   */
  private async initKuboRepo(kuboBin: string, repoPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const initProcess = spawn(kuboBin, ['init', '--repo-dir', repoPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stderr = ''

      initProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      initProcess.on('close', (code: number | null) => {
        if (code === 0) {
          log.info('Kubo репозиторий инициализирован')
          resolve()
        } else {
          reject(new Error(`Kubo init failed with code ${code}: ${stderr}`))
        }
      })

      initProcess.on('error', reject)
    })
  }

  /**
   * Найти свободные порты для Kubo (если дефолтные заняты)
   */
  private async findFreePorts(): Promise<void> {
    log.info('Ищу свободные порты для Kubo...', { defaults: KUBO_PORTS })

    const api = await getAvailablePort(KUBO_PORTS.api)
    const gateway = await getAvailablePort(KUBO_PORTS.gateway)
    const swarmTcp = await getAvailablePort(KUBO_PORTS.swarmTcp)

    this.currentPorts = {
      api,
      gateway,
      swarmTcp,
      swarmQuic: swarmTcp, // QUIC использует тот же порт (UDP)
    }

    const changed = api !== KUBO_PORTS.api || gateway !== KUBO_PORTS.gateway || swarmTcp !== KUBO_PORTS.swarmTcp

    if (changed) {
      log.info('Используются альтернативные порты', { currentPorts: this.currentPorts })
    } else {
      log.info('Используются дефолтные порты')
    }
  }

  /**
   * Применить конфигурацию Kubo (порты, bootstrap peers)
   */
  private async applyKuboConfig(kuboBin: string, repoPath: string): Promise<void> {
    // Формируем Swarm адреса с текущими портами
    const swarmAddresses = [
      `/ip4/0.0.0.0/tcp/${this.currentPorts.swarmTcp}`,
      `/ip4/0.0.0.0/udp/${this.currentPorts.swarmQuic}/quic-v1`,
      `/ip4/0.0.0.0/udp/${this.currentPorts.swarmQuic}/quic-v1/webtransport`,
    ]

    const configCommands = [
      // API адрес
      ['config', 'Addresses.API', `/ip4/127.0.0.1/tcp/${this.currentPorts.api}`],
      // Gateway адрес
      ['config', 'Addresses.Gateway', `/ip4/127.0.0.1/tcp/${this.currentPorts.gateway}`],
      // Swarm адреса (JSON массив)
      ['config', 'Addresses.Swarm', '--json', JSON.stringify(swarmAddresses)],
      // PubSub
      ['config', 'Pubsub.Enabled', '--bool', 'true'],
      // RelayClient
      ['config', 'Swarm.RelayClient.Enabled', '--bool', 'true'],
      // Hole Punching
      ['config', 'Swarm.EnableHolePunching', '--bool', 'true'],
    ]

    for (const args of configCommands) {
      await this.runKuboCommand(kuboBin, repoPath, args)
    }

    log.info('Kubo конфигурация применена')
  }

  /**
   * Выполнить команду Kubo
   */
  private runKuboCommand(kuboBin: string, repoPath: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(kuboBin, ['--repo-dir', repoPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stderr = ''
      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on('close', (code: number | null) => {
        if (code === 0) {
          resolve()
        } else {
          log.warn('Kubo command failed', { args, code, stderr })
          // Не reject — некоторые команды могут не работать на старых репо
          resolve()
        }
      })

      proc.on('error', reject)
    })
  }

  /**
   * Запустить Kubo демон и дождаться готовности
   */
  private spawnKuboDaemon(kuboBin: string, repoPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      log.info('Spawning Kubo daemon...', { kuboBin, repoPath })

      // --migrate=true автоматически мигрирует репозиторий при обновлении версии Kubo
      this.kuboProcess = spawn(kuboBin, ['daemon', '--repo-dir', repoPath, '--migrate=true'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        // Detach чтобы процесс не был привязан к родителю
        detached: false,
        // На Windows важно скрыть окно консоли
        windowsHide: true,
      })

      let stdoutBuffer = ''
      let stderrBuffer = ''
      let resolved = false

      // Таймаут на запуск — 30 секунд
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          log.error('Kubo daemon startup timeout', { stdout: stdoutBuffer, stderr: stderrBuffer })
          this.kuboProcess?.kill()
          reject(new Error('Kubo daemon startup timeout (30s)'))
        }
      }, 30000)

      this.kuboProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        stdoutBuffer += text
        // Логируем каждую строку отдельно для читаемости
        for (const line of text.split('\n')) {
          const trimmed = line.trim()
          if (trimmed) log.debug(`Kubo: ${trimmed}`)
        }

        // Ищем сигнал готовности
        if (text.includes('Daemon is ready')) {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            log.info('Kubo daemon is ready!')
            resolve()
          }
        }
      })

      this.kuboProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        stderrBuffer += text
        // Логируем каждую строку stderr отдельно
        for (const line of text.split('\n')) {
          const trimmed = line.trim()
          if (trimmed) log.debug(`Kubo stderr: ${trimmed}`)
        }
      })

      this.kuboProcess.on('error', (error: Error) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          log.error('Kubo process error', { error: String(error) })
          reject(error)
        }
      })

      this.kuboProcess.on('close', (code: number | null) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          log.error('Kubo daemon exited unexpectedly', { code, stdout: stdoutBuffer, stderr: stderrBuffer })
          reject(new Error(`Kubo daemon exited with code ${code}`))
        }
      })
    })
  }

  /**
   * Получить путь к бинарнику Kubo
   */
  private getKuboBinaryPath(): string {
    const isProd = app.isPackaged

    // Определяем имя бинарника
    const binName = process.platform === 'win32' ? 'kubo.exe' : 'kubo'

    // Определяем папку платформы
    const getPlatformFolder = (): string => {
      if (process.platform === 'win32') return 'win'
      if (process.platform === 'linux') return 'linux'
      if (process.platform === 'darwin') {
        // macOS: разные бинарники для x64 и arm64
        return process.arch === 'arm64' ? 'darwin-arm64' : 'darwin'
      }
      return 'linux' // fallback
    }

    if (isProd) {
      // В production — в extraResources/kubo/<platform>/
      return path.join(process.resourcesPath, 'kubo', getPlatformFolder(), binName)
    } else {
      // В dev — в resources/kubo/<platform>/
      return path.join(app.getAppPath(), 'resources', 'kubo', getPlatformFolder(), binName)
    }
  }

  /**
   * Получить путь к репозиторию Kubo
   */
  private getKuboRepoPath(): string {
    return path.join(app.getPath('userData'), 'kubo-repo')
  }

  /**
   * Остановить KuboService
   */
  async shutdown(): Promise<void> {
    if (!this.client) {
      log.info('Сервис не запущен')
      return
    }

    if (this.isShuttingDown) {
      log.info('Shutdown уже в процессе')
      return
    }

    this.isShuttingDown = true

    try {
      log.info('Начинаю shutdown...', { mode: this.mode })

      // Останавливаем интервалы
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = null
      }

      if (this.peerCountInterval) {
        clearInterval(this.peerCountInterval)
        this.peerCountInterval = null
      }

      // Для embedded режима — останавливаем демон
      if (this.mode === 'embedded' && this.kuboProcess) {
        log.info('Останавливаю embedded Kubo...')
        // Graceful shutdown через SIGTERM
        this.kuboProcess.kill('SIGTERM')

        // Ждём завершения процесса (максимум 5 секунд)
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            // Если не завершился за 5 сек — SIGKILL
            log.warn('Kubo не завершился за 5 сек, принудительное завершение...')
            this.kuboProcess?.kill('SIGKILL')
            resolve()
          }, 5000)

          this.kuboProcess?.on('close', () => {
            clearTimeout(timeout)
            resolve()
          })
        })

        this.kuboProcess = null
      }

      // Для external режима — просто отключаемся
      this.client = null
      this.mode = 'none'
      this.peerId = null
      this.version = null
      this.externalInfo = null
      this.connectedPeers = 0

      log.info('Shutdown завершён')
      this.emitStatusChanged()
    } catch (error) {
      log.error('Ошибка shutdown', { error: String(error) })
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      this.isShuttingDown = false
    }
  }

  /**
   * Получить Kubo RPC клиент
   *
   * @throws Error если клиент не инициализирован
   */
  getClient(): KuboRPCClient {
    if (!this.client) {
      throw new Error('KuboService не инициализирован. Вызовите initialize() сначала.')
    }
    return this.client
  }

  /**
   * Получить Kubo RPC клиент или null
   */
  getClientOrNull(): KuboRPCClient | null {
    return this.client
  }

  /**
   * Получить текущий статус
   */
  getStatus(): KuboServiceStatus {
    return {
      isRunning: this.client !== null,
      mode: this.mode,
      peerId: this.peerId,
      apiUrl: this.getApiUrl(),
      gatewayPort: this.getGatewayPort(),
      version: this.version,
      connectedPeers: this.connectedPeers,
    }
  }

  /**
   * Получить расширенный статус для UI (с трафиком и размером репо)
   */
  async getIpfsStatus(): Promise<IpfsServiceStatus> {
    const baseStatus: IpfsServiceStatus = {
      isRunning: this.client !== null,
      peerId: this.peerId,
      connectedPeers: this.connectedPeers,
      bytesIn: 0,
      bytesOut: 0,
      blockstoreSize: 0,
      natStatus: 'unknown',
    }

    if (!this.client) {
      return baseStatus
    }

    try {
      // Получаем bandwidth stats
      const bwStats = await this.client.stats.bw()
      baseStatus.bytesIn = Number(bwStats.totalIn)
      baseStatus.bytesOut = Number(bwStats.totalOut)
    } catch (e) {
      log.debug('Не удалось получить bandwidth stats', { error: String(e) })
    }

    try {
      // Получаем размер репо
      const repoStats = await this.client.repo.stat()
      baseStatus.blockstoreSize = Number(repoStats.repoSize)
    } catch (e) {
      log.debug('Не удалось получить repo stats', { error: String(e) })
    }

    // NAT status — пока оставляем unknown (сложно определить через API)
    // TODO: можно анализировать swarm addrs для определения

    return baseStatus
  }

  /**
   * Проверить доступность Kubo API через http.request
   */
  private checkApiAvailable(port: number, retries = 10): Promise<boolean> {
    return new Promise((resolve) => {
      const attempt = (remaining: number) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: '/api/v0/id',
            method: 'POST',
            timeout: 2000,
          },
          (res) => {
            // Важно: потребляем body чтобы не утекало соединение
            res.resume()
            log.debug('Kubo API ответил', { statusCode: res.statusCode })
            resolve(res.statusCode === 200)
          }
        )

        req.on('error', (err) => {
          if (remaining > 0) {
            log.debug('Kubo API недоступен, повторная попытка...', { remaining, error: String(err) })
            setTimeout(() => attempt(remaining - 1), 500)
          } else {
            log.error('Kubo API недоступен после всех попыток', { error: String(err) })
            resolve(false)
          }
        })

        req.on('timeout', () => {
          req.destroy()
          if (remaining > 0) {
            log.debug('Kubo API таймаут, повторная попытка...', { remaining })
            setTimeout(() => attempt(remaining - 1), 500)
          } else {
            resolve(false)
          }
        })

        req.end()
      }

      attempt(retries)
    })
  }

  /**
   * Получить URL API
   */
  getApiUrl(): string | null {
    if (!this.client) return null

    if (this.mode === 'external' && this.externalInfo) {
      return this.externalInfo.apiUrl
    }

    return `http://127.0.0.1:${this.currentPorts.api}`
  }

  /**
   * Получить порт Gateway
   */
  getGatewayPort(): number | null {
    if (!this.client) return null

    if (this.mode === 'external' && this.externalInfo) {
      return this.externalInfo.gatewayPort
    }

    return this.currentPorts.gateway
  }

  /**
   * Получить URL Gateway
   */
  getGatewayUrl(): string | null {
    const port = this.getGatewayPort()
    if (!port) return null
    return `http://127.0.0.1:${port}`
  }

  /**
   * Проверить, запущен ли сервис
   */
  isRunning(): boolean {
    return this.client !== null
  }

  /**
   * Получить режим работы
   */
  getMode(): KuboMode {
    return this.mode
  }

  /**
   * Получить PeerId
   */
  getPeerId(): string | null {
    return this.peerId
  }

  /**
   * Запустить периодическую проверку здоровья
   */
  private startHealthCheck(): void {
    // Проверка каждые 30 секунд
    this.healthCheckInterval = setInterval(async () => {
      await this.checkHealth()
    }, 30000)
  }

  /**
   * Проверка здоровья соединения с автовосстановлением
   */
  private async checkHealth(): Promise<void> {
    if (!this.client) return

    try {
      if (this.mode === 'external') {
        // Проверяем что IPFS Desktop всё ещё доступен
        const alive = await isIpfsDesktopAlive()
        if (!alive) {
          log.warn('IPFS Desktop отключился — попытка переподключения')
          await this.reconnect()
        }
      } else if (this.mode === 'embedded') {
        // Проверяем что embedded Kubo отвечает
        await this.client.id()
      }
    } catch (error) {
      log.error('Health check failed — попытка переподключения', { error: String(error) })
      await this.reconnect()
    }
  }

  /**
   * Переподключение к IPFS после потери связи или выхода из спящего режима
   *
   * Для external: проверяет доступность, пересоздаёт RPC клиент
   * Для embedded: проверяет процесс, при необходимости перезапускает демон
   */
  async reconnect(): Promise<void> {
    if (this.isShuttingDown) return

    log.info('Переподключение IPFS...', { mode: this.mode })

    try {
      if (this.mode === 'external' && this.externalInfo) {
        // Проверяем доступность внешнего IPFS Desktop
        const alive = await isIpfsDesktopAlive()
        if (alive) {
          // Пересоздаём RPC клиент
          const { create } = await import('kubo-rpc-client')
          this.client = create({ url: this.externalInfo.apiUrl })
          const id = await this.client.id()
          this.peerId = id.id.toString()
          log.info('Переподключение к IPFS Desktop успешно', { peerId: this.peerId?.slice(-8) })
        } else {
          log.warn('IPFS Desktop недоступен после reconnect')
        }
      } else if (this.mode === 'embedded') {
        // Проверяем что процесс Kubo жив
        const apiAvailable = await this.checkApiAvailable(this.currentPorts.api, 3)

        if (apiAvailable) {
          // API доступен — пересоздаём RPC клиент
          const { create } = await import('kubo-rpc-client')
          const apiUrl = `http://127.0.0.1:${this.currentPorts.api}`
          this.client = create({ url: apiUrl })
          const id = await this.client.id()
          this.peerId = id.id.toString()
          log.info('Переподключение к embedded Kubo успешно', { peerId: this.peerId?.slice(-8) })
        } else if (this.kuboProcess && !this.kuboProcess.killed) {
          // Процесс жив, но API не отвечает — ждём восстановления
          log.warn('Embedded Kubo API не отвечает, процесс жив — ждём')
          // Повторная проверка через увеличенный таймаут
          const recovered = await this.checkApiAvailable(this.currentPorts.api, 10)
          if (recovered) {
            const { create } = await import('kubo-rpc-client')
            this.client = create({ url: `http://127.0.0.1:${this.currentPorts.api}` })
            log.info('Embedded Kubo восстановился после ожидания')
          } else {
            log.error('Embedded Kubo не восстановился — перезапуск')
            await this.restartEmbedded()
          }
        } else {
          // Процесс мёртв — перезапускаем
          log.warn('Embedded Kubo процесс мёртв — перезапуск')
          await this.restartEmbedded()
        }
      }

      this.emitStatusChanged()
    } catch (error) {
      log.error('Ошибка переподключения', { error: String(error) })
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Перезапустить embedded Kubo демон
   */
  private async restartEmbedded(): Promise<void> {
    // Убиваем старый процесс если есть
    if (this.kuboProcess) {
      this.kuboProcess.kill('SIGKILL')
      this.kuboProcess = null
    }
    this.client = null

    // Перезапускаем
    const kuboBin = this.getKuboBinaryPath()
    const repoPath = this.getKuboRepoPath()

    await this.spawnKuboDaemon(kuboBin, repoPath)

    const { create } = await import('kubo-rpc-client')
    const apiUrl = `http://127.0.0.1:${this.currentPorts.api}`
    this.client = create({ url: apiUrl })

    const id = await this.client.id()
    this.peerId = id.id.toString()
    this.mode = 'embedded'

    log.info('Embedded Kubo перезапущен', { peerId: this.peerId?.slice(-8) })
  }

  /**
   * Запустить обновление количества пиров
   */
  private startPeerCountUpdates(): void {
    // Обновление каждые 30 секунд (было 5 — слишком частые HTTP запросы к Kubo API)
    this.peerCountInterval = setInterval(async () => {
      await this.updatePeerCount()
    }, 30000)

    // Первое обновление сразу
    this.updatePeerCount()
  }

  /**
   * Обновить количество подключённых пиров
   */
  private async updatePeerCount(): Promise<void> {
    if (!this.client) return

    try {
      const peers = await this.client.swarm.peers()
      const newCount = peers.length

      if (newCount !== this.connectedPeers) {
        this.connectedPeers = newCount
        this.emitStatusChanged()

        log.debug('Peer count updated', { peers: newCount })
      }
    } catch (error) {
      log.debug('Failed to get peer count', { error: String(error) })
    }
  }

  /**
   * Эмитить событие об изменении статуса
   * Использует базовый статус без дополнительных HTTP запросов
   * (stats.bw и repo.stat запрашиваются только явно через getIpfsStatus)
   */
  private emitStatusChanged(): void {
    // Эмитим базовый статус БЕЗ дополнительных HTTP запросов к Kubo API
    // Раньше здесь вызывался getIpfsStatus() который делал stats.bw() + repo.stat()
    // — это создавало 2 лишних TCP соединения при каждом изменении peer count
    const baseStatus: IpfsServiceStatus = {
      isRunning: this.client !== null,
      peerId: this.peerId,
      connectedPeers: this.connectedPeers,
      bytesIn: 0,
      bytesOut: 0,
      blockstoreSize: 0,
      natStatus: 'unknown',
    }
    this.emit('status:changed', baseStatus)
  }
}

/**
 * Получить singleton экземпляр KuboService
 */
export function getKuboService(): KuboService {
  return KuboService.getInstance()
}

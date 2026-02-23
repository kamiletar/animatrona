/**
 * Animatrona - Electron Main Process
 *
 * Точка входа для Electron приложения.
 * Управляет окнами, IPC и нативными модулями (FFmpeg).
 */

// ============================================================================
// ВАЖНО: Этот код должен быть в самом начале, ДО любых импортов
// Обрабатываем EPIPE ошибки в production (нет консоли в packaged app)
// ============================================================================
if (process.stdout && typeof process.stdout.on === 'function') {
  process.stdout.on('error', (err) => {
    if (err.code === 'EPIPE') return // Игнорируем broken pipe
  })
}
if (process.stderr && typeof process.stderr.on === 'function') {
  process.stderr.on('error', (err) => {
    if (err.code === 'EPIPE') return // Игнорируем broken pipe
  })
}

// ============================================================================
// Глобальные обработчики ошибок
// Перехватываем необработанные исключения и rejection'ы чтобы не крашить приложение
// Особенно важно для сетевых ошибок типа "TypeError: terminated" от undici
// ============================================================================
process.on('uncaughtException', (error) => {
  // Игнорируем "terminated" ошибки от undici — это нормально при закрытии соединений
  if (error instanceof TypeError && error.message === 'terminated') {
    return
  }
  // Для остальных ошибок — логируем но не крашим
  console.error('[uncaughtException]', error)
})

process.on('unhandledRejection', (reason) => {
  // Игнорируем "terminated" ошибки от undici
  if (reason instanceof TypeError && (reason as TypeError).message === 'terminated') {
    return
  }
  // Игнорируем AbortError — это ожидаемое поведение при отмене запросов
  if (reason instanceof Error && reason.name === 'AbortError') {
    return
  }
  // Для остальных — логируем
  console.error('[unhandledRejection]', reason)
})

// ============================================================================
// DEBUG логирование libp2p (опционально)
// Включается через переменную окружения DEBUG_LIBP2P=1
// Полезно для глубокой отладки P2P connectivity
// libp2p использует пакет 'debug' который читает переменную DEBUG
// ============================================================================
if (process.env.DEBUG_LIBP2P === '1' && !process.env.DEBUG) {
  process.env.DEBUG = 'libp2p:*,kubo:*'
  console.log('[libp2p] DEBUG логирование включено через DEBUG env')
}

import { app, BrowserWindow, dialog, Menu, powerMonitor, powerSaveBlocker } from 'electron'
import path from 'path'
import { registerIpcHandlers } from './ipc'
import { initAllowedPaths } from './protocols/allowed-paths'
import { registerMediaProtocol, setupMediaProtocolHandler } from './protocols/media.protocol'
import { getAchievementService } from './services/achievements'
import { getBonusService } from './services/bonus'
import { initializeDatabase, migrateFromOldPath } from './services/database'
import { getDeepLinkService } from './services/deep-link'
import { getGatewayServer } from './services/ipfs'
import { getKuboService } from './services/kubo'
import { getMobileServer } from './services/mobile-server'
import { startNextServer, stopNextServer } from './services/next-server'
import { getReputationService } from './services/reputation'
import { getStatsTracker } from './services/stats'
import {
  getFriendRequestsSync,
  getPresenceSync,
  getUserProfileSync,
  getWatchPartySync,
  getWatchProgressSync,
} from './services/sync'
import { createMainWindow, createSplashWindow } from './services/window-manager'
import { destroyTray, initTray } from './tray'
import { initAutoUpdater } from './updater'
import { createModuleLogger } from './utils/logger'

const log = createModuleLogger('App')

/** ID блокировщика энергосбережения для IPFS */
let ipfsPowerSaveBlockerId: number | null = null

// Устанавливаем правильное имя приложения для userData пути
// Без этого Electron использует name из package.json (@lena/animatrona)
// и создаёт путь с @ который выглядит странно
app.name = 'Animatrona'

// Устанавливаем App User Model ID для Windows таскбара
// Должно совпадать с appId из electron-builder.yml
if (process.platform === 'win32') {
  app.setAppUserModelId('com.lena.animatrona')
}

// Запретить Chromium троттлить фоновые процессы
// Без этого Windows помечает приложение как "Efficiency Mode" при сворачивании в трей
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')

// Регистрируем кастомный протокол media:// ДО app.whenReady()
registerMediaProtocol()

// В packaged Electron app.isPackaged === true
const isProd = app.isPackaged || process.env.NODE_ENV === 'production'

// Инициализация приложения
app.whenReady().then(async () => {
  // Миграция данных из старого пути @lena/animatrona в новый Animatrona
  // Должна быть до initializeDatabase() чтобы БД была на новом месте
  migrateFromOldPath()

  // Инициализируем БД при первом запуске / применяем миграции при обновлении
  await initializeDatabase()

  // Показываем splash screen сразу
  createSplashWindow()

  // Настраиваем обработчик media:// протокола
  setupMediaProtocolHandler()

  // Инициализируем whitelist разрешённых путей для media:// протокола
  initAllowedPaths()

  // Регистрируем IPC handlers
  registerIpcHandlers()

  // Инициализируем обработку deep links (animatrona://)
  getDeepLinkService().initialize()

  // Настраиваем меню приложения
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Файл',
      submenu: [{ role: 'quit', label: 'Выход' }],
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Перезагрузить' },
        { role: 'forceReload', label: 'Принудительно перезагрузить' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Сбросить масштаб' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полноэкранный режим' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

  // Инициализируем Stats Tracker (отслеживание статистики IPFS)
  const statsTracker = getStatsTracker()
  statsTracker.initialize()

  // Инициализируем Reputation Service (расчёт репутации на основе stats)
  const reputationService = getReputationService()
  reputationService.initialize()

  // Инициализируем Achievement Service (проверка и разблокировка достижений)
  const achievementService = getAchievementService()
  achievementService.initialize()

  // Инициализируем Bonus Service (бонусные очки за раздачу)
  const bonusService = getBonusService()
  bonusService.initialize()

  // В production запускаем Next.js сервер
  if (isProd) {
    try {
      await startNextServer()
    } catch (err) {
      log.error('Failed to start Next.js server', { error: String(err) })

      // Показываем диалог пользователю
      const result = await dialog.showMessageBox({
        type: 'error',
        title: 'Ошибка запуска',
        message: 'Не удалось запустить сервер',
        detail:
          `Animatrona не смогла найти свободный порт для запуска.\n\nВозможные решения:\n• Закройте другие приложения\n• Перезагрузите компьютер\n• Проверьте антивирус/фаервол\n\nОшибка: ${err}`,
        buttons: ['Повторить', 'Выход'],
        defaultId: 0,
      })

      if (result.response === 0) {
        // Повторить попытку
        app.relaunch()
        app.quit()
      } else {
        app.quit()
      }
      return // Не продолжать загрузку
    }
  }

  // Создаём главное окно (splash закроется когда оно будет готово)
  const mainWindow = await createMainWindow()

  // Инициализируем системный трей
  initTray(mainWindow, isProd)

  // Инициализируем автообновления
  initAutoUpdater(mainWindow)

  // Автозапуск IPFS при старте приложения (в фоне, не блокирует UI)
  // KuboService — основной для P2P/DHT (Go IPFS)
  const kuboService = getKuboService()
  const gatewayServer = getGatewayServer()

  // Автозапуск Kubo → Gateway → Sync сервисы
  // Kubo запускается первым для стабильного P2P
  kuboService
    .initialize()
    .then(() => {
      log.info('Kubo started', { mode: kuboService.getMode(), peerId: kuboService.getPeerId()?.slice(-8) })

      // Блокируем переход системы в режим энергосбережения пока IPFS работает
      // 'prevent-app-suspension' — не даёт Windows троттлить процесс
      ipfsPowerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension')
      log.info('PowerSaveBlocker started', { id: ipfsPowerSaveBlockerId })

      return gatewayServer.start()
    })
    .then(() => {
      log.info('IPFS Gateway started', { port: gatewayServer.getStatus().port })
      // WatchProgressSync использует SQLite + Kubo PubSub
      return getWatchProgressSync().initialize()
    })
    .then(() => {
      log.info('WatchProgressSync initialized')
      // UserProfileSync использует SQLite + IPNS
      return getUserProfileSync().initialize()
    })
    .then(() => {
      log.info('UserProfileSync initialized')
      // FriendRequestsSync использует SQLite + Kubo PubSub
      return getFriendRequestsSync().initialize()
    })
    .then(() => {
      log.info('FriendRequestsSync initialized')
      return getPresenceSync().start()
    })
    .then(() => {
      log.info('PresenceSync started')
      // WatchPartySync использует Kubo PubSub
      return getWatchPartySync().initialize()
    })
    .then(() => {
      log.info('WatchPartySync initialized')
    })
    .catch((err) => {
      log.error('IPFS autostart failed', { error: String(err) })
      // Не критично — пользователь может запустить вручную
    })

  // Реакция на suspend/resume системы — переподключение IPFS после сна
  powerMonitor.on('suspend', () => {
    log.info('Система переходит в спящий режим')
  })

  powerMonitor.on('resume', () => {
    log.info('Система вышла из спящего режима — переподключение IPFS')
    kuboService.reconnect().catch((err) => {
      log.error('IPFS reconnect after resume failed', { error: String(err) })
    })
  })

  // Автозапуск мобильного сервера если был включён в настройках
  autoStartMobileServer()

  app.on('activate', async () => {
    // На macOS пересоздаём окно при клике на иконку в доке
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow()
    }
  })
})

// Выход на всех платформах кроме macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Расширяем тип app для флага isQuitting
declare module 'electron' {
  interface App {
    isQuitting?: boolean
  }
}

// Cleanup при выходе
app.on('before-quit', async () => {
  app.isQuitting = true

  // Останавливаем powerSaveBlocker для IPFS
  if (ipfsPowerSaveBlockerId !== null && powerSaveBlocker.isStarted(ipfsPowerSaveBlockerId)) {
    powerSaveBlocker.stop(ipfsPowerSaveBlockerId)
    log.info('PowerSaveBlocker stopped', { id: ipfsPowerSaveBlockerId })
    ipfsPowerSaveBlockerId = null
  }

  // Stats Tracker shutdown (сохраняет накопленную статистику)
  try {
    const statsTracker = getStatsTracker()
    statsTracker.shutdown()
    log.info('Stats Tracker stopped')
  } catch (err) {
    log.error('Stats Tracker shutdown error', { error: String(err) })
  }

  // Reputation Service shutdown
  try {
    const reputationService = getReputationService()
    reputationService.shutdown()
    log.info('Reputation Service stopped')
  } catch (err) {
    log.error('Reputation Service shutdown error', { error: String(err) })
  }

  // Achievement Service shutdown
  try {
    const achievementService = getAchievementService()
    achievementService.shutdown()
    log.info('Achievement Service stopped')
  } catch (err) {
    log.error('Achievement Service shutdown error', { error: String(err) })
  }

  // Bonus Service shutdown
  try {
    const bonusService = getBonusService()
    bonusService.shutdown()
    log.info('Bonus Service stopped')
  } catch (err) {
    log.error('Bonus Service shutdown error', { error: String(err) })
  }

  // Mobile Server shutdown
  try {
    const mobileServer = getMobileServer()
    if (mobileServer.getStatus().isRunning) {
      await mobileServer.stop()
      log.info('Mobile Server stopped')
    }
  } catch (err) {
    log.error('Mobile Server shutdown error', { error: String(err) })
  }

  // WatchProgressSync shutdown
  try {
    await getWatchProgressSync().shutdown()
    log.info('WatchProgressSync stopped')
  } catch (err) {
    log.error('WatchProgressSync shutdown error', { error: String(err) })
  }

  // UserProfileSync shutdown
  try {
    await getUserProfileSync().shutdown()
    log.info('UserProfileSync stopped')
  } catch (err) {
    log.error('UserProfileSync shutdown error', { error: String(err) })
  }

  // FriendRequestsSync shutdown
  try {
    await getFriendRequestsSync().shutdown()
    log.info('FriendRequestsSync stopped')
  } catch (err) {
    log.error('FriendRequestsSync shutdown error', { error: String(err) })
  }

  // PresenceSync shutdown
  try {
    await getPresenceSync().stop()
    log.info('PresenceSync stopped')
  } catch (err) {
    log.error('PresenceSync shutdown error', { error: String(err) })
  }

  // WatchPartySync shutdown
  try {
    await getWatchPartySync().shutdown()
    log.info('WatchPartySync stopped')
  } catch (err) {
    log.error('WatchPartySync shutdown error', { error: String(err) })
  }

  // Gateway shutdown (быстрый, без таймаута)
  const gatewayServer = getGatewayServer()
  if (gatewayServer.getStatus().isRunning) {
    try {
      log.info('Stopping Gateway...')
      await gatewayServer.stop()
      log.info('Gateway stopped')
    } catch (err) {
      log.error('Gateway shutdown error', { error: String(err) })
    }
  }

  // Kubo shutdown с таймаутом 5 сек
  const kuboService = getKuboService()
  if (kuboService.isRunning()) {
    try {
      log.info('Stopping Kubo...')
      await Promise.race([
        kuboService.shutdown(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Kubo shutdown timeout')), 5000)),
      ])
      log.info('Kubo stopped')
    } catch (err) {
      log.error('Kubo shutdown error', { error: String(err) })
    }
  }

  destroyTray()
  stopNextServer()
})

app.on('quit', () => {
  stopNextServer()
})

/**
 * Автозапуск мобильного сервера если включён в настройках
 * Вызывается при старте приложения после инициализации БД
 */
async function autoStartMobileServer(): Promise<void> {
  try {
    // Динамический импорт чтобы не тянуть Prisma до инициализации БД
    const { getDb } = await import('./services/database')
    const db = getDb()

    // Проверяем существует ли запись Settings
    let settings = await db.settings.findUnique({
      where: { id: 'default' },
      select: { mobileAccessEnabled: true, mobileServerPort: true },
    })

    // Создаём запись если не существует
    if (!settings) {
      log.info('Settings record not found, creating default')
      settings = await db.settings.create({
        data: { id: 'default' },
        select: { mobileAccessEnabled: true, mobileServerPort: true },
      })
    }

    log.info('Mobile server autostart check', {
      mobileAccessEnabled: settings.mobileAccessEnabled,
      mobileServerPort: settings.mobileServerPort,
    })

    if (!settings.mobileAccessEnabled) {
      log.info('Mobile server autostart disabled (setting is false)')
      return
    }

    const mobileServer = getMobileServer()
    const port = settings.mobileServerPort ?? 4000

    // Путь к статическим файлам mobile-ui
    const isProd = app.isPackaged
    const staticPath = isProd
      ? path.join(process.resourcesPath, 'mobile-ui')
      : path.join(app.getAppPath(), 'mobile-ui', 'dist')

    await mobileServer.start({ port, staticPath })

    log.info('Mobile server autostarted', { port, staticPath })
  } catch (err) {
    log.error('Mobile server autostart failed', { error: String(err) })
    // Не критично — пользователь может запустить вручную
  }
}

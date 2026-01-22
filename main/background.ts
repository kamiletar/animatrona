/* eslint-disable no-console */
/**
 * Animatrona - Electron Main Process
 *
 * Точка входа для Electron приложения.
 * Управляет окнами, IPC и нативными модулями (FFmpeg).
 */

import { type ChildProcess, fork } from 'child_process'
import crypto from 'crypto'
import { app, BrowserWindow, dialog, type UtilityProcess, utilityProcess } from 'electron'
import fs from 'fs'
import path from 'path'
import { registerIpcHandlers } from './ipc'
import { setupWindowStateListeners } from './ipc/window.handlers'
import { initAllowedPaths } from './protocols/allowed-paths'
import { registerMediaProtocol, setupMediaProtocolHandler } from './protocols/media.protocol'
import { destroyTray, initTray } from './tray'
import { initAutoUpdater } from './updater'
import { getAvailablePort } from './utils/port-finder'

// Объявляем __non_webpack_require__ для обхода Webpack bundling
// Используется для динамической загрузки sql.js с абсолютным путём
declare const __non_webpack_require__: NodeRequire

// Устанавливаем правильное имя приложения для userData пути
// Без этого Electron использует name из package.json (@lena/animatrona)
// и создаёт путь с @ который выглядит странно
app.name = 'Animatrona'

// Устанавливаем App User Model ID для Windows таскбара
// Должно совпадать с appId из electron-builder.yml
if (process.platform === 'win32') {
  app.setAppUserModelId('com.lena.animatrona')
}

// Регистрируем кастомный протокол media:// ДО app.whenReady()
registerMediaProtocol()

// В packaged Electron app.isPackaged === true
const isProd = app.isPackaged || process.env.NODE_ENV === 'production'

/**
 * Имя baseline миграции — создаётся при первом запуске новой системы миграций
 * Пользователи с user_version >= 5 получат эту миграцию как "уже применённую"
 */
const BASELINE_MIGRATION_NAME = '0_baseline'

/**
 * Минимальная версия user_version для обратной совместимости
 * Пользователи с этой версией или выше считаются готовыми к baseline
 */
const LEGACY_DB_VERSION_FOR_BASELINE = 5

/**
 * Миграция данных из старого пути @lena/animatrona в новый Animatrona
 * Вызывается один раз при первом запуске после обновления
 *
 * Старый путь: %APPDATA%/@lena/animatrona
 * Новый путь: %APPDATA%/Animatrona
 */
function migrateFromOldPath(): void {
  if (!isProd) {
    return // Миграция только в production
  }

  const appData = path.dirname(app.getPath('userData'))
  const oldPath = path.join(appData, '@lena', 'animatrona')
  const newPath = app.getPath('userData') // Уже Animatrona благодаря app.name

  // Проверяем что старый путь существует и новый пуст или не существует
  if (!fs.existsSync(oldPath)) {
    return // Нет старых данных для миграции
  }

  const newDataDir = path.join(newPath, 'data')
  const newDbPath = path.join(newDataDir, 'app.db')

  // Если в новом пути уже есть БД, не перезаписываем
  if (fs.existsSync(newDbPath)) {
    return
  }

  try {
    // Копируем папку data (база данных)
    const oldDataDir = path.join(oldPath, 'data')
    if (fs.existsSync(oldDataDir)) {
      fs.mkdirSync(newDataDir, { recursive: true })
      const files = fs.readdirSync(oldDataDir)
      for (const file of files) {
        const srcFile = path.join(oldDataDir, file)
        const destFile = path.join(newDataDir, file)
        fs.copyFileSync(srcFile, destFile)
      }
    }

    // Копируем папку posters (постеры аниме)
    const oldPostersDir = path.join(oldPath, 'posters')
    const newPostersDir = path.join(newPath, 'posters')
    if (fs.existsSync(oldPostersDir) && !fs.existsSync(newPostersDir)) {
      fs.mkdirSync(newPostersDir, { recursive: true })
      const posters = fs.readdirSync(oldPostersDir)
      for (const poster of posters) {
        const srcFile = path.join(oldPostersDir, poster)
        const destFile = path.join(newPostersDir, poster)
        fs.copyFileSync(srcFile, destFile)
      }
    }
  } catch {
    // Продолжаем работу — будет использована свежая БД
  }
}

/**
 * Получить путь к базе данных SQLite
 * В production: %APPDATA%/Animatrona/data/app.db
 * В development: apps/animatrona/prisma/data/app.db
 */
function getDatabasePath(): string {
  if (isProd) {
    const userDataPath = app.getPath('userData')
    const dbDir = path.join(userDataPath, 'data')
    // Создаём директорию если её нет
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    return path.join(dbDir, 'app.db')
  }
  // В development используем локальный путь
  return path.join(__dirname, '..', 'prisma', 'data', 'app.db')
}

/**
 * Структура файла миграции Prisma
 */
interface MigrationFile {
  /** Имя папки миграции (timestamp_name) */
  name: string
  /** Содержимое migration.sql */
  sql: string
}

/**
 * Получить путь к папке с миграциями
 */
function getMigrationsDir(): string {
  if (isProd) {
    return path.join(process.resourcesPath, 'migrations')
  }
  return path.join(__dirname, '..', 'prisma', 'migrations')
}

/**
 * Получить список миграций из папки prisma/migrations/
 * Миграции сортируются по имени (timestamp в начале имени)
 */
function getMigrationFiles(): MigrationFile[] {
  const migrationsDir = getMigrationsDir()

  if (!fs.existsSync(migrationsDir)) {
    console.log('[Migration] Папка миграций не найдена:', migrationsDir)
    return []
  }

  const folders = fs
    .readdirSync(migrationsDir)
    .filter((f) => {
      const fullPath = path.join(migrationsDir, f)
      return fs.statSync(fullPath).isDirectory()
    })
    .sort() // Сортировка по timestamp в имени

  return folders
    .map((folder) => {
      const sqlPath = path.join(migrationsDir, folder, 'migration.sql')
      if (!fs.existsSync(sqlPath)) {
        console.warn(`[Migration] Файл migration.sql не найден в ${folder}`)
        return { name: folder, sql: '' }
      }
      return {
        name: folder,
        sql: fs.readFileSync(sqlPath, 'utf-8'),
      }
    })
    .filter((m) => m.sql.length > 0)
}

/**
 * Разбивает SQL на отдельные команды, учитывая BEGIN...END блоки в триггерах
 * SQLite триггеры содержат ; внутри BEGIN...END, их нельзя разбивать
 *
 * @param sql - SQL код миграции
 * @returns Массив SQL команд
 */
function parseSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let depth = 0 // Глубина вложенности BEGIN...END

  // Разбиваем по ; но учитываем BEGIN/END
  const lines = sql.split('\n')

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Пропускаем пустые строки и комментарии
    if (!trimmedLine || trimmedLine.startsWith('--')) {
      continue
    }

    // Проверяем BEGIN (начало блока триггера)
    if (/\bBEGIN\b/i.test(trimmedLine)) {
      depth++
    }

    // Проверяем END (конец блока триггера)
    if (/\bEND\s*;?\s*$/i.test(trimmedLine)) {
      depth = Math.max(0, depth - 1)
    }

    current += line + '\n'

    // Если мы вне BEGIN...END блока и строка заканчивается на ;
    if (depth === 0 && trimmedLine.endsWith(';')) {
      const statement = current.trim()
      if (statement && !statement.startsWith('--')) {
        // Убираем финальную ; для db.run()
        statements.push(statement.replace(/;\s*$/, ''))
      }
      current = ''
    }
  }

  // Добавляем последнюю команду если осталась
  const remaining = current.trim()
  if (remaining && !remaining.startsWith('--')) {
    statements.push(remaining.replace(/;\s*$/, ''))
  }

  return statements
}

/**
 * Применяет Prisma миграции к существующей БД
 * Использует sql.js (WASM) — без native модулей
 *
 * Система миграций:
 * - Миграции читаются из prisma/migrations/ (dev) или resources/migrations (prod)
 * - Состояние хранится в таблице _prisma_migrations (совместимо с Prisma CLI)
 * - Обратная совместимость: user_version >= 5 → baseline помечается как применённая
 *
 * @param dbPath - Путь к файлу БД
 */
async function applyPrismaMigrations(dbPath: string): Promise<void> {
  // fts5-sql-bundle — sql.js с поддержкой FTS5
  // В production — из resources, в dev — из node_modules
  // Используем __non_webpack_require__ чтобы обойти Webpack bundling
  const sqlJsPath = isProd
    ? path.join(process.resourcesPath, 'node_modules', 'fts5-sql-bundle')
    : path.join(__dirname, '..', '..', '..', 'node_modules', 'fts5-sql-bundle')

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJs = __non_webpack_require__(sqlJsPath).default

  const wasmPath = isProd
    ? path.join(process.resourcesPath, 'sql-wasm.wasm')
    : path.join(__dirname, '..', '..', '..', 'node_modules', 'fts5-sql-bundle', 'dist', 'sql-wasm.wasm')

  if (!fs.existsSync(wasmPath)) {
    throw new Error(`sql-wasm.wasm not found at ${wasmPath}`)
  }

  const SQL = await initSqlJs({
    locateFile: (file: string) => wasmPath || file,
  })

  const buffer = fs.readFileSync(dbPath)
  const db = new SQL.Database(buffer)

  try {
    // Создаём таблицу _prisma_migrations если не существует
    db.run(`
      CREATE TABLE IF NOT EXISTS _prisma_migrations (
        id TEXT PRIMARY KEY NOT NULL,
        checksum TEXT NOT NULL,
        finished_at DATETIME,
        migration_name TEXT NOT NULL UNIQUE,
        logs TEXT,
        rolled_back_at DATETIME,
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        applied_steps_count INTEGER NOT NULL DEFAULT 0
      )
    `)

    // Проверяем legacy систему (user_version)
    const versionResult = db.exec('PRAGMA user_version')
    const userVersion = (versionResult[0]?.values[0]?.[0] as number) || 0

    // Проверяем есть ли уже записи в _prisma_migrations
    const migrationsCount = db.exec('SELECT COUNT(*) FROM _prisma_migrations')
    const hasAnyMigrations = ((migrationsCount[0]?.values[0]?.[0] as number) || 0) > 0

    // Обратная совместимость: если user_version >= 5 и нет записей — помечаем baseline
    if (userVersion >= LEGACY_DB_VERSION_FOR_BASELINE && !hasAnyMigrations) {
      console.log(`[Migration] Обратная совместимость: user_version=${userVersion}`)
      const migrationId = crypto.randomUUID()
      db.run(
        `
        INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
        VALUES (?, '', ?, datetime('now'), datetime('now'), 0)
      `,
        [migrationId, BASELINE_MIGRATION_NAME],
      )
    }

    // Получаем уже применённые миграции
    const appliedResult = db.exec('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL')
    const appliedNames = new Set<string>(appliedResult[0]?.values.map((v) => v[0] as string) || [])

    // Получаем все доступные миграции
    const migrations = getMigrationFiles()

    if (migrations.length === 0) {
      console.log('[Migration] Нет миграций для применения')
      db.close()
      return
    }

    // Применяем новые миграции
    let appliedCount = 0
    for (const migration of migrations) {
      if (appliedNames.has(migration.name)) {
        continue
      }

      console.log(`[Migration] Применяю: ${migration.name}`)

      // Backup перед миграцией
      const backupPath = `${dbPath}.backup.${migration.name}`
      try {
        fs.copyFileSync(dbPath, backupPath)
      } catch {
        console.warn(`[Migration] Не удалось создать backup: ${backupPath}`)
      }

      // Записываем начало миграции
      const migrationId = crypto.randomUUID()
      db.run(
        `
        INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at)
        VALUES (?, '', ?, datetime('now'))
      `,
        [migrationId, migration.name],
      )

      // Разбиваем SQL на отдельные команды
      // Учитываем BEGIN...END блоки в триггерах SQLite
      const sqlCommands = parseSqlStatements(migration.sql)

      let stepsApplied = 0
      for (const cmd of sqlCommands) {
        try {
          db.run(cmd)
          stepsApplied++
        } catch (cmdErr) {
          console.error(`[Migration] Ошибка в ${migration.name}: ${cmd}`)
          db.run(`UPDATE _prisma_migrations SET logs = ? WHERE id = ?`, [String(cmdErr), migrationId])
          throw cmdErr
        }
      }

      // Записываем успешное завершение
      db.run(
        `
        UPDATE _prisma_migrations
        SET finished_at = datetime('now'), applied_steps_count = ?
        WHERE id = ?
      `,
        [stepsApplied, migrationId],
      )

      console.log(`[Migration] Успешно: ${migration.name} (${stepsApplied} команд)`)
      appliedCount++
    }

    if (appliedCount > 0) {
      console.log(`[Migration] Применено ${appliedCount} миграций`)
    }

    // Сохраняем изменения
    const data = db.export()
    fs.writeFileSync(dbPath, Buffer.from(data))
  } finally {
    db.close()
  }
}

/**
 * Инициализация базы данных
 * При первом запуске копирует template.db из resources
 * При обновлениях применяет Prisma миграции
 *
 * Воркфлоу обновления схемы:
 * 1. Измени schema.zmodel
 * 2. nx db:migrate animatrona -- --name feature_name
 *    (автоматически: zenstack:generate → prisma migrate dev → copy template.db)
 * 3. nx build:win animatrona
 */
async function initializeDatabase(): Promise<void> {
  const dbPath = getDatabasePath()

  // В dev режиме только применяем миграции, не копируем template
  if (!isProd) {
    try {
      await applyPrismaMigrations(dbPath)
    } catch (err) {
      console.error('[Database] Ошибка миграций в dev:', err)
    }
    return
  }
  const templatePath = path.join(process.resourcesPath, 'template.db')

  // Первый запуск или пустая БД — копируем template
  const dbExists = fs.existsSync(dbPath)
  const dbSize = dbExists ? fs.statSync(dbPath).size : 0

  if (!dbExists || dbSize === 0) {
    if (!fs.existsSync(templatePath)) {
      console.error('[Database] Template database not found:', templatePath)
      return
    }

    try {
      fs.copyFileSync(templatePath, dbPath)
      console.log('[Database] Template скопирован:', dbPath)
    } catch (err) {
      console.error('[Database] Ошибка копирования template:', err)
      return
    }
  }

  // Применяем Prisma миграции (для обновлений приложения)
  try {
    await applyPrismaMigrations(dbPath)
  } catch (err) {
    console.error('[Database] Ошибка миграций:', err)
    // Не прерываем запуск — приложение может работать со старой схемой
  }
}

/**
 * Получить DATABASE_URL для Prisma
 */
function getDatabaseUrl(): string {
  const dbPath = getDatabasePath()
  // Prisma требует file: prefix для SQLite
  return `file:${dbPath}`
}

// Храним ссылки на окна
let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let nextServer: ChildProcess | UtilityProcess | null = null
let serverPort = 3007

/**
 * Создаёт splash screen окно
 */
function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 500,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Загружаем splash screen
  const splashPath = isProd
    ? path.join(process.resourcesPath, 'splash.html')
    : path.join(__dirname, '..', 'resources', 'splash.html')

  splash.loadFile(splashPath)
  splash.center()

  return splash
}

/**
 * Запуск Next.js standalone сервера
 * Возвращает порт, на котором запущен сервер
 */
async function startNextServer(): Promise<number> {
  const port = await getAvailablePort(3007)
  serverPort = port

  // Путь к standalone серверу (Next.js сохраняет структуру монорепо)
  const standaloneDir = path.join(process.resourcesPath, 'standalone')
  const serverPath = path.join(standaloneDir, 'apps', 'animatrona', 'renderer', 'server.js')
  const serverCwd = path.join(standaloneDir, 'apps', 'animatrona', 'renderer')

  return new Promise((resolve, reject) => {
    // Пути для базы данных
    const databasePath = getDatabasePath() // Абсолютный путь к файлу БД
    const databaseUrl = getDatabaseUrl() // file: URL для Prisma

    // В production используем utilityProcess.fork() из Electron
    if (isProd) {
      nextServer = utilityProcess.fork(serverPath, [], {
        env: {
          ...process.env,
          PORT: String(port),
          HOSTNAME: '127.0.0.1',
          NODE_ENV: 'production',
          // DATABASE_PATH для ZenStack ORM (enhance.ts)
          DATABASE_PATH: databasePath,
          // DATABASE_URL для Prisma (db.ts fallback)
          DATABASE_URL: databaseUrl,
        },
        cwd: serverCwd,
        stdio: 'pipe',
      })

      nextServer.stdout?.on('data', (data) => {
        const msg = data.toString().trim()
        if (msg.includes('Ready') || msg.includes('started server') || msg.includes('Listening')) {
          resolve(port)
        }
      })

      nextServer.stderr?.on('data', (data) => {
        const msg = data.toString().trim()
        console.error('[NextServer:err]', msg)
      })

      nextServer.on('exit', () => {
        nextServer = null
      })
    } else {
      // В development используем child_process.fork
      nextServer = fork(serverPath, [], {
        env: {
          ...process.env,
          PORT: String(port),
          HOSTNAME: '127.0.0.1',
          NODE_ENV: 'production',
          // DATABASE_PATH для ZenStack ORM (enhance.ts)
          DATABASE_PATH: databasePath,
          // DATABASE_URL для Prisma (db.ts fallback)
          DATABASE_URL: databaseUrl,
        },
        cwd: serverCwd,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      })

      nextServer.stdout?.on('data', (data) => {
        const msg = data.toString().trim()
        if (msg.includes('Ready') || msg.includes('started server')) {
          resolve(port)
        }
      })

      nextServer.on('error', (err: Error) => {
        reject(err)
      })

      nextServer.on('close', () => {
        nextServer = null
      })
    }

    // Таймаут на случай если сервер не стартует
    setTimeout(() => {
      // Если сервер ещё не ответил, всё равно пытаемся подключиться
      resolve(port)
    }, 5000)
  })
}

/**
 * Остановка Next.js сервера
 */
function stopNextServer(): void {
  if (nextServer) {
    if ('kill' in nextServer && typeof nextServer.kill === 'function') {
      nextServer.kill()
    }
    nextServer = null
  }
}

/**
 * Получить путь к иконке приложения
 */
function getIconPath(): string {
  if (process.platform === 'win32') {
    return isProd ? path.join(process.resourcesPath, 'icon.ico') : path.join(__dirname, '..', 'resources', 'icon.ico')
  }
  // Linux/macOS используют PNG
  return isProd ? path.join(process.resourcesPath, 'icon.png') : path.join(__dirname, '..', 'resources', 'icon.png')
}

/**
 * Создаёт главное окно приложения
 */
async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    backgroundColor: '#1a1a2e',
    frame: false, // Frameless window для кастомного title bar
  })

  // Показываем окно когда оно готово и закрываем splash
  mainWindow.once('ready-to-show', () => {
    // Небольшая задержка для плавности
    setTimeout(() => {
      if (splashWindow) {
        splashWindow.close()
        splashWindow = null
      }
      mainWindow?.show()
    }, 500)
  })

  // Загружаем приложение
  if (isProd) {
    // Production: загружаем через standalone сервер
    await mainWindow.loadURL(`http://127.0.0.1:${serverPort}`)
  } else {
    // Development: загружаем dev сервер
    const port = process.argv[2] || 3007
    await mainWindow.loadURL(`http://localhost:${port}`)
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Инициализация приложения
app.whenReady().then(async () => {
  // Миграция данных из старого пути @lena/animatrona в новый Animatrona
  // Должна быть до initializeDatabase() чтобы БД была на новом месте
  migrateFromOldPath()

  // Инициализируем БД при первом запуске / применяем миграции при обновлении
  await initializeDatabase()

  // Показываем splash screen сразу
  splashWindow = createSplashWindow()

  // Настраиваем обработчик media:// протокола
  setupMediaProtocolHandler()

  // Инициализируем whitelist разрешённых путей для media:// протокола
  initAllowedPaths()

  // Регистрируем IPC handlers
  registerIpcHandlers()

  // В production запускаем Next.js сервер
  if (isProd) {
    try {
      await startNextServer()
    } catch (err) {
      console.error(`[App] Failed to start Next.js server: ${err}`)

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
  await createWindow()

  // Инициализируем системный трей
  if (mainWindow) {
    initTray(mainWindow, isProd)
  }

  // Инициализируем автообновления
  if (mainWindow) {
    initAutoUpdater(mainWindow)
  }

  // Настраиваем listeners для frameless title bar
  if (mainWindow) {
    setupWindowStateListeners(mainWindow)
  }

  app.on('activate', async () => {
    // На macOS пересоздаём окно при клике на иконку в доке
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
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
app.on('before-quit', () => {
  app.isQuitting = true
  destroyTray()
  stopNextServer()
})

app.on('quit', () => {
  stopNextServer()
})

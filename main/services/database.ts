/**
 * Database Service — управление SQLite БД и Prisma миграциями
 *
 * Архитектура:
 * - В production: используется sql.js (WASM) для применения миграций
 * - В development: миграции применяются напрямую
 * - Обратная совместимость: user_version >= 5 → baseline помечается как применённая
 */

import crypto from 'crypto'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { createModuleLogger } from '../utils/logger'

const log = createModuleLogger('Database')

// Объявляем __non_webpack_require__ для обхода Webpack bundling
declare const __non_webpack_require__: NodeRequire

/** Имя baseline миграции — создаётся при первом запуске новой системы миграций */
const _BASELINE_MIGRATION_NAME = '0_baseline'

/** Минимальная версия user_version для обратной совместимости */
const LEGACY_DB_VERSION_FOR_BASELINE = 5

/** Проверка production режима */
const isProd = app.isPackaged || process.env.NODE_ENV === 'production'

/** Структура файла миграции Prisma */
interface MigrationFile {
  /** Имя папки миграции (timestamp_name) */
  name: string
  /** Содержимое migration.sql */
  sql: string
}

/**
 * Получить путь к базе данных SQLite
 * В production: %APPDATA%/Animatrona/data/app.db
 * В development: apps/animatrona/prisma/data/app.db
 */
export function getDatabasePath(): string {
  if (isProd) {
    const userDataPath = app.getPath('userData')
    const dbDir = path.join(userDataPath, 'data')
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    return path.join(dbDir, 'app.db')
  }
  return path.join(__dirname, '..', '..', 'prisma', 'data', 'app.db')
}

/**
 * Получить DATABASE_URL для Prisma
 */
export function getDatabaseUrl(): string {
  const dbPath = getDatabasePath()
  return `file:${dbPath}`
}

/**
 * Получить путь к папке с миграциями
 */
function getMigrationsDir(): string {
  if (isProd) {
    return path.join(process.resourcesPath, 'migrations')
  }
  return path.join(__dirname, '..', '..', 'prisma', 'migrations')
}

/**
 * Получить список миграций из папки prisma/migrations/
 * Миграции сортируются по имени (timestamp в начале имени)
 */
function getMigrationFiles(): MigrationFile[] {
  const migrationsDir = getMigrationsDir()

  if (!fs.existsSync(migrationsDir)) {
    log.warn('Migrations directory not found', { path: migrationsDir })
    return []
  }

  const folders = fs
    .readdirSync(migrationsDir)
    .filter((f) => {
      const fullPath = path.join(migrationsDir, f)
      return fs.statSync(fullPath).isDirectory()
    })
    .sort()

  return folders
    .map((folder) => {
      const sqlPath = path.join(migrationsDir, folder, 'migration.sql')
      if (!fs.existsSync(sqlPath)) {
        log.warn('migration.sql not found in folder', { folder })
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
 */
function parseSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let depth = 0

  const lines = sql.split('\n')

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('--')) {
      continue
    }

    if (/\bBEGIN\b/i.test(trimmedLine)) {
      depth++
    }

    if (/\bEND\s*;?\s*$/i.test(trimmedLine)) {
      depth = Math.max(0, depth - 1)
    }

    current += line + '\n'

    if (depth === 0 && trimmedLine.endsWith(';')) {
      const statement = current.trim()
      if (statement && !statement.startsWith('--')) {
        statements.push(statement.replace(/;\s*$/, ''))
      }
      current = ''
    }
  }

  const remaining = current.trim()
  if (remaining && !remaining.startsWith('--')) {
    statements.push(remaining.replace(/;\s*$/, ''))
  }

  return statements
}

/**
 * Применяет Prisma миграции к существующей БД
 * Использует sql.js (WASM) — без native модулей
 */
async function applyPrismaMigrations(dbPath: string): Promise<void> {
  const sqlJsPath = isProd
    ? path.join(process.resourcesPath, 'node_modules', 'fts5-sql-bundle')
    : path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'fts5-sql-bundle')

  const initSqlJs = __non_webpack_require__(sqlJsPath).default

  const wasmPath = isProd
    ? path.join(process.resourcesPath, 'sql-wasm.wasm')
    : path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'fts5-sql-bundle', 'dist', 'sql-wasm.wasm')

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

    // Обратная совместимость: если user_version >= 5 и нет записей — помечаем ВСЕ миграции как применённые
    // (legacy БД уже содержит все таблицы из init миграции)
    if (userVersion >= LEGACY_DB_VERSION_FOR_BASELINE && !hasAnyMigrations) {
      log.info('Legacy database detected, marking all migrations as applied', { userVersion })

      // Получаем все доступные миграции и помечаем их как применённые
      const allMigrations = getMigrationFiles()
      for (const migration of allMigrations) {
        const migrationId = crypto.randomUUID()
        db.run(
          `
          INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
          VALUES (?, '', ?, datetime('now'), datetime('now'), 0)
        `,
          [migrationId, migration.name]
        )
        log.info('Marked migration as applied (legacy baseline)', { migration: migration.name })
      }
    }

    // Получаем уже применённые миграции
    const appliedResult = db.exec('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL')
    const appliedNames = new Set<string>(appliedResult[0]?.values.map((v) => v[0] as string) || [])

    // Получаем все доступные миграции
    const migrations = getMigrationFiles()

    if (migrations.length === 0) {
      log.info('No migrations to apply')
      db.close()
      return
    }

    // Применяем новые миграции
    let appliedCount = 0
    for (const migration of migrations) {
      if (appliedNames.has(migration.name)) {
        continue
      }

      log.info('Applying migration', { name: migration.name })

      // Backup перед миграцией
      const backupPath = `${dbPath}.backup.${migration.name}`
      try {
        fs.copyFileSync(dbPath, backupPath)
      } catch {
        log.warn('Failed to create backup', { backupPath })
      }

      // Записываем начало миграции
      const migrationId = crypto.randomUUID()
      db.run(
        `
        INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at)
        VALUES (?, '', ?, datetime('now'))
      `,
        [migrationId, migration.name]
      )

      // Разбиваем SQL на отдельные команды
      const sqlCommands = parseSqlStatements(migration.sql)

      let stepsApplied = 0
      for (const cmd of sqlCommands) {
        try {
          db.run(cmd)
          stepsApplied++
        } catch (cmdErr) {
          log.error('Migration command failed', { migration: migration.name, error: String(cmdErr) })
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
        [stepsApplied, migrationId]
      )

      log.info('Migration applied successfully', { name: migration.name, steps: stepsApplied })
      appliedCount++
    }

    if (appliedCount > 0) {
      log.info('Migrations applied', { count: appliedCount })
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
 */
export async function initializeDatabase(): Promise<void> {
  const dbPath = getDatabasePath()

  // В dev режиме только применяем миграции, не копируем template
  if (!isProd) {
    try {
      await applyPrismaMigrations(dbPath)
    } catch (err) {
      log.error('Migration error in dev mode', { error: String(err) })
    }
    return
  }

  const templatePath = path.join(process.resourcesPath, 'template.db')

  // Первый запуск или пустая БД — копируем template
  const dbExists = fs.existsSync(dbPath)
  const dbSize = dbExists ? fs.statSync(dbPath).size : 0

  if (!dbExists || dbSize === 0) {
    if (!fs.existsSync(templatePath)) {
      log.error('Template database not found', { path: templatePath })
      return
    }

    try {
      fs.copyFileSync(templatePath, dbPath)
      log.info('Template database copied', { path: dbPath })
    } catch (err) {
      log.error('Failed to copy template database', { error: String(err) })
      return
    }
  }

  // Применяем Prisma миграции (для обновлений приложения)
  try {
    await applyPrismaMigrations(dbPath)
  } catch (err) {
    log.error('Migration error', { error: String(err) })
  }
}

/**
 * Миграция данных из старого пути @lena/animatrona в новый Animatrona
 */
export function migrateFromOldPath(): void {
  if (!isProd) {
    return
  }

  const appData = path.dirname(app.getPath('userData'))
  const oldPath = path.join(appData, '@lena', 'animatrona')
  const newPath = app.getPath('userData')

  if (!fs.existsSync(oldPath)) {
    return
  }

  const newDataDir = path.join(newPath, 'data')
  const newDbPath = path.join(newDataDir, 'app.db')

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
 * Получить Prisma Client singleton
 * Реэкспорт из utils/db.ts для удобства импорта
 */
export { getPrismaClient as getDb, prisma } from '../utils/db'

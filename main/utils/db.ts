/**
 * Prisma Client для Main Process
 *
 * Singleton для работы с БД из main process Electron.
 * Использует тот же generated client что и renderer.
 */

import { app } from 'electron'
import path from 'path'

import { PrismaLibSql } from '@prisma/adapter-libsql'

import { createModuleLogger } from './logger'

// eslint-disable-next-line @nx/enforce-module-boundaries -- Electron main process shares Prisma client with renderer
import { PrismaClient } from '../../renderer/src/generated/prisma'

const log = createModuleLogger('Db')

// В packaged Electron app.isPackaged === true
const isProd = app.isPackaged || process.env.NODE_ENV === 'production'

/**
 * Singleton для Prisma Client
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Получить путь к базе данных SQLite
 */
function getDatabasePath(): string {
  if (isProd) {
    const userDataPath = app.getPath('userData')
    return path.join(userDataPath, 'data', 'app.db')
  }
  // В development используем локальный путь
  return path.join(__dirname, '..', '..', 'prisma', 'data', 'app.db')
}

/**
 * Получить URL базы данных для libsql
 */
function getDatabaseUrl(): string {
  const dbPath = getDatabasePath()
  // Нормализуем backslashes для Windows
  return `file:${dbPath.replace(/\\/g, '/')}`
}

/**
 * Создать Prisma Client и настроить SQLite для конкурентного доступа
 */
function createPrismaClient(): PrismaClient {
  const databaseUrl = getDatabaseUrl()

  log.info('Connecting to database', { url: databaseUrl })

  // Prisma 7: используем Driver Adapter (libsql для SQLite без electron-rebuild)
  const adapter = new PrismaLibSql({ url: databaseUrl })

  const client = new PrismaClient({
    log: ['error', 'warn'],
    adapter,
  })

  // Настраиваем SQLite для конкурентного доступа:
  // WAL mode — читатели не блокируют писателей и наоборот
  // busy_timeout — ждать освобождения блокировки (может не работать в libsql, но не навредит)
  // synchronous=NORMAL — баланс производительности и надёжности для WAL
  client
    .$executeRawUnsafe('PRAGMA journal_mode = WAL')
    .then(() => log.info('SQLite: WAL mode включён'))
    .catch((e: unknown) => log.warn('SQLite: не удалось включить WAL', { error: String(e) }))
  client
    .$executeRawUnsafe('PRAGMA busy_timeout = 15000')
    .then(() => log.info('SQLite: busy_timeout = 15s'))
    .catch((e: unknown) => log.warn('SQLite: не удалось установить busy_timeout', { error: String(e) }))
  client
    .$executeRawUnsafe('PRAGMA synchronous = NORMAL')
    .catch((e: unknown) => log.warn('SQLite: не удалось установить synchronous', { error: String(e) }))

  return client
}

/**
 * Получить singleton Prisma Client
 */
export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

/**
 * Закрыть соединение с БД (при выходе из приложения)
 */
export async function closePrismaClient(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect()
    globalForPrisma.prisma = undefined
  }
}

/**
 * Prisma Client singleton
 */
export const prisma = getPrismaClient()

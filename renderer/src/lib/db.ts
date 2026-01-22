import path from 'path'
import { PrismaClient } from '../generated/prisma'

/**
 * Singleton для Prisma Client
 *
 * В production (Electron) путь к БД передаётся через DATABASE_URL из main process.
 * В development используется абсолютный путь к локальной БД.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Получить URL базы данных
 * Использует DATABASE_URL если установлен, иначе вычисляет абсолютный путь
 */
function getDatabaseUrl(): string {
  // Если DATABASE_URL явно установлен (production Electron) - используем его
  if (process.env.DATABASE_URL) {
    // Нормализуем backslashes для Windows путей
    return process.env.DATABASE_URL.replace(/\\/g, '/')
  }

  // Если DATABASE_PATH установлен (production Electron) - формируем URL
  if (process.env.DATABASE_PATH) {
    // Заменяем backslashes на forward slashes для SQLite URL
    const normalizedPath = process.env.DATABASE_PATH.replace(/\\/g, '/')
    return `file:${normalizedPath}`
  }

  // В development вычисляем абсолютный путь к БД
  // __dirname в Next.js указывает на разные места, поэтому используем process.cwd()
  const cwd = process.cwd()

  // Определяем путь к БД относительно корня приложения
  let dbPath: string
  if (cwd.includes('renderer')) {
    // Если cwd в renderer, поднимаемся на уровень выше
    dbPath = path.resolve(cwd, '..', 'prisma', 'data', 'app.db')
  } else if (cwd.includes('animatrona')) {
    // Если cwd в animatrona
    dbPath = path.resolve(cwd, 'prisma', 'data', 'app.db')
  } else {
    // Если cwd в корне монорепо
    dbPath = path.resolve(cwd, 'apps', 'animatrona', 'prisma', 'data', 'app.db')
  }

  return `file:${dbPath}`
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = getDatabaseUrl()

  return new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// Кэшируем prisma singleton ВСЕГДА (включая production)
// Иначе в standalone Electron создаётся новый PrismaClient при каждом вызове,
// что вызывает SQLite file locking и connection exhaustion
globalForPrisma.prisma = prisma

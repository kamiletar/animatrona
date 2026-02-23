/**
 * UnifiedIPFSService — Обёртка над Kubo RPC Client
 *
 * Предоставляет API для работы с IPFS:
 * - addFile, addBytes, cat, stat, has
 *
 * Использует kubo-rpc-client для работы с Kubo демоном
 * (либо встроенным, либо IPFS Desktop).
 */

import { promises as fs } from 'fs'
import type { KuboRPCClient } from 'kubo-rpc-client'
import { CID } from 'multiformats/cid'
import path from 'path'

import type { IpfsAddResult, IpfsStatResult } from '../../../shared/types/ipfs'
import { createModuleLogger } from '../../utils/logger'
import { getKuboService } from '../kubo'

const log = createModuleLogger('UnifiedIPFS')

/**
 * Получить Kubo RPC клиент
 *
 * @throws Error если KuboService не инициализирован
 */
function getClient(): KuboRPCClient {
  return getKuboService().getClient()
}

/**
 * Добавить файл в IPFS
 *
 * @param filePath - Путь к файлу на диске
 * @param onProgress - Callback для прогресса (опционально)
 * @returns CID и размер добавленного файла
 */
export async function addFile(filePath: string, onProgress?: (bytes: number) => void): Promise<IpfsAddResult> {
  const client = getClient()

  // Читаем файл
  const content = await fs.readFile(filePath)
  const fileName = path.basename(filePath)

  log.info('Добавляю файл', { fileName, bytes: content.length })

  // Добавляем в IPFS через Kubo
  const result = await client.add(content, {
    // pin: true — по умолчанию Kubo пинит добавленные файлы
    progress: onProgress ? (bytes: bigint) => onProgress(Number(bytes)) : undefined,
  })

  log.info('Файл добавлен', { cid: result.cid.toString() })

  return {
    cid: result.cid.toString(),
    size: Number(result.size),
    path: fileName,
  }
}

/**
 * Добавить байты (Buffer) в IPFS
 *
 * @param content - Buffer с содержимым
 * @returns CID добавленного контента
 */
export async function addBytes(content: Buffer): Promise<string> {
  const client = getClient()

  log.info('Добавляю bytes', { bytes: content.length })

  const result = await client.add(content)

  log.info('Bytes добавлены', { cid: result.cid.toString() })

  return result.cid.toString()
}

/**
 * Парсит строку CID с опциональным путём
 *
 * @param cidPath - CID или CID/path/to/file
 * @returns Объект с CID и опциональным путём
 */
function parseCidPath(cidPath: string): { cid: string; path?: string } {
  const parts = cidPath.split('/')
  const cidString = parts[0]

  if (parts.length > 1) {
    return { cid: cidString, path: parts.slice(1).join('/') }
  }

  return { cid: cidString }
}

/**
 * Прочитать контент по CID (с поддержкой путей внутри директорий)
 *
 * @param cidPath - CID контента или CID/path/to/file для файла в директории
 * @returns Buffer с содержимым
 */
export async function cat(cidPath: string): Promise<Buffer> {
  const client = getClient()
  const { cid, path: filePath } = parseCidPath(cidPath)

  log.debug('Читаю контент', { cidPath })

  // Формируем полный путь для Kubo API
  const fullPath = filePath ? `${cid}/${filePath}` : cid

  const chunks: Uint8Array[] = []
  for await (const chunk of client.cat(fullPath)) {
    chunks.push(chunk)
  }

  const content = Buffer.concat(chunks)
  log.debug('Прочитано', { bytes: content.length })

  return content
}

/**
 * Прочитать контент с поддержкой отмены
 * Прекращает чтение если shouldAbort() возвращает true
 *
 * @param cidPath - CID контента или CID/path/to/file
 * @param shouldAbort - Функция проверки отмены (например, клиент отключился)
 * @returns Buffer с содержимым или null если отменено
 */
export async function catAbortable(cidPath: string, shouldAbort: () => boolean): Promise<Buffer | null> {
  const client = getClient()
  const { cid, path: filePath } = parseCidPath(cidPath)

  const fullPath = filePath ? `${cid}/${filePath}` : cid

  const chunks: Uint8Array[] = []
  for await (const chunk of client.cat(fullPath)) {
    if (shouldAbort()) {
      log.debug('cat отменён (клиент отключился)', { cidPath })
      return null
    }
    chunks.push(chunk)
  }

  return Buffer.concat(chunks)
}

/**
 * Получить статистику по CID (с поддержкой путей внутри директорий)
 *
 * @param cidPath - CID контента или CID/path/to/file для файла в директории
 * @returns Статистика (размер, тип, количество блоков)
 */
export async function stat(cidPath: string): Promise<IpfsStatResult> {
  const client = getClient()
  const { cid, path: filePath } = parseCidPath(cidPath)

  log.debug('Stat', { cidPath })

  // Формируем полный путь для Kubo API
  const fullPath = filePath ? `${cid}/${filePath}` : cid

  // Kubo files.stat возвращает информацию о файле/директории
  const info = await client.files.stat(`/ipfs/${fullPath}`)

  // Определяем тип
  let type: 'file' | 'directory' | 'raw' = 'file'
  if (info.type === 'directory') {
    type = 'directory'
  } else if (info.type === 'file') {
    type = 'file'
  }

  return {
    cid: cidPath,
    size: Number(info.size),
    blocks: info.blocks,
    type,
    local: true, // Kubo хранит данные локально
  }
}

/**
 * Проверить наличие контента локально
 *
 * @param cidString - CID контента
 * @returns true если контент доступен локально
 */
export async function has(cidString: string): Promise<boolean> {
  try {
    const client = getClient()
    const cid = CID.parse(cidString)

    // Проверяем через refs local
    // Если CID есть в локальном хранилище — вернёт его
    for await (const ref of client.refs.local()) {
      if (ref.ref === cid.toString()) {
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

/**
 * Проверить наличие блока по CID (быстрая проверка)
 *
 * @param cidString - CID блока
 * @returns true если блок есть локально
 */
export async function hasBlock(cidString: string): Promise<boolean> {
  try {
    const client = getClient()

    // block.stat возвращает информацию если блок есть
    // Вызывает ошибку если блока нет
    await client.block.stat(CID.parse(cidString))
    return true
  } catch {
    return false
  }
}

/**
 * Сохранить контент из IPFS в файл
 *
 * @param cidString - CID контента
 * @param outputPath - Путь для сохранения
 */
export async function saveToFile(cidString: string, outputPath: string): Promise<void> {
  const content = await cat(cidString)
  await fs.writeFile(outputPath, content)
  log.info('Сохранено в файл', { outputPath })
}

// === Виртуальные директории IPFS ===

/**
 * Элемент виртуальной директории для publish режима
 */
export interface DirEntry {
  /** Имя файла/директории */
  name: string
  /** Тип: файл или директория */
  type: 'file' | 'directory'
  /** CID существующего файла в IPFS (для файлов) */
  cid?: string | null
  /** Контент для новых файлов (index.html, manifest.json) */
  content?: Buffer
  /** Вложенные элементы (для директорий) */
  children?: DirEntry[]
}

/**
 * Создать IPFS директорию из существующих CID БЕЗ скачивания
 *
 * Эта функция строит виртуальную директорию в IPFS, используя
 * ссылки на существующие CID вместо скачивания и повторной загрузки файлов.
 *
 * @param entries - Структура директории
 * @returns Root CID созданной директории
 */
export async function createDirectoryFromCids(entries: DirEntry[]): Promise<string> {
  const client = getClient()

  // Kubo использует MFS (Mutable File System) для создания директорий
  // Создаём временную директорию в MFS, добавляем файлы, получаем CID

  const tempPath = `/tmp-dir-${Date.now()}`

  try {
    // Создаём корневую директорию
    await client.files.mkdir(tempPath, { parents: true })

    /**
     * Рекурсивно добавляем элементы в MFS директорию
     */
    async function addEntries(items: DirEntry[], basePath: string): Promise<void> {
      const addedNames = new Set<string>()

      for (const item of items) {
        // Пропускаем дубликаты имён
        if (addedNames.has(item.name)) {
          log.warn('Пропускаю дубликат', { name: item.name })
          continue
        }

        const itemPath = `${basePath}/${item.name}`

        try {
          if (item.type === 'file') {
            if (item.cid) {
              // Ссылка на существующий CID — используем cp
              await client.files.cp(`/ipfs/${item.cid}`, itemPath)
            } else if (item.content) {
              // Новый файл — добавляем контент
              await client.files.write(itemPath, item.content, { create: true })
            } else {
              log.warn('Пропускаю файл без CID/content', { name: item.name })
              continue
            }
          } else if (item.type === 'directory' && item.children) {
            // Создаём поддиректорию
            await client.files.mkdir(itemPath, { parents: true })
            // Рекурсивно добавляем содержимое
            await addEntries(item.children, itemPath)
          }

          addedNames.add(item.name)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          if (errorMsg.includes('already exists')) {
            log.warn('Путь уже существует, пропускаю', { name: item.name })
          } else {
            throw error
          }
        }
      }
    }

    log.info('Создаю виртуальную директорию', { entryCount: entries.length })

    await addEntries(entries, tempPath)

    // Получаем CID созданной директории
    const statResult = await client.files.stat(tempPath)
    const rootCid = statResult.cid.toString()

    // Удаляем временную директорию из MFS (CID останется в blockstore)
    await client.files.rm(tempPath, { recursive: true })

    log.info('Виртуальная директория создана', { cid: rootCid })

    return rootCid
  } catch (error) {
    // Пытаемся очистить в случае ошибки
    try {
      await client.files.rm(tempPath, { recursive: true })
    } catch {
      // Игнорируем ошибку очистки
    }
    throw error
  }
}

/**
 * Добавить директорию в IPFS
 *
 * @param dirPath - Путь к директории
 * @param recursive - Рекурсивно добавлять поддиректории
 * @returns Массив результатов для каждого файла + корневой CID
 */
export async function addDirectory(
  dirPath: string,
  recursive = true
): Promise<{ files: IpfsAddResult[]; rootCid: string }> {
  const client = getClient()
  const results: IpfsAddResult[] = []

  log.info('Добавляю директорию', { dirPath })

  // Собираем файлы
  const files = await collectFiles(dirPath, recursive)

  // Используем addAll для добавления всей директории с сохранением структуры
  const entries = files.map((f) => ({
    path: f.relativePath,
    content: fs.createReadStream(f.absolutePath),
  }))

  // Добавляем все файлы
  let rootCid = ''
  for await (const result of client.addAll(entries, { wrapWithDirectory: true })) {
    if (result.path === '') {
      // Это корневая директория
      rootCid = result.cid.toString()
    } else {
      results.push({
        cid: result.cid.toString(),
        size: Number(result.size),
        path: result.path,
      })
    }
  }

  log.info('Директория добавлена', { fileCount: results.length, rootCid })

  return { files: results, rootCid }
}

/**
 * Запустить Garbage Collection — удалить неиспользуемые блоки из хранилища
 *
 * @returns Количество удалённых блоков и освобождённый размер
 */
export async function repoGc(): Promise<{ blocksRemoved: number }> {
  const client = getClient()

  log.info('Запускаю Garbage Collection...')

  let blocksRemoved = 0
  for await (const result of client.repo.gc()) {
    if (result.err) {
      log.debug('GC пропустил блок', { error: String(result.err) })
    } else {
      blocksRemoved++
    }
  }

  log.info('GC завершён', { blocksRemoved })
  return { blocksRemoved }
}

// === Вспомогательные функции ===

interface FileEntry {
  absolutePath: string
  relativePath: string
}

/**
 * Рекурсивно собрать все файлы в директории
 */
async function collectFiles(dirPath: string, recursive: boolean): Promise<FileEntry[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const files: FileEntry[] = []

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name)

    if (entry.isFile()) {
      files.push({
        absolutePath,
        relativePath: entry.name,
      })
    } else if (entry.isDirectory() && recursive) {
      const subFiles = await collectFiles(absolutePath, recursive)
      for (const subFile of subFiles) {
        files.push({
          absolutePath: subFile.absolutePath,
          relativePath: path.join(entry.name, subFile.relativePath),
        })
      }
    }
  }

  return files
}

/**
 * Удалить блоки из blockstore по списку CID
 *
 * @param cids - Список CID для удаления
 * @returns Количество удалённых блоков
 */
export async function removeBlocks(cids: string[]): Promise<{ deleted: number; errors: number }> {
  const client = getClient()

  let deleted = 0
  let errors = 0

  for (const cidStr of cids) {
    try {
      const cid = CID.parse(cidStr)

      // Сначала unpinним (если запинен)
      try {
        await client.pin.rm(cid)
      } catch {
        // Может не быть запинен — игнорируем
      }

      // Удаляем блок
      // В Kubo нет прямого способа удалить блок, но можно запустить GC
      // после unpin — он удалит неиспользуемые блоки

      deleted++
      log.debug('Блок отпинен', { cid: cidStr })
    } catch (error) {
      errors++
      log.warn('Ошибка удаления блока', { cid: cidStr, error: String(error) })
    }
  }

  // Запускаем GC для фактического удаления отпиненных блоков
  if (deleted > 0) {
    try {
      log.info('Запускаю GC...')
      for await (const _result of client.repo.gc()) {
        // Итерируем для выполнения GC
      }
      log.info('GC завершён')
    } catch (error) {
      log.warn('GC error', { error: String(error) })
    }
  }

  log.info('Блоки удалены', { deleted, errors, total: cids.length })
  return { deleted, errors }
}

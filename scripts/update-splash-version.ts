/**
 * Скрипт для обновления версии в splash.html
 * Запускается перед билдом для синхронизации версии из package.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')

// Читаем версию из package.json
const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
const version = packageJson.version

// Читаем splash.html
const splashPath = join(ROOT, 'resources', 'splash.html')
let splashHtml = readFileSync(splashPath, 'utf-8')

// Заменяем версию в fallback (v0.0.0 или любая другая версия)
const versionRegex = /(<span class="version" id="version">)v[\d.]+(<\/span>)/
const newVersionTag = `$1v${version}$2`

if (versionRegex.test(splashHtml)) {
  const oldVersion = splashHtml.match(versionRegex)?.[0]
  splashHtml = splashHtml.replace(versionRegex, newVersionTag)
  writeFileSync(splashPath, splashHtml, 'utf-8')
  console.log(`✅ Версия в splash.html обновлена: ${oldVersion} → v${version}`)
} else {
  console.log(`⚠️ Не удалось найти тег версии в splash.html`)
}

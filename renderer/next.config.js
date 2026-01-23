const path = require('path')
const fs = require('fs')

// Определяем outputFileTracingRoot в зависимости от окружения
// Монорепо lena: __dirname = apps/animatrona/renderer → ../../../
// Standalone: не используем outputFileTracingRoot (не нужен для трейсинга)
const monorepoRoot = path.join(__dirname, '../../../')
const standaloneRoot = path.join(__dirname, '..')
// Проверяем project.json (Nx конфиг) в корне animatrona
// Если есть project.json → монорепо (Nx workspace), если нет → standalone (project.json исключён из rsync)
const isMonorepo = fs.existsSync(path.join(standaloneRoot, 'project.json'))

// Debug вывод для CI
console.log('[next.config.js] __dirname:', __dirname)
console.log('[next.config.js] standaloneRoot:', standaloneRoot)
console.log('[next.config.js] monorepoRoot:', monorepoRoot)
console.log('[next.config.js] isMonorepo:', isMonorepo)
console.log('[next.config.js] turbopack.root будет:', standaloneRoot)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone для Electron с HTTP сервером
  output: 'standalone',

  // Корень проекта — только для монорепо (нужен для трейсинга @lena/* пакетов)
  // Для standalone не используем (вызывает проблемы с project directory detection)
  ...(isMonorepo ? { outputFileTracingRoot: monorepoRoot } : {}),

  // Оптимизация изображений через API route /api/image
  images: {
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
  },

  // Транспиляция shared библиотек из монорепо
  transpilePackages: ['@lena/ui', '@lena/chakra-provider', '@lena/form-components', '@lena/query-provider'],

  // TypeScript проверка
  typescript: {
    ignoreBuildErrors: false,
  },

  // Исключаем пакеты из серверного бандла (загружаются из node_modules в runtime)
  serverExternalPackages: [
    'fts5-sql-bundle',
    'kysely-wasm',
    '@zenstackhq/orm',
    '@zenstackhq/plugin-policy',
    '@zenstackhq/server',
  ],

  // Разрешаем cross-origin запросы в dev режиме (для Electron)
  allowedDevOrigins: ['http://127.0.0.1:3010', 'http://localhost:3010'],

  // Включаем ZenStack и Prisma файлы в standalone
  // Пути относительны к outputFileTracingRoot (корень монорепо)
  outputFileTracingIncludes: {
    '/api/**/*': [
      // ZenStack ORM schema (импортируется из enhance.ts как '../../../schema')
      './apps/animatrona/schema.ts',
      // fts5-sql-bundle для ZenStack ORM с FTS5 поддержкой
      './node_modules/fts5-sql-bundle/**/*',
      // ZenStack ORM и зависимости
      './node_modules/@zenstackhq/**/*',
      './node_modules/kysely/**/*',
      './node_modules/kysely-wasm/**/*',
      // Prisma client (fallback)
      './apps/animatrona/renderer/src/generated/prisma/**/*',
      // @lena монорепо библиотеки
      './libs/ui/**/*',
      './libs/form-components/**/*',
      './libs/query-provider/**/*',
      './libs/chakra-provider/**/*',
    ],
  },

  // Turbopack конфигурация
  turbopack: {
    // Указываем на корень где находится package.json и node_modules/
    // Это standaloneRoot (один уровень выше renderer/)
    // - Монорепо: apps/animatrona/
    // - Standalone: animatrona-build/
    root: standaloneRoot,
  },
}

module.exports = nextConfig

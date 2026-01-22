const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone для Electron с HTTP сервером
  output: 'standalone',

  // Корень монорепо — нужен для правильного трейсинга зависимостей
  outputFileTracingRoot: path.join(__dirname, '../../../'),

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

  // Пустой turbopack конфиг чтобы избежать предупреждений
  turbopack: {},
}

module.exports = nextConfig

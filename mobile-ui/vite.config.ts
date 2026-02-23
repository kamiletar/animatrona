import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@lena/video-player-react': path.resolve(__dirname, '../../../libs/video-player-react/src/index.ts'),
      '@lena/video-player-core': path.resolve(__dirname, '../../../libs/video-player-core/src/index.ts'),
    },
    // Дедупликация React — важно для библиотек с хуками
    dedupe: ['react', 'react-dom'],
  },
  base: '/', // Абсолютные пути для корректной работы SPA routing
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Оптимизация для мобильных устройств
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          chakra: ['@chakra-ui/react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Прокси для API в dev режиме
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})

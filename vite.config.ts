import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      tldts: path.resolve(import.meta.dirname, 'src/mocks/stubs/tldts.ts'),
    },
  },
  server: {
    watch: {
      ignored: ['**/dist/**', '**/lighthouse/**', '**/test-results/**', '**/playwright-report/**', '**/tests/__screenshots__/**'],
    },
  },
  build: {
    target: 'es2022',
  },
})

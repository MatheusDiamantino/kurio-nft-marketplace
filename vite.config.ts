import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // Drop the Public Suffix List pulled by MSW's cookie store (see the stub).
      tldts: path.resolve(import.meta.dirname, 'src/mocks/stubs/tldts.ts'),
    },
  },
  build: {
    target: 'es2022',
  },
})

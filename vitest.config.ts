import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts so tests don't load the CRXJS plugin.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})

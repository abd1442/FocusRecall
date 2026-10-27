import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Core and renderer-state tests use Node. Desktop APIs are mocked for notes-service regression
// tests; SQLite migrations and real vault-file writes run on system Node.
export default defineConfig({
  resolve: { alias: { '@core': fileURLToPath(new URL('./src/core',import.meta.url)) } },
  test: {
    include: ['src/core/**/*.test.ts', 'src/renderer/src/**/*.test.ts'],
    environment: 'node'
  }
})

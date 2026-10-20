import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Tests live in src/core. Desktop APIs are mocked for notes-service regression
// tests; SQLite migrations and real vault-file writes run on system Node.
export default defineConfig({
  resolve: { alias: { '@core': fileURLToPath(new URL('./src/core',import.meta.url)) } },
  test: {
    include: ['src/core/**/*.test.ts'],
    environment: 'node'
  }
})

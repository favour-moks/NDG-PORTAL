import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { loadEnvFile } from 'node:process'

// Integration tests (dedupe.test.ts) need DATABASE_URL to run real queries
// against pg_trgm similarity() — not something worth mocking. .env.local is
// gitignored, so this is a no-op in CI unless the same variables are set
// another way.
try {
  loadEnvFile(path.resolve(__dirname, '.env.local'))
} catch {
  // No .env.local — fine for unit tests that don't touch the database.
}

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

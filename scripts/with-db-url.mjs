// Runs a Supabase CLI subcommand against DATABASE_URL from .env.local.
// Invoked as: node --env-file=.env.local scripts/with-db-url.mjs <supabase args...>
import { spawnSync } from 'node:child_process'

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('DATABASE_URL is not set in .env.local')
  process.exit(1)
}

const args = process.argv.slice(2)
const result = spawnSync('npx', ['supabase', ...args, '--db-url', dbUrl], {
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? 1)

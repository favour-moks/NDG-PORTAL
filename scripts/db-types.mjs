// Regenerates src/types/database.ts from DATABASE_URL in .env.local.
// Invoked as: node --env-file=.env.local scripts/db-types.mjs
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('DATABASE_URL is not set in .env.local')
  process.exit(1)
}

const result = spawnSync(
  'npx',
  ['supabase', 'gen', 'types', 'typescript', '--db-url', dbUrl, '--schema', 'public'],
  { encoding: 'utf-8', shell: true }
)

if (result.status !== 0) {
  console.error(result.stderr)
  process.exit(result.status ?? 1)
}

writeFileSync('src/types/database.ts', result.stdout)
console.log('Wrote src/types/database.ts')

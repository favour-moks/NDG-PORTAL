#!/usr/bin/env node
// TASK-079: every import of the service-role client (src/lib/supabase/admin.ts)
// must carry a comment explaining why that call site needs to bypass RLS —
// admin.ts's own header says so, but nothing enforced it until this. Run in
// CI (see .github/workflows/ci.yml) so a new import site can't land silently
// without one.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

// Node's fs has no glob before 22.x in some environments — walk manually
// instead of depending on an extra package for one CI script.
function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(fullPath, files)
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(fullPath)
  }
  return files
}

const IMPORT_PATTERN = /from\s+['"]@\/lib\/supabase\/admin['"]/

const violations = []

for (const file of walk('src')) {
  const lines = readFileSync(file, 'utf-8').split('\n')
  lines.forEach((line, index) => {
    if (!IMPORT_PATTERN.test(line)) return
    const precedingLines = lines.slice(Math.max(0, index - 3), index)
    const hasComment = precedingLines.some((l) => l.trim().startsWith('//'))
    if (!hasComment) {
      violations.push(`${file}:${index + 1}`)
    }
  })
}

if (violations.length > 0) {
  console.error('Missing justifying comment at admin.ts import site(s):')
  for (const v of violations) console.error(`  ${v}`)
  console.error('\nEvery import of createAdminClient must carry a comment explaining why it bypasses RLS.')
  process.exit(1)
}

console.log('All admin.ts import sites carry a justifying comment.')

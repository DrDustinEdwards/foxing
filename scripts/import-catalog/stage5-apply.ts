// Stage 5: Apply generated SQL files to D1 via wrangler d1 execute --remote.
// Runs wrangler from apps/web/ (where wrangler.jsonc lives).
// Run: pnpm tsx scripts/import-catalog/stage5-apply.ts

import { readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const SQL_DIR = resolve(process.cwd(), 'scripts/import-catalog/sql')
const WEB_CF_DIR = resolve(process.cwd(), 'apps/web')
const D1_DB = 'foxing'

function applyFile(sqlFile: string): Promise<void> {
  return new Promise((res, rej) => {
    const displayPath = sqlFile.replace(process.cwd(), '.')
    console.log(`  -> ${displayPath}`)
    const proc = spawn(
      'pnpm',
      ['exec', 'wrangler', 'd1', 'execute', D1_DB, '--remote', '--yes', '--file', sqlFile],
      { cwd: WEB_CF_DIR, stdio: 'inherit', shell: true },
    )
    proc.on('close', code => {
      if (code === 0) res()
      else rej(new Error(`wrangler exited with code ${code} for ${displayPath}`))
    })
    proc.on('error', rej)
  })
}

async function main() {
  if (!existsSync(SQL_DIR)) {
    console.error(`SQL directory not found: ${SQL_DIR}`)
    console.error('Run stage4 first: pnpm tsx scripts/import-catalog/stage4-sql.ts')
    process.exit(1)
  }

  const files = readdirSync(SQL_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => resolve(SQL_DIR, f))

  if (files.length === 0) {
    console.error('No .sql files found. Run stage4 first.')
    process.exit(1)
  }

  console.log(`Stage 5: applying ${files.length} SQL file(s) to D1 (${D1_DB} --remote)\n`)

  for (const file of files) {
    await applyFile(file)
  }

  console.log('\nAll files applied.')
  console.log('Run stage6 next: pnpm tsx scripts/import-catalog/stage6-verify.ts')
}

main().catch(err => { console.error(err); process.exit(1) })

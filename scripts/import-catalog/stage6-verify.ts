// Stage 6: Verify D1 row counts, 1800-year gate, and FTS smoke test.
// Run: pnpm tsx scripts/import-catalog/stage6-verify.ts

import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

const WEB_CF_DIR = resolve(process.cwd(), 'apps/web')
const D1_DB = 'foxing'

interface D1JsonResult {
  results: Array<Record<string, unknown>>
}

function d1Query(sql: string): D1JsonResult[] {
  // Use execSync so the full command string is properly shell-quoted.
  // Double-quote the SQL; single quotes inside are safe in cmd.exe double-quoted strings.
  const cmd = `pnpm exec wrangler d1 execute ${D1_DB} --remote --command "${sql}" --json`
  let raw: string
  try {
    raw = execSync(cmd, { cwd: WEB_CF_DIR, encoding: 'utf-8' })
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string }
    raw = (err.stdout ?? '') + (err.stderr ?? '')
    if (!raw) throw new Error(err.message ?? String(e))
  }
  // wrangler emits banner/log lines before the JSON array.
  // Find the first '[' followed by '{' (after whitespace).
  let pos = 0
  while (pos < raw.length) {
    const idx = raw.indexOf('[', pos)
    if (idx === -1) throw new Error(`No JSON array in output for: ${sql}\n${raw.slice(0, 400)}`)
    const rest = raw.slice(idx + 1).trimStart()
    if (rest.startsWith('{')) return JSON.parse(raw.slice(idx)) as D1JsonResult[]
    pos = idx + 1
  }
  throw new Error(`No valid JSON in output for: ${sql}\n${raw.slice(0, 400)}`)
}

function count(table: string): number | 'ERROR' {
  try {
    const res = d1Query(`SELECT COUNT(*) AS n FROM ${table}`)
    return res[0]?.results[0]?.n as number
  } catch (e) {
    console.error(`  query failed for ${table}:`, (e as Error).message)
    return 'ERROR'
  }
}

async function main() {
  console.log('Stage 6: verify D1\n')

  let pass = 0
  let fail = 0

  // Row count checks
  const checks: Array<[string, number]> = [
    ['books',                    2237],
    ['book_awards',              77],
    ['external_book_clubs',      30],
    ['external_book_club_picks', 888],
    ['book_of_the_month',        1],
    ['journal_posts',            75],
    ['journal_post_versions',    0],
  ]

  for (const [table, expected] of checks) {
    const n = count(table)
    const ok = n === expected
    ok ? pass++ : fail++
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${table}: ${n} (expected ${expected})`)
  }

  // 1800-year gate: the ONLY book with publication_year=1800 must be Castle Rackrent.
  // Any other 1800 is a data-quality error (OL placeholder).
  console.log('\n1800-year gate:')
  try {
    const res = d1Query(
      "SELECT slug, title, publication_year FROM books WHERE publication_year = 1800"
    )
    const rows = res[0]?.results ?? []
    const spurious = rows.filter(r => r.title !== 'Castle Rackrent')
    const hasEdgeworth = rows.some(r => r.title === 'Castle Rackrent')

    if (spurious.length === 0 && hasEdgeworth) {
      pass++
      console.log(`  PASS  Only Castle Rackrent has publication_year=1800`)
    } else {
      fail++
      if (!hasEdgeworth) {
        console.log(`  FAIL  Castle Rackrent not found with publication_year=1800`)
      }
      if (spurious.length > 0) {
        console.log(`  FAIL  ${spurious.length} unexpected 1800 book(s):`)
        for (const r of spurious) {
          console.log(`        slug=${r.slug}  title="${r.title}"`)
        }
      }
    }
  } catch (e) {
    fail++
    console.log(`  FAIL  1800-year query: ${(e as Error).message}`)
  }

  // FTS smoke test
  console.log('\nFTS smoke test:')
  try {
    const res = d1Query("SELECT COUNT(*) AS n FROM books_fts WHERE books_fts MATCH 'pride'")
    const n = res[0]?.results[0]?.n as number
    const ok = n > 0
    ok ? pass++ : fail++
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  books_fts MATCH 'pride': ${n} result(s)`)
  } catch (e) {
    fail++
    console.log(`  FAIL  books_fts query: ${(e as Error).message}`)
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) {
    console.error('\nReview failures above before proceeding.')
    process.exit(1)
  }
}

main().catch(err => { console.error(err); process.exit(1) })

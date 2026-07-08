// Stage 0: probe the live Postgres schema and row counts for all source tables.
// Answers the four pre-transform uncertainties and writes reports/probe-report.json.
//
// Run: pnpm tsx scripts/import-catalog/stage0-probe.ts
// Requires SUPABASE_DB_URL in apps/web-cf/.dev.vars

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPool } from './pg.ts'

const SOURCE_TABLES = [
  'books',
  'book_awards',
  'external_book_clubs',
  'external_book_club_picks',
  'book_of_the_month',
  'journal_posts',
  'journal_post_versions',
  'journal_post_links',
] as const

type TableName = (typeof SOURCE_TABLES)[number]

interface ColInfo {
  column_name: string
  data_type: string
  is_nullable: string
}

async function main() {
  const pool = createPool()

  console.log('Stage 0: schema probe')
  await pool.query('SELECT 1')
  console.log('Connected to Postgres.\n')

  // Column map from information_schema
  const { rows: rawCols } = await pool.query<ColInfo & { table_name: string }>(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
    ORDER BY table_name, ordinal_position
  `, [SOURCE_TABLES])

  const colMap: Record<string, ColInfo[]> = {}
  for (const row of rawCols) {
    const { table_name, ...col } = row
    if (!colMap[table_name]) colMap[table_name] = []
    colMap[table_name].push(col)
  }

  // Row counts for each table
  const counts: Record<string, number> = {}
  for (const t of SOURCE_TABLES) {
    if (!colMap[t]) {
      counts[t] = -1
      continue
    }
    const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM "${t}"`)
    counts[t] = Number(rows[0]!.n)
  }

  // Sample BOTM affiliate URLs (U3)
  type UrlSample = { amazon_url: string | null; bookshop_url: string | null }
  let botmUrlSamples: UrlSample[] = []
  if (colMap['book_of_the_month']) {
    const hasCols = colMap['book_of_the_month'].map(c => c.column_name)
    if (hasCols.includes('amazon_url') || hasCols.includes('bookshop_url')) {
      const { rows } = await pool.query<UrlSample>(`
        SELECT amazon_url, bookshop_url
        FROM book_of_the_month
        WHERE amazon_url IS NOT NULL OR bookshop_url IS NOT NULL
        LIMIT 5
      `)
      botmUrlSamples = rows
    }
  }

  await pool.end()

  // Print column map
  console.log('=== COLUMN MAP ===\n')
  for (const t of SOURCE_TABLES) {
    const cols = colMap[t]
    if (!cols) {
      console.log(`${t}: TABLE DOES NOT EXIST\n`)
      continue
    }
    console.log(`${t}  (${counts[t]} rows)`)
    for (const c of cols) {
      const nullMark = c.is_nullable === 'YES' ? '?' : '!'
      console.log(`  ${c.column_name}${nullMark}  ${c.data_type}`)
    }
    console.log()
  }

  // Print uncertainty answers
  console.log('=== UNCERTAINTY ANSWERS ===\n')

  const jplCols = colMap['journal_post_links']
  console.log('U1 journal_post_links columns:')
  if (!jplCols) {
    console.log('  TABLE DOES NOT EXIST')
  } else {
    for (const c of jplCols) console.log(`  ${c.column_name}: ${c.data_type}`)
  }
  console.log()

  const acCol = colMap['external_book_club_picks']?.find(
    c => c.column_name === 'auto_confidence',
  )
  console.log(`U2 auto_confidence data_type: ${acCol?.data_type ?? 'COLUMN NOT FOUND'}`)
  console.log()

  console.log('U3 book_of_the_month amazon_url / bookshop_url samples:')
  if (botmUrlSamples.length === 0) {
    console.log('  (no rows or no url columns found)')
  } else {
    for (const s of botmUrlSamples) {
      if (s.amazon_url)   console.log(`  amazon_url:   ${s.amazon_url}`)
      if (s.bookshop_url) console.log(`  bookshop_url: ${s.bookshop_url}`)
    }
  }
  console.log()

  console.log('U4 row counts for journal / BOTM:')
  console.log(`  journal_posts:         ${counts['journal_posts']}`)
  console.log(`  journal_post_versions: ${counts['journal_post_versions']}`)
  console.log(`  book_of_the_month:     ${counts['book_of_the_month']}`)
  console.log()

  // Save JSON report
  const reportsDir = resolve(process.cwd(), 'scripts/import-catalog/reports')
  mkdirSync(reportsDir, { recursive: true })
  const outPath = resolve(reportsDir, 'probe-report.json')
  writeFileSync(
    outPath,
    JSON.stringify({ colMap, counts, botmUrlSamples }, null, 2),
    'utf-8',
  )
  console.log(`Report saved -> ${outPath}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

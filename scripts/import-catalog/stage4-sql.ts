// Stage 4: Generate chunked INSERT OR REPLACE SQL files from the enriched data.
// Reads enriched-years.json if present, otherwise extracted.json.
// Writes to scripts/import-catalog/sql/ (gitignored).
// Run: pnpm tsx scripts/import-catalog/stage4-sql.ts

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ExtractedData } from './types.ts'
import { writeChunked } from './sql-writer.ts'

const REPORTS_DIR = resolve(process.cwd(), 'scripts/import-catalog/reports')
const SQL_DIR = resolve(process.cwd(), 'scripts/import-catalog/sql')

function findInput(): string {
  const enriched = resolve(REPORTS_DIR, 'enriched-years.json')
  if (existsSync(enriched)) {
    console.log('Input: enriched-years.json (stage2 output)')
    return enriched
  }
  const extracted = resolve(REPORTS_DIR, 'extracted.json')
  if (existsSync(extracted)) {
    console.log('Input: extracted.json (stage1 output -- no year enrichment)')
    return extracted
  }
  console.error('No input found. Run stage1 first: pnpm tsx scripts/import-catalog/stage1-extract.ts')
  process.exit(1)
}

async function main() {
  const inputPath = findInput()
  const data: ExtractedData = JSON.parse(readFileSync(inputPath, 'utf-8'))

  console.log(`\nStage 4: SQL generation`)
  console.log(`Output: ${SQL_DIR}\n`)

  const allFiles: string[] = []

  // Insert order: books first (FK parent), then dependents
  allFiles.push(...writeChunked('books',                    data.books,               SQL_DIR, '01-books', 100))
  allFiles.push(...writeChunked('book_awards',              data.bookAwards,          SQL_DIR, '02-book-awards', 500))
  allFiles.push(...writeChunked('external_book_clubs',      data.externalBookClubs,   SQL_DIR, '03-external-book-clubs', 500))
  allFiles.push(...writeChunked('external_book_club_picks', data.externalBookClubPicks, SQL_DIR, '04-external-book-club-picks', 200))
  allFiles.push(...writeChunked('book_of_the_month',        data.bookOfTheMonth,      SQL_DIR, '05-book-of-the-month', 500))
  allFiles.push(...writeChunked('journal_posts',            data.journalPosts,        SQL_DIR, '06-journal-posts', 1))
  allFiles.push(...writeChunked('journal_post_versions',    data.journalPostVersions, SQL_DIR, '07-journal-post-versions', 500))

  console.log(`\nTotal: ${allFiles.length} SQL file(s) written`)
  console.log('Run stage5 next: pnpm tsx scripts/import-catalog/stage5-apply.ts')
}

main().catch(err => { console.error(err); process.exit(1) })

// Stage 1: Extract all source tables from Postgres, transform to D1-ready rows,
// save to reports/extracted.json.
// Run: pnpm tsx scripts/import-catalog/stage1-extract.ts
// Requires SUPABASE_DB_URL in apps/web/.dev.vars

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPool } from './pg.ts'
import type {
  PgBook, PgBookAward, PgExternalBookClub, PgExternalBookClubPick,
  PgBookOfTheMonth, PgJournalPost, PgJournalPostVersion, PgJournalPostLink,
  ExtractedData,
} from './types.ts'
import {
  transformBook, transformBookAward, transformExternalBookClub,
  transformExternalBookClubPick, transformBookOfTheMonth,
  transformJournalPost, transformJournalPostVersion,
} from './transform.ts'

async function main() {
  const pool = createPool()
  console.log('Stage 1: extract + transform')
  await pool.query('SELECT 1')
  console.log('Connected.\n')

  const [
    books,
    bookAwards,
    clubs,
    picks,
    botm,
    posts,
    versions,
    links,
  ] = await Promise.all([
    pool.query<PgBook>('SELECT * FROM books ORDER BY created_at'),
    pool.query<PgBookAward>('SELECT * FROM book_awards ORDER BY created_at'),
    pool.query<PgExternalBookClub>('SELECT * FROM external_book_clubs ORDER BY sort_order, created_at'),
    pool.query<PgExternalBookClubPick>('SELECT * FROM external_book_club_picks ORDER BY created_at'),
    pool.query<PgBookOfTheMonth>('SELECT * FROM book_of_the_month ORDER BY year, month'),
    pool.query<PgJournalPost>('SELECT * FROM journal_posts ORDER BY created_at'),
    pool.query<PgJournalPostVersion>('SELECT * FROM journal_post_versions ORDER BY saved_at'),
    pool.query<PgJournalPostLink>('SELECT * FROM journal_post_links ORDER BY position'),
  ])

  await pool.end()

  console.log('Fetched from Postgres:')
  console.log(`  books:                    ${books.rows.length}`)
  console.log(`  book_awards:              ${bookAwards.rows.length}`)
  console.log(`  external_book_clubs:      ${clubs.rows.length}`)
  console.log(`  external_book_club_picks: ${picks.rows.length}`)
  console.log(`  book_of_the_month:        ${botm.rows.length}`)
  console.log(`  journal_posts:            ${posts.rows.length}`)
  console.log(`  journal_post_versions:    ${versions.rows.length}`)
  console.log(`  journal_post_links:       ${links.rows.length}\n`)

  // Build related_post_ids map from journal_post_links (0 rows expected)
  const relatedMap = new Map<string, string[]>()
  for (const link of links.rows) {
    const arr = relatedMap.get(link.source_id) ?? []
    arr.push(link.target_id)
    relatedMap.set(link.source_id, arr)
  }

  console.log('Transforming...')
  const data: ExtractedData = {
    extractedAt: new Date().toISOString(),
    counts: {
      books: books.rows.length,
      bookAwards: bookAwards.rows.length,
      externalBookClubs: clubs.rows.length,
      externalBookClubPicks: picks.rows.length,
      bookOfTheMonth: botm.rows.length,
      journalPosts: posts.rows.length,
      journalPostVersions: versions.rows.length,
    },
    books: books.rows.map(r => transformBook(r)),
    bookAwards: bookAwards.rows.map(r => transformBookAward(r)),
    externalBookClubs: clubs.rows.map(r => transformExternalBookClub(r)),
    externalBookClubPicks: picks.rows.map(r => transformExternalBookClubPick(r)),
    bookOfTheMonth: botm.rows.map(r => transformBookOfTheMonth(r)),
    journalPosts: posts.rows.map(r =>
      transformJournalPost(r, relatedMap.get(r.id) ?? [])
    ),
    journalPostVersions: versions.rows.map(r => transformJournalPostVersion(r)),
  }

  const reportsDir = resolve(process.cwd(), 'scripts/import-catalog/reports')
  mkdirSync(reportsDir, { recursive: true })
  const outPath = resolve(reportsDir, 'extracted.json')
  writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8')

  const nullCoverCommunity = data.books.filter(
    b => b.source_type === 'community' && b.cover_url === null
  ).length
  const nullYearCatalog = data.books.filter(
    b => b.source_type === 'catalog' && b.publication_year === null
  ).length

  console.log('\nTransform notes:')
  console.log(`  catalog books missing publication_year: ${nullYearCatalog}`)
  console.log(`  community books missing cover_url:      ${nullCoverCommunity}`)
  console.log(`\nSaved -> ${outPath}`)
  console.log('Run stage2 next: pnpm tsx scripts/import-catalog/stage2-enrich-years.ts')
}

main().catch(err => { console.error(err); process.exit(1) })

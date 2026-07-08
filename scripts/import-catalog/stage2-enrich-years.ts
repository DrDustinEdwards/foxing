// Stage 2: Fill in publication_year for catalog books that are missing it or
// have the 1800 placeholder (known OL data quality issue, June 2026).
// Uses Google Books API (no key required for low-volume lookups).
// Open Library's first_publish_year field is NOT used -- it is the source of
// the 1800 placeholder problem.
//
// Scope (source_type='catalog' ONLY -- community books are NEVER touched):
//   - publication_year IS NULL
//   - publication_year = 1800  (placeholder, treat as missing)
//
// Rules:
//   - Only write a year if confidence is HIGH (single exact ISBN match, or
//     unambiguous title+author match returning one result).
//   - Never write 1800 (reject it even if that's what Google Books returns).
//   - Log every change and every skip with the original value.
//
// Run: pnpm tsx scripts/import-catalog/stage2-enrich-years.ts

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ExtractedData } from './types.ts'

const REPORTS_DIR = resolve(process.cwd(), 'scripts/import-catalog/reports')
const INPUT = resolve(REPORTS_DIR, 'extracted.json')
const OUTPUT = resolve(REPORTS_DIR, 'enriched-years.json')

async function lookupYear(
  isbn13: string | null,
  title: string,
  author: string,
): Promise<{ year: number; source: string } | null> {
  if (isbn13) {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}&maxResults=1`
    try {
      const res = await fetch(url)
      if (res.ok) {
        const body = await res.json() as {
          totalItems?: number
          items?: Array<{ volumeInfo?: { publishedDate?: string } }>
        }
        const dateStr = body.items?.[0]?.volumeInfo?.publishedDate
        if (dateStr) {
          const year = parseInt(dateStr.slice(0, 4), 10)
          if (year >= 1001 && year <= 2030 && year !== 1800) {
            return { year, source: `isbn:${isbn13}` }
          }
          if (year === 1800) return null  // 1800 placeholder -- reject
        }
      }
    } catch { /* fall through to title+author */ }
  }

  // Title+author fallback: only accept when totalItems === 1 (unambiguous)
  const q = `intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(author)}`
  const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const body = await res.json() as {
      totalItems?: number
      items?: Array<{ volumeInfo?: { publishedDate?: string } }>
    }
    if ((body.totalItems ?? 0) !== 1) return null  // ambiguous -- skip
    const dateStr = body.items?.[0]?.volumeInfo?.publishedDate
    if (!dateStr) return null
    const year = parseInt(dateStr.slice(0, 4), 10)
    if (year >= 1001 && year <= 2030 && year !== 1800) {
      return { year, source: 'title+author (1 result)' }
    }
  } catch { /* network error */ }
  return null
}

async function main() {
  if (!existsSync(INPUT)) {
    console.error(`Input not found: ${INPUT}`)
    console.error('Run stage1 first: pnpm tsx scripts/import-catalog/stage1-extract.ts')
    process.exit(1)
  }

  const data: ExtractedData = JSON.parse(readFileSync(INPUT, 'utf-8'))

  // Scope: catalog books with null OR 1800 publication_year ONLY
  const needsYear = data.books.filter(
    b => b.source_type === 'catalog' &&
         (b.publication_year === null || b.publication_year === 1800)
  )

  const communitySkipped = data.books.filter(b => b.source_type !== 'catalog').length

  console.log('Stage 2: year enrichment (catalog only)')
  console.log(`  Total books:                  ${data.books.length}`)
  console.log(`  Community books (untouched):  ${communitySkipped}`)
  console.log(`  Catalog null year:            ${needsYear.filter(b => b.publication_year === null).length}`)
  console.log(`  Catalog 1800 placeholder:     ${needsYear.filter(b => b.publication_year === 1800).length}`)
  console.log(`  Total to enrich:              ${needsYear.length}\n`)

  if (needsYear.length === 0) {
    console.log('Nothing to enrich. Copying input to output.')
    writeFileSync(OUTPUT, JSON.stringify(data, null, 2), 'utf-8')
    console.log(`Saved -> ${OUTPUT}`)
    console.log('Run stage4: pnpm tsx scripts/import-catalog/stage4-sql.ts')
    return
  }

  const bookIndex = new Map(data.books.map((b, i) => [b.id as string, i]))
  let enriched = 0
  let skipped = 0

  for (let i = 0; i < needsYear.length; i++) {
    const book = needsYear[i]!
    const progress = `[${i + 1}/${needsYear.length}]`
    const wasYear = book.publication_year ?? 'null'
    const result = await lookupYear(
      book.isbn13 as string | null,
      book.title as string,
      book.author as string,
    )
    if (result !== null) {
      const idx = bookIndex.get(book.id as string)!
      data.books[idx]!.publication_year = result.year
      enriched++
      console.log(`${progress} ENRICHED  "${book.title}" (was: ${wasYear}) -> ${result.year}  [${result.source}]`)
    } else {
      skipped++
      console.log(`${progress} SKIP      "${book.title}" (was: ${wasYear}) -- no confident match`)
    }
    // 120ms between requests to stay under Google Books rate limits
    if (i < needsYear.length - 1) await new Promise(r => setTimeout(r, 120))
  }

  console.log(`\nEnriched: ${enriched}  Skipped: ${skipped}`)
  writeFileSync(OUTPUT, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`Saved -> ${OUTPUT}`)
  console.log('Run stage4 next: pnpm tsx scripts/import-catalog/stage4-sql.ts')
}

main().catch(err => { console.error(err); process.exit(1) })

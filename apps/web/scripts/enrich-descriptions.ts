// Run with: pnpm --filter web enrich-descriptions
// (or: cd apps/web && npx tsx scripts/enrich-descriptions.ts)
//
// Reads the Standard Ebooks OPDS catalog and copies each entry's
// short summary into the Foxing books.description column when the
// row currently has no description.
//
// Expects NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// the environment. Pull them with `vercel env pull .env.local`.

import { XMLParser } from 'fast-xml-parser'
import { createClient } from '@supabase/supabase-js'

interface OpdsEntry {
  title?: string | { '#text': string }
  summary?: string | { '#text': string }
}

interface BookRow {
  id: string
  title: string
  description: string | null
}

function readText(value: string | { '#text': string } | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value['#text'] ?? ''
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanDescription(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.',
    )
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('Fetching Standard Ebooks OPDS catalog...')
  const res = await fetch('https://standardebooks.org/feeds/opds/all', {
    headers: { 'User-Agent': 'Foxing/1.0 (https://foxing.app)' },
  })
  if (!res.ok) {
    throw new Error(`OPDS fetch failed: ${res.status} ${res.statusText}`)
  }
  const xml = await res.text()

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['entry', 'category', 'author', 'link'].includes(name),
  })
  const feed = parser.parse(xml) as { feed?: { entry?: OpdsEntry[] } }
  const entries = feed.feed?.entry ?? []
  console.log(`Parsed ${entries.length} OPDS entries.`)

  const { data, error } = await supabase
    .from('books')
    .select('id, title, description')
    .eq('source', 'standard_ebooks')
    .is('description', null)
  if (error) throw error
  const books = (data as BookRow[] | null) ?? []
  console.log(`Books needing descriptions: ${books.length}`)

  const byNormalizedTitle = new Map<string, BookRow>()
  for (const b of books) {
    byNormalizedTitle.set(normalizeTitle(b.title), b)
  }

  let updated = 0
  let skipped = 0

  for (const entry of entries) {
    const summaryRaw = readText(entry.summary)
    if (!summaryRaw || summaryRaw.length < 20) continue
    const description = cleanDescription(summaryRaw)
    if (description.length < 20) continue

    const entryTitle = normalizeTitle(readText(entry.title))
    if (!entryTitle) continue

    let match = byNormalizedTitle.get(entryTitle)
    if (!match) {
      for (const [normalized, candidate] of byNormalizedTitle.entries()) {
        if (
          normalized.startsWith(entryTitle.slice(0, 20)) ||
          entryTitle.startsWith(normalized.slice(0, 20))
        ) {
          match = candidate
          break
        }
      }
    }
    if (!match) {
      skipped++
      continue
    }

    const { error: updateError } = await supabase
      .from('books')
      .update({ description })
      .eq('id', match.id)
    if (updateError) {
      console.error(`Failed to update ${match.title}: ${updateError.message}`)
      continue
    }
    console.log(`Updated: ${match.title}`)
    byNormalizedTitle.delete(normalizeTitle(match.title))
    updated++
  }

  console.log(`\nDone. Updated ${updated}, skipped ${skipped}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

// Run with: pnpm --filter web enrich-themes
// (or: cd apps/web && npx tsx scripts/enrich-themes.ts)
//
// Reads the Standard Ebooks OPDS catalog, maps each book's subject
// categories onto Foxing's theme vocabulary, and updates the themes
// column for every Standard Ebooks book we already have in Supabase.
//
// Expects NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// the environment. Pull them with `vercel env pull .env.local`.

import { XMLParser } from 'fast-xml-parser'
import { createClient } from '@supabase/supabase-js'

const SUBJECT_MAP: Record<string, string[]> = {
  'adventure stories': ['adventurous'],
  'adventure fiction': ['adventurous'],
  'sea stories': ['adventurous'],
  'western stories': ['adventurous'],
  'travel fiction': ['adventurous'],
  'gothic fiction': ['dark', 'mysterious'],
  'horror tales': ['dark', 'tense'],
  'ghost stories': ['dark', 'mysterious'],
  'detective and mystery stories': ['mysterious', 'tense'],
  'mystery fiction': ['mysterious', 'tense'],
  'crime fiction': ['mysterious', 'tense'],
  'spy stories': ['tense', 'mysterious'],
  'war stories': ['tense', 'emotional'],
  'thriller fiction': ['tense'],
  'science fiction': ['tense', 'adventurous'],
  'dystopian fiction': ['tense', 'emotional'],
  'love stories': ['romantic', 'emotional'],
  'romance fiction': ['romantic'],
  'historical romance': ['romantic', 'reflective'],
  'humorous stories': ['funny', 'lighthearted'],
  satire: ['funny', 'reflective'],
  comedy: ['funny', 'lighthearted'],
  "children's fiction": ['lighthearted'],
  'fairy tales': ['lighthearted', 'hopeful'],
  fables: ['lighthearted', 'reflective'],
  'fantasy fiction': ['lighthearted', 'adventurous'],
  'coming-of-age stories': ['hopeful', 'emotional'],
  bildungsromans: ['hopeful', 'emotional', 'reflective'],
  'redemption stories': ['hopeful', 'emotional'],
  'philosophical fiction': ['reflective'],
  essays: ['reflective'],
  autobiography: ['reflective', 'emotional'],
  biography: ['reflective'],
  memoir: ['reflective', 'emotional'],
  'historical fiction': ['reflective'],
  'political fiction': ['reflective', 'tense'],
  'social fiction': ['reflective', 'emotional'],
  'psychological fiction': ['emotional', 'reflective'],
  tragedy: ['emotional', 'dark'],
  drama: ['emotional'],
}

interface OpdsCategory {
  '@_term'?: string
  '@_label'?: string
}

interface OpdsEntry {
  title?: string | { '#text': string }
  category?: OpdsCategory[] | OpdsCategory
}

interface BookRow {
  id: string
  title: string
  author: string
  themes: string[] | null
}

function subjectToThemes(subject: string): string[] {
  const normalized = subject.toLowerCase().trim()
  for (const [key, themes] of Object.entries(SUBJECT_MAP)) {
    if (normalized.includes(key)) return themes
  }
  return []
}

function readTitle(entry: OpdsEntry): string {
  const t = entry.title
  if (!t) return ''
  if (typeof t === 'string') return t
  return t['#text'] ?? ''
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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
  const feed = parser.parse(xml) as {
    feed?: { entry?: OpdsEntry[] }
  }
  const entries = feed.feed?.entry ?? []
  console.log(`Parsed ${entries.length} OPDS entries.`)

  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, themes')
    .eq('source', 'standard_ebooks')
  if (error) throw error
  const books = (data as BookRow[] | null) ?? []
  console.log(`Loaded ${books.length} Standard Ebooks books from Supabase.`)

  const byNormalizedTitle = new Map<string, BookRow>()
  for (const b of books) {
    byNormalizedTitle.set(normalizeTitle(b.title), b)
  }

  let updated = 0
  let skipped = 0
  let unchanged = 0

  for (const entry of entries) {
    const cats = Array.isArray(entry.category)
      ? entry.category
      : entry.category
        ? [entry.category]
        : []
    const subjects = cats
      .map((c) => c['@_term'] ?? c['@_label'] ?? '')
      .filter(Boolean)
    if (subjects.length === 0) continue

    const themes = new Set<string>()
    for (const subject of subjects) {
      for (const t of subjectToThemes(subject)) themes.add(t)
    }
    if (themes.size === 0) continue
    const themeList = [...themes].sort()

    const entryTitle = normalizeTitle(readTitle(entry))
    if (!entryTitle) continue

    let match = byNormalizedTitle.get(entryTitle)
    if (!match) {
      // Loose prefix match for edition title differences.
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

    const current = (match.themes ?? []).slice().sort()
    if (
      current.length === themeList.length &&
      current.every((v, i) => v === themeList[i])
    ) {
      unchanged++
      continue
    }

    const { error: updateError } = await supabase
      .from('books')
      .update({ themes: themeList })
      .eq('id', match.id)
    if (updateError) {
      console.error(`Failed to update ${match.title}: ${updateError.message}`)
      continue
    }
    console.log(`Updated: ${match.title} -> ${themeList.join(', ')}`)
    updated++
  }

  console.log(`\nDone. Updated ${updated}, unchanged ${unchanged}, skipped ${skipped}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

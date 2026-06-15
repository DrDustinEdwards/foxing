import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveBook } from '@/lib/enrich/resolver'

/**
 * One-time catalog enrichment backfill, run inside Vercel (no shell). Fills
 * publication_year + subjects (genre) for source_type='catalog' books using the
 * approved resolver (Open Library first, Google Books fallback). Authed with the
 * shared CRON_SECRET bearer, fail-closed, same as the cron routes -- but it is
 * NOT scheduled; trigger it manually until `remaining` reaches 0.
 *
 * Chunked + resumable: each call processes `limit` books after `cursor` (the
 * last book id), so it fits the function timeout. Idempotent: writes only
 * missing fields, so re-running is safe. Returns flagged rows (reprint / anomaly
 * / generic) in the JSON so they can be reviewed without a log file.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const NEEDS_FILTER = 'publication_year.is.null,subjects.is.null'
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200
const DELAY_MS = 300 // gentle with Open Library
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface BookRow {
  id: string
  title: string
  author: string
  publication_year: number | null
  subjects: string[] | null
}

function emptySubjects(s: unknown[] | null): boolean {
  return !Array.isArray(s) || s.length === 0
}

async function handle(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sp = request.nextUrl.searchParams
  const cursor = sp.get('cursor') ?? ''
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(sp.get('limit')) || DEFAULT_LIMIT),
  )
  const googleKey = process.env.GOOGLE_BOOKS_API_KEY ?? null

  const admin = createAdminClient()

  // Next batch of catalog books still missing a field, after the cursor id.
  let q = admin
    .from('books')
    .select('id, title, author, publication_year, subjects')
    .eq('source_type', 'catalog')
    .or(NEEDS_FILTER)
    .order('id', { ascending: true })
    .limit(limit)
  if (cursor) q = q.gt('id', cursor)
  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: 'fetch_failed', detail: error.message }, { status: 500 })
  }
  const books = (data as BookRow[] | null) ?? []

  const stats = {
    processed: 0,
    yearResolved: 0,
    genreResolved: 0,
    unresolved: 0,
    flagged: 0,
    googleUsed: 0,
  }
  const flaggedRows: Array<{
    id: string
    title: string
    author: string
    year: number | null
    source: string | null
    genres: string[]
    flags: string[]
    matched: string
  }> = []
  let lastId = cursor

  for (const b of books) {
    const r = await resolveBook({ title: b.title, author: b.author }, { googleKey })
    stats.processed++
    lastId = b.id
    if (r.source === 'googlebooks') stats.googleUsed++
    if (r.source === null) stats.unresolved++

    // Derived review flag: catalog books are public-domain classics, so a modern
    // year is almost certainly a reprint/wrong edition. Surfaced for review only.
    const flags = [...r.flags]
    if (r.year != null && r.year >= 1930) flags.push('suspect-modern-year')

    const update: { publication_year?: number; subjects?: string[] } = {}
    if (b.publication_year == null && r.year != null) update.publication_year = r.year
    if (emptySubjects(b.subjects) && r.genres.length) update.subjects = r.genres

    if (Object.keys(update).length) {
      const { error: upErr } = await admin.from('books').update(update).eq('id', b.id)
      if (upErr) {
        flaggedRows.push({
          id: b.id, title: b.title, author: b.author, year: r.year,
          source: r.source, genres: r.genres, flags: [...flags, 'write-failed'], matched: r.matched,
        })
        stats.flagged++
        await sleep(DELAY_MS)
        continue
      }
      if ('publication_year' in update) stats.yearResolved++
      if ('subjects' in update) stats.genreResolved++
    }

    if (flags.length) {
      stats.flagged++
      flaggedRows.push({
        id: b.id, title: b.title, author: b.author, year: r.year,
        source: r.source, genres: r.genres, flags, matched: r.matched,
      })
    }
    await sleep(DELAY_MS)
  }

  // Remaining still-needing catalog books after the new cursor.
  let remaining = 0
  if (lastId) {
    const { count } = await admin
      .from('books')
      .select('id', { count: 'exact', head: true })
      .eq('source_type', 'catalog')
      .or(NEEDS_FILTER)
      .gt('id', lastId)
    remaining = count ?? 0
  }

  return NextResponse.json(
    {
      ok: true,
      ...stats,
      remaining,
      cursor: lastId,
      done: books.length === 0,
      googleEnabled: Boolean(googleKey),
      flaggedRows,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function GET(request: NextRequest) {
  return handle(request)
}
export async function POST(request: NextRequest) {
  return handle(request)
}

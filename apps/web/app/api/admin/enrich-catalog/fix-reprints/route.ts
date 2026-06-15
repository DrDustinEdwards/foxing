import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveBook } from '@/lib/enrich/resolver'

/**
 * Targeted remediation for reprint-contaminated catalog years. The backfill's
 * Google fallback wrote modern Standard-Ebooks EDITION years for some classics.
 * The 2000+ rows were already nulled; this fixes ONLY catalog books with
 * publication_year in [1930, 1999].
 *
 * For each, re-resolve OL-first (earliest credible original year, NOT an edition
 * year -- Google is deliberately disabled here since it was the contaminator):
 *   - resolved < stored                       -> overwrite with the earlier year
 *   - resolved == stored AND high-confidence  -> keep (genuinely correct, e.g.
 *     Right Ho Jeeves 1934, exact OL work match)
 *   - otherwise                               -> set publication_year = NULL
 *     (better empty than a reprint year on a public-domain classic)
 *
 * Never touches <= 1929 or subjects. Idempotent. Authed like the cron routes.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const DEFAULT_LIMIT = 120
const MAX_LIMIT = 200
const DELAY_MS = 300
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface BookRow {
  id: string
  title: string
  author: string
  publication_year: number
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
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get('limit')) || DEFAULT_LIMIT))

  const admin = createAdminClient()
  let q = admin
    .from('books')
    .select('id, title, author, publication_year')
    .eq('source_type', 'catalog')
    .gte('publication_year', 1930)
    .lte('publication_year', 1999)
    .order('id', { ascending: true })
    .limit(limit)
  if (cursor) q = q.gt('id', cursor)
  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: 'fetch_failed', detail: error.message }, { status: 500 })
  }
  const books = (data as BookRow[] | null) ?? []

  const stats = { processed: 0, overwritten: 0, nulled: 0, kept: 0 }
  const changes: Array<{
    title: string
    author: string
    old: number
    new: number | null
    action: 'overwrite' | 'null' | 'keep'
    resolved: number | null
    confidence: string
    matched: string
  }> = []
  let lastId = cursor

  for (const b of books) {
    stats.processed++
    lastId = b.id
    const stored = b.publication_year
    // OL-only re-resolution (Google was the reprint contaminator).
    const r = await resolveBook({ title: b.title, author: b.author }, { googleKey: null })

    let action: 'overwrite' | 'null' | 'keep'
    let newYear: number | null
    if (r.year != null && r.year < stored) {
      action = 'overwrite'
      newYear = r.year
    } else if (r.year != null && r.year === stored && r.confidence === 'high') {
      action = 'keep'
      newYear = stored
    } else {
      action = 'null'
      newYear = null
    }

    if (action !== 'keep') {
      const { error: upErr } = await admin
        .from('books')
        .update({ publication_year: newYear })
        .eq('id', b.id)
      if (upErr) {
        changes.push({
          title: b.title, author: b.author, old: stored, new: newYear,
          action, resolved: r.year, confidence: `${r.confidence} (WRITE FAILED: ${upErr.message})`, matched: r.matched,
        })
        await sleep(DELAY_MS)
        continue
      }
      if (action === 'overwrite') stats.overwritten++
      else stats.nulled++
      changes.push({
        title: b.title, author: b.author, old: stored, new: newYear,
        action, resolved: r.year, confidence: r.confidence, matched: r.matched,
      })
    } else {
      stats.kept++
    }
    await sleep(DELAY_MS)
  }

  let remaining = 0
  if (lastId) {
    const { count } = await admin
      .from('books')
      .select('id', { count: 'exact', head: true })
      .eq('source_type', 'catalog')
      .gte('publication_year', 1930)
      .lte('publication_year', 1999)
      .gt('id', lastId)
    remaining = count ?? 0
  }

  return NextResponse.json(
    { ok: true, ...stats, remaining, cursor: lastId, done: books.length === 0, changes },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function GET(request: NextRequest) {
  return handle(request)
}
export async function POST(request: NextRequest) {
  return handle(request)
}

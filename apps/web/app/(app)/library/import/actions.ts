'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { checkAndAwardBadges } from '@/lib/badges'
import { reportWriteError } from '@/lib/db-write'

export interface GoodreadsRow {
  title: string
  author: string
  isbn: string | null
  isbn13: string | null
  rating: number | null
  review: string | null
  date_finished: string | null
  date_added: string | null
  shelf: string
}

// Goodreads "Exclusive Shelf" -> user_books.status. Verified against the live
// user_books_status_check (want_to_read | reading | finished | abandoned |
// paused); unknown shelves fall back to want_to_read.
const SHELF_TO_STATUS: Record<string, string> = {
  read: 'finished',
  'currently-reading': 'reading',
  'to-read': 'want_to_read',
}

function shelfToStatus(shelf: string): string {
  return SHELF_TO_STATUS[shelf.trim().toLowerCase()] ?? 'want_to_read'
}

// Goodreads ISBN cells look like ="9780123456789"; strip everything but the
// ISBN characters and keep only well-formed ISBN-10/13.
function normalizeIsbn(raw: string | null): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/[^0-9Xx]/g, '').toUpperCase()
  return cleaned.length === 10 || cleaned.length === 13 ? cleaned : null
}

type Sb = Awaited<ReturnType<typeof createClient>>

interface PreparedRow {
  book_id: string
  status: string
  rating: number | null
  rating_half: number | null
  review: string | null
  review_is_public: boolean
  finished_at: string | null
  date_finished: string | null
  created_at?: string
}

interface MatchOutcome {
  prepared: Map<string, PreparedRow>
  matched: number
  unmatched: { title: string; author: string }[]
}

// Match each CSV row to a catalog book: ISBN13/ISBN first, then a case-
// insensitive title match with an author overlap check. Returns prepared
// user_books rows (deduped by book_id, last write wins) without user_id, so the
// same logic backs both the dry-run preview and the write.
async function buildMatches(
  sb: Sb,
  rows: GoodreadsRow[],
): Promise<MatchOutcome> {
  type CatalogBook = {
    id: string
    title: string
    author: string
    isbn: string | null
    isbn13: string | null
  }
  // Load the catalog once, paging past PostgREST's 1000-row cap.
  const catalog: CatalogBook[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from('books')
      .select('id, title, author, isbn, isbn13')
      .range(from, from + 999)
    const page = (data as CatalogBook[] | null) ?? []
    catalog.push(...page)
    if (page.length < 1000) break
  }

  const byTitle = new Map<string, { id: string; authorLower: string }[]>()
  const byIsbn = new Map<string, string>()
  for (const b of catalog) {
    if (b.title) {
      const key = b.title.toLowerCase()
      const entry = { id: b.id, authorLower: (b.author ?? '').toLowerCase() }
      const list = byTitle.get(key)
      if (list) list.push(entry)
      else byTitle.set(key, [entry])
    }
    for (const code of [b.isbn, b.isbn13]) {
      const c = normalizeIsbn(code)
      if (c && !byIsbn.has(c)) byIsbn.set(c, b.id)
    }
  }

  const prepared = new Map<string, PreparedRow>()
  let matched = 0
  const unmatched: { title: string; author: string }[] = []
  // Cap a single import at 500 rows to stay within the action's time budget.
  for (const row of rows.slice(0, 500)) {
    const title = row.title?.trim()
    const author = row.author?.trim()
    if (!title || !author) continue

    let bookId: string | undefined
    const isbn13 = normalizeIsbn(row.isbn13)
    const isbn = normalizeIsbn(row.isbn)
    if (isbn13) bookId = byIsbn.get(isbn13)
    if (!bookId && isbn) bookId = byIsbn.get(isbn)
    if (!bookId) {
      const authorLower = author.toLowerCase()
      const candidates = byTitle.get(title.toLowerCase())
      const m = candidates?.find(
        (c) =>
          c.authorLower.includes(authorLower) ||
          authorLower.includes(c.authorLower),
      )
      bookId = m?.id
    }
    if (!bookId) {
      unmatched.push({ title, author })
      continue
    }

    matched += 1
    const pr: PreparedRow = {
      book_id: bookId,
      status: shelfToStatus(row.shelf),
      rating: row.rating,
      rating_half: row.rating ? row.rating * 2 : null,
      review: row.review?.trim() || null,
      review_is_public: false,
      finished_at: row.date_finished,
      date_finished: row.date_finished,
    }
    if (row.date_added) pr.created_at = row.date_added
    prepared.set(bookId, pr)
  }

  return { prepared, matched, unmatched }
}

export interface ImportMatchResult {
  ok: true
  matched: number
  unmatched: { title: string; author: string }[]
}

// Dry run: report what would match, so the user reviews before any write.
export async function matchGoodreadsRows(
  rows: GoodreadsRow[],
): Promise<ImportMatchResult | { ok: false; error: string }> {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }
  const { matched, unmatched } = await buildMatches(sb, rows)
  return { ok: true, matched, unmatched }
}

export async function importGoodreadsRows(rows: GoodreadsRow[]) {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false as const, error: 'unauthenticated' }

  const { prepared, matched, unmatched } = await buildMatches(sb, rows)

  let inserted = 0
  if (prepared.size > 0) {
    // Idempotent: upsert on (user_id, book_id) so re-importing never duplicates.
    const payload = [...prepared.values()].map((p) => ({
      ...p,
      user_id: user.id,
    }))
    const { error: upsertError } = await sb
      .from('user_books')
      .upsert(payload, { onConflict: 'user_id,book_id' })
    if (
      reportWriteError(upsertError, {
        op: 'import.user_books',
        table: 'user_books',
      })
    ) {
      return { ok: false as const, error: 'import_failed' }
    }
    inserted = prepared.size
  }

  // Badges only -- no activity_events are written, so the bulk import never
  // spams the feed (user_books has no activity trigger).
  await checkAndAwardBadges(user.id)
  revalidatePath('/library')
  return { ok: true as const, matched, inserted, unmatched }
}

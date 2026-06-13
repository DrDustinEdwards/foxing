'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { checkAndAwardBadges } from '@/lib/badges'
import { reportWriteError } from '@/lib/db-write'

interface GoodreadsRow {
  title: string
  author: string
  rating: number | null
  review: string | null
  date_finished: string | null
  shelf: string
}

interface ImportResult {
  matched: number
  inserted: number
  unmatched: { title: string; author: string }[]
}

const SHELF_TO_STATUS: Record<string, string> = {
  read: 'finished',
  'currently-reading': 'reading',
  'to-read': 'want_to_read',
}

function shelfToStatus(shelf: string): string {
  return SHELF_TO_STATUS[shelf.trim().toLowerCase()] ?? 'want_to_read'
}

export async function importGoodreadsRows(rows: GoodreadsRow[]) {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return {
      ok: false as const,
      error: 'unauthenticated',
    }
  }

  const result: ImportResult = { matched: 0, inserted: 0, unmatched: [] }

  // Load the catalog once (id/title/author is tiny) and match in memory, rather
  // than one title lookup per row. PostgREST caps reads at 1000, so page through.
  const catalog: { id: string; title: string; author: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from('books')
      .select('id, title, author')
      .range(from, from + 999)
    const page = (data as typeof catalog | null) ?? []
    catalog.push(...page)
    if (page.length < 1000) break
  }
  // Index by lowercased title; the original match was a case-insensitive exact
  // title plus a case-insensitive author substring.
  const byTitle = new Map<string, { id: string; authorLower: string }[]>()
  for (const b of catalog) {
    if (!b.title) continue
    const key = b.title.toLowerCase()
    const entry = { id: b.id, authorLower: (b.author ?? '').toLowerCase() }
    const list = byTitle.get(key)
    if (list) list.push(entry)
    else byTitle.set(key, [entry])
  }

  // Build upserts, deduping by book_id (last write wins) so a single upsert
  // statement cannot hit the same (user_id, book_id) twice.
  const upserts = new Map<string, Record<string, unknown>>()
  for (const row of rows.slice(0, 500)) {
    const title = row.title?.trim()
    const author = row.author?.trim()
    if (!title || !author) continue
    const candidates = byTitle.get(title.toLowerCase())
    const match = candidates?.find((c) => c.authorLower.includes(author.toLowerCase()))
    if (!match) {
      result.unmatched.push({ title, author })
      continue
    }
    result.matched += 1
    const ratingHalf = row.rating ? Math.max(1, Math.min(10, row.rating * 2)) : null
    upserts.set(match.id, {
      user_id: user.id,
      book_id: match.id,
      status: shelfToStatus(row.shelf),
      rating: row.rating,
      rating_half: ratingHalf,
      review: row.review?.trim() || null,
      review_is_public: false,
      finished_at: row.date_finished,
    })
  }

  if (upserts.size > 0) {
    const { error: upsertError } = await sb
      .from('user_books')
      .upsert([...upserts.values()], { onConflict: 'user_id,book_id' })
    if (reportWriteError(upsertError, { op: 'import.user_books', table: 'user_books' })) {
      return { ok: false as const, error: 'import_failed' }
    }
    result.inserted = upserts.size
  }

  await checkAndAwardBadges(user.id)
  revalidatePath('/library')
  return { ok: true as const, ...result }
}

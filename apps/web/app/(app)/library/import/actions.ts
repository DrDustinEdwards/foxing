'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
  const sb = createClient()
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
  for (const row of rows.slice(0, 500)) {
    const title = row.title?.trim()
    const author = row.author?.trim()
    if (!title || !author) continue
    const { data: book } = await sb
      .from('books')
      .select('id')
      .ilike('title', title)
      .ilike('author', `%${author}%`)
      .limit(1)
      .maybeSingle()
    if (!book) {
      result.unmatched.push({ title, author })
      continue
    }
    result.matched += 1
    const status = shelfToStatus(row.shelf)
    const ratingHalf = row.rating ? Math.max(1, Math.min(10, row.rating * 2)) : null
    const { error: upsertError } = await sb.from('user_books').upsert(
      {
        user_id: user.id,
        book_id: (book as { id: string }).id,
        status,
        rating: row.rating,
        rating_half: ratingHalf,
        review: row.review?.trim() || null,
        review_is_public: false,
        finished_at: row.date_finished,
      },
      { onConflict: 'user_id,book_id' },
    )
    if (!upsertError) result.inserted += 1
  }

  revalidatePath('/library')
  return { ok: true as const, ...result }
}

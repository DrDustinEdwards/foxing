import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export interface BookOfMonthRow {
  id: string
  book_id: string
  year: number
  month: number
  category: string | null
  curator_note: string | null
  amazon_url: string | null
  bookshop_url: string | null
  is_published: boolean
  created_at: string
}

export interface BookOfMonthPick extends BookOfMonthRow {
  book: {
    id: string
    slug: string | null
    author_slug: string | null
    title: string
    author: string
    cover_url: string | null
    description: string | null
    isbn: string | null
    isbn13: string | null
    publication_year: number | null
    publisher: string | null
    source_type: 'catalog' | 'community' | null
    epub_url: string | null
  }
}

export interface BookOfMonthPickWithRating extends BookOfMonthPick {
  avg_rating: number | null
  rating_count: number
}

const PICK_COLS =
  'id, book_id, year, month, category, curator_note, amazon_url, bookshop_url, is_published, created_at, book:book_id(id, slug, author_slug, title, author, cover_url, description, isbn, isbn13, publication_year, publisher, source_type, epub_url)' as const

function hasEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

export async function fetchPublishedPicks(): Promise<BookOfMonthPick[]> {
  if (!hasEnv()) return []
  const sb = createClient()
  const { data } = await sb
    .from('book_of_the_month')
    .select(PICK_COLS)
    .eq('is_published', true)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  return ((data as unknown as BookOfMonthPick[] | null) ?? []).filter(
    (row) => row.book !== null,
  )
}

export async function fetchPicksForMonth(
  year: number,
  month: number,
): Promise<BookOfMonthPick[]> {
  if (!hasEnv()) return []
  const sb = createClient()
  const { data } = await sb
    .from('book_of_the_month')
    .select(PICK_COLS)
    .eq('is_published', true)
    .eq('year', year)
    .eq('month', month)
  return ((data as unknown as BookOfMonthPick[] | null) ?? []).filter(
    (row) => row.book !== null,
  )
}

async function attachRatings(
  picks: BookOfMonthPick[],
): Promise<BookOfMonthPickWithRating[]> {
  if (picks.length === 0) return []
  if (!hasEnv())
    return picks.map((p) => ({ ...p, avg_rating: null, rating_count: 0 }))
  const sb = createClient()
  const ids = picks.map((p) => p.book.id)
  const { data: ratings } = await sb
    .from('user_books')
    .select('book_id, rating')
    .in('book_id', ids)
    .not('rating', 'is', null)
  const aggregates = new Map<string, { sum: number; count: number }>()
  for (const row of (ratings as { book_id: string; rating: number | null }[] | null) ?? []) {
    if (row.rating == null || !row.book_id) continue
    const existing = aggregates.get(row.book_id) ?? { sum: 0, count: 0 }
    existing.sum += row.rating
    existing.count += 1
    aggregates.set(row.book_id, existing)
  }
  return picks.map((p) => {
    const agg = aggregates.get(p.book.id)
    return {
      ...p,
      avg_rating: agg && agg.count > 0 ? agg.sum / agg.count : null,
      rating_count: agg?.count ?? 0,
    }
  })
}

export async function fetchPublishedPicksWithRatings(): Promise<
  BookOfMonthPickWithRating[]
> {
  const picks = await fetchPublishedPicks()
  return attachRatings(picks)
}

export async function fetchPicksForMonthWithRatings(
  year: number,
  month: number,
): Promise<BookOfMonthPickWithRating[]> {
  const picks = await fetchPicksForMonth(year, month)
  return attachRatings(picks)
}

export async function fetchAdjacentMonth(
  year: number,
  month: number,
  direction: 'prev' | 'next',
): Promise<{ year: number; month: number } | null> {
  if (!hasEnv()) return null
  const sb = createClient()
  const q = sb
    .from('book_of_the_month')
    .select('year, month')
    .eq('is_published', true)
    .limit(1)
  if (direction === 'prev') {
    const { data } = await q
      .or(
        `year.lt.${year},and(year.eq.${year},month.lt.${month})`,
      )
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    const row = (data as { year: number; month: number }[] | null)?.[0]
    return row ?? null
  }
  const { data } = await q
    .or(
      `year.gt.${year},and(year.eq.${year},month.gt.${month})`,
    )
    .order('year', { ascending: true })
    .order('month', { ascending: true })
  const row = (data as { year: number; month: number }[] | null)?.[0]
  return row ?? null
}

export async function fetchAllPicksForAdmin(): Promise<BookOfMonthPick[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('book_of_the_month')
    .select(PICK_COLS)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  return ((data as unknown as BookOfMonthPick[] | null) ?? []).filter(
    (row) => row.book !== null,
  )
}

export async function fetchPickByIdForAdmin(
  id: string,
): Promise<BookOfMonthPick | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('book_of_the_month')
    .select(PICK_COLS)
    .eq('id', id)
    .maybeSingle()
  const row = data as unknown as BookOfMonthPick | null
  if (!row || !row.book) return null
  return row
}

export function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' })
}

import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface ExternalClub {
  id: string
  slug: string
  name: string
  short_name: string
  description: string | null
  curator: string | null
  website_url: string | null
  logo_url: string | null
  cadence: string | null
  focus: string | null
  sort_order: number | null
  is_active: boolean | null
}

export interface ExternalPick {
  id: string
  club_id: string
  book_id: string
  picked_at: string
  pick_month: number | null
  pick_year: number | null
  category: string | null
  official_url: string | null
  notes: string | null
  is_published: boolean | null
}

export interface ExternalPickWithBook extends ExternalPick {
  club: Pick<ExternalClub, 'id' | 'slug' | 'name' | 'short_name'>
  book: {
    id: string
    slug: string | null
    author_slug: string | null
    title: string
    author: string
    cover_url: string | null
    isbn: string | null
    isbn13: string | null
    source_type: 'catalog' | 'community' | null
    epub_url: string | null
    amazon_url: string | null
    bookshop_url: string | null
  }
  avg_rating: number | null
  rating_count: number
}

const PICK_COLS =
  'id, club_id, book_id, picked_at, pick_month, pick_year, category, official_url, notes, is_published, club:club_id(id, slug, name, short_name), book:book_id(id, slug, author_slug, title, author, cover_url, isbn, isbn13, source_type, epub_url, amazon_url, bookshop_url)' as const

function hasEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

export async function fetchActiveClubs(): Promise<ExternalClub[]> {
  if (!hasEnv()) return []
  const sb = createClient()
  const { data } = await sb
    .from('external_book_clubs')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  return (data as ExternalClub[] | null) ?? []
}

export async function fetchClubBySlug(
  slug: string,
): Promise<ExternalClub | null> {
  if (!hasEnv()) return null
  const sb = createClient()
  const { data } = await sb
    .from('external_book_clubs')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  return (data as ExternalClub | null) ?? null
}

export async function fetchAllClubsForAdmin(): Promise<ExternalClub[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('external_book_clubs')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  return (data as ExternalClub[] | null) ?? []
}

async function attachRatings(
  rows: Omit<ExternalPickWithBook, 'avg_rating' | 'rating_count'>[],
): Promise<ExternalPickWithBook[]> {
  if (rows.length === 0) return []
  if (!hasEnv())
    return rows.map((r) => ({ ...r, avg_rating: null, rating_count: 0 }))
  const sb = createClient()
  const bookIds = rows.map((r) => r.book.id)
  const { data: ratings } = await sb
    .from('user_books')
    .select('book_id, rating')
    .in('book_id', bookIds)
    .not('rating', 'is', null)
  const aggregates = new Map<string, { sum: number; count: number }>()
  for (const row of (ratings as { book_id: string; rating: number | null }[] | null) ?? []) {
    if (row.rating == null || !row.book_id) continue
    const existing = aggregates.get(row.book_id) ?? { sum: 0, count: 0 }
    existing.sum += row.rating
    existing.count += 1
    aggregates.set(row.book_id, existing)
  }
  return rows.map((r) => {
    const agg = aggregates.get(r.book.id)
    return {
      ...r,
      avg_rating: agg && agg.count > 0 ? agg.sum / agg.count : null,
      rating_count: agg?.count ?? 0,
    }
  })
}

export async function fetchRecentPicksByClub(
  clubId: string,
  limit = 3,
): Promise<ExternalPickWithBook[]> {
  if (!hasEnv()) return []
  const sb = createClient()
  const { data } = await sb
    .from('external_book_club_picks')
    .select(PICK_COLS)
    .eq('club_id', clubId)
    .eq('is_published', true)
    .order('picked_at', { ascending: false })
    .limit(limit)
  const rows = ((data as unknown as ExternalPickWithBook[] | null) ?? []).filter(
    (row) => row.book && row.club,
  )
  return attachRatings(rows)
}

export async function fetchAllPicksForClub(
  clubId: string,
): Promise<ExternalPickWithBook[]> {
  if (!hasEnv()) return []
  const sb = createClient()
  const { data } = await sb
    .from('external_book_club_picks')
    .select(PICK_COLS)
    .eq('club_id', clubId)
    .eq('is_published', true)
    .order('picked_at', { ascending: false })
  const rows = ((data as unknown as ExternalPickWithBook[] | null) ?? []).filter(
    (row) => row.book && row.club,
  )
  return attachRatings(rows)
}

export async function fetchCurrentMonthPicks(): Promise<ExternalPickWithBook[]> {
  if (!hasEnv()) return []
  const sb = createClient()
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10)
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10)
  const { data } = await sb
    .from('external_book_club_picks')
    .select(PICK_COLS)
    .eq('is_published', true)
    .gte('picked_at', monthStart)
    .lt('picked_at', monthEnd)
    .order('picked_at', { ascending: false })
  const rows = ((data as unknown as ExternalPickWithBook[] | null) ?? []).filter(
    (row) => row.book && row.club,
  )
  return attachRatings(rows)
}

export async function fetchAllPicksForAdmin(): Promise<ExternalPickWithBook[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('external_book_club_picks')
    .select(PICK_COLS)
    .order('picked_at', { ascending: false })
    .limit(200)
  const rows = ((data as unknown as ExternalPickWithBook[] | null) ?? []).filter(
    (row) => row.book && row.club,
  )
  return rows.map((r) => ({ ...r, avg_rating: null, rating_count: 0 }))
}

export function monthLabel(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' })
}

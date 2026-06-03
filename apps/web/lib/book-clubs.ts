import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// All reads in this file are public catalog data: external book clubs
// and their published picks. Using the admin (service-role) client so
// pages that consume these functions never trigger cookies() and can
// be statically prerendered. Mirrors the pattern in lib/queries.ts.

export interface Era {
  label: string
  start_year: number
  end_year: number | null
  description: string
}

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
  eras: Era[] | null
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
  const sb = createAdminClient()
  const { data } = await sb
    .from('external_book_clubs')
    .select('*')
    .order('is_active', { ascending: false, nullsFirst: false })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  return (data as ExternalClub[] | null) ?? []
}

export async function fetchClubBySlug(
  slug: string,
): Promise<ExternalClub | null> {
  if (!hasEnv()) return null
  const sb = createAdminClient()
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
  const sb = createAdminClient()
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
  const sb = createAdminClient()
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
  const sb = createAdminClient()
  const { data } = await sb
    .from('external_book_club_picks')
    .select(PICK_COLS)
    .eq('club_id', clubId)
    .eq('is_published', true)
    .order('pick_year', { ascending: false, nullsFirst: false })
    .order('pick_month', { ascending: false, nullsFirst: false })
    .order('picked_at', { ascending: false })
  const rows = ((data as unknown as ExternalPickWithBook[] | null) ?? []).filter(
    (row) => row.book && row.club,
  )
  return attachRatings(rows)
}

export interface MonthlyPicksRow extends ExternalPickWithBook {
  curator_quote: string | null
  official_announcement_url: string | null
  club_full: ExternalClub
}

const PICK_COLS_WITH_QUOTE =
  'id, club_id, book_id, picked_at, pick_month, pick_year, category, official_url, notes, is_published, curator_quote, official_announcement_url, club:club_id(id, slug, name, short_name, description, curator, website_url, logo_url, cadence, focus, sort_order, is_active), book:book_id(id, slug, author_slug, title, author, cover_url, isbn, isbn13, source_type, epub_url, amazon_url, bookshop_url)' as const

interface PickWithQuoteRow {
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
  curator_quote: string | null
  official_announcement_url: string | null
  club: ExternalClub
  book: ExternalPickWithBook['book']
}

export async function fetchPicksForMonth(
  year: number | string,
  month: number | string,
): Promise<MonthlyPicksRow[]> {
  if (!hasEnv()) return []
  // Coerce defensively so callers passing URL params ('05') still match
  // the DB's integer column.
  const yearNum =
    typeof year === 'number' ? year : Number.parseInt(year, 10)
  const monthNum =
    typeof month === 'number' ? month : Number.parseInt(month, 10)
  if (!Number.isInteger(yearNum) || !Number.isInteger(monthNum)) return []
  const sb = createAdminClient()
  const { data } = await sb
    .from('external_book_club_picks')
    .select(PICK_COLS_WITH_QUOTE)
    .eq('is_published', true)
    .eq('pick_month', monthNum)
    .eq('pick_year', yearNum)
  const rows = (data as unknown as PickWithQuoteRow[] | null) ?? []
  const valid = rows.filter((r) => r.book && r.club)
  if (valid.length === 0) return []
  // Pull ratings for each book and attach
  const bookIds = valid.map((r) => r.book.id)
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
  return valid
    .map((r) => {
      const agg = aggregates.get(r.book.id)
      return {
        ...r,
        club: {
          id: r.club.id,
          slug: r.club.slug,
          name: r.club.name,
          short_name: r.club.short_name,
        },
        club_full: r.club,
        avg_rating: agg && agg.count > 0 ? agg.sum / agg.count : null,
        rating_count: agg?.count ?? 0,
      }
    })
    .sort((a, b) => {
      const ao = a.club_full.sort_order ?? 999
      const bo = b.club_full.sort_order ?? 999
      if (ao !== bo) return ao - bo
      return a.club_full.name.localeCompare(b.club_full.name)
    })
}

export interface PickForClubAndMonth extends MonthlyPicksRow {}

export async function fetchPickByClubSlugAndMonth(
  clubSlug: string,
  year: number | string,
  month: number | string,
): Promise<PickForClubAndMonth | null> {
  if (!hasEnv()) return null
  const yearNum =
    typeof year === 'number' ? year : Number.parseInt(year, 10)
  const monthNum =
    typeof month === 'number' ? month : Number.parseInt(month, 10)
  if (!Number.isInteger(yearNum) || !Number.isInteger(monthNum)) return null
  const sb = createAdminClient()
  const { data: club } = await sb
    .from('external_book_clubs')
    .select('*')
    .eq('slug', clubSlug)
    .maybeSingle()
  if (!club) return null
  const clubRow = club as ExternalClub
  const { data } = await sb
    .from('external_book_club_picks')
    .select(PICK_COLS_WITH_QUOTE)
    .eq('is_published', true)
    .eq('club_id', clubRow.id)
    .eq('pick_month', monthNum)
    .eq('pick_year', yearNum)
    .maybeSingle()
  const row = data as unknown as PickWithQuoteRow | null
  if (!row || !row.book || !row.club) return null
  const { data: ratings } = await sb
    .from('user_books')
    .select('rating')
    .eq('book_id', row.book.id)
    .not('rating', 'is', null)
  let avg: number | null = null
  let count = 0
  if (ratings && ratings.length > 0) {
    const nums = (ratings as { rating: number | null }[])
      .map((r) => r.rating)
      .filter((n): n is number => typeof n === 'number')
    count = nums.length
    if (count > 0) avg = nums.reduce((s, n) => s + n, 0) / count
  }
  return {
    ...row,
    club: {
      id: row.club.id,
      slug: row.club.slug,
      name: row.club.name,
      short_name: row.club.short_name,
    },
    club_full: clubRow,
    avg_rating: avg,
    rating_count: count,
  }
}

export async function monthHasAnyPicks(
  year: number,
  month: number,
): Promise<boolean> {
  if (!hasEnv()) return false
  const sb = createAdminClient()
  const { count } = await sb
    .from('external_book_club_picks')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true)
    .eq('pick_month', month)
    .eq('pick_year', year)
  return (count ?? 0) > 0
}

export async function clubHasPickForMonth(
  clubId: string,
  year: number,
  month: number,
): Promise<boolean> {
  if (!hasEnv()) return false
  const sb = createAdminClient()
  const { count } = await sb
    .from('external_book_club_picks')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true)
    .eq('club_id', clubId)
    .eq('pick_month', month)
    .eq('pick_year', year)
  return (count ?? 0) > 0
}

export async function fetchAdjacentPicksForClub(
  clubId: string,
  year: number | string,
  month: number | string,
  count = 3,
): Promise<MonthlyPicksRow[]> {
  if (!hasEnv()) return []
  const yearNum =
    typeof year === 'number' ? year : Number.parseInt(year, 10)
  const monthNum =
    typeof month === 'number' ? month : Number.parseInt(month, 10)
  if (!Number.isInteger(yearNum) || !Number.isInteger(monthNum)) return []
  const sb = createAdminClient()
  const sentinel = yearNum * 12 + monthNum
  const { data } = await sb
    .from('external_book_club_picks')
    .select(PICK_COLS_WITH_QUOTE)
    .eq('is_published', true)
    .eq('club_id', clubId)
    .order('pick_year', { ascending: false })
    .order('pick_month', { ascending: false })
    .limit(count + 4)
  const rows = ((data as unknown as PickWithQuoteRow[] | null) ?? [])
    .filter((r) => r.book && r.club)
    .filter((r) => {
      const ordinal = (r.pick_year ?? 0) * 12 + (r.pick_month ?? 0)
      return ordinal !== sentinel
    })
    .slice(0, count)
  return rows.map((r) => ({
    ...r,
    club: {
      id: r.club.id,
      slug: r.club.slug,
      name: r.club.name,
      short_name: r.club.short_name,
    },
    club_full: r.club,
    avg_rating: null,
    rating_count: 0,
  }))
}

export interface PickStaticParam {
  slug: string
  year: string
  month: string
}

export async function fetchAllPickStaticParams(): Promise<PickStaticParam[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('external_book_club_picks')
    .select('pick_month, pick_year, external_book_clubs!inner(slug)')
    .eq('is_published', true)
  type Row = {
    pick_month: number | null
    pick_year: number | null
    external_book_clubs: { slug: string } | { slug: string }[] | null
  }
  const rows = (data as unknown as Row[] | null) ?? []
  const out: PickStaticParam[] = []
  for (const r of rows) {
    if (!r.pick_month || !r.pick_year) continue
    const clubRel = Array.isArray(r.external_book_clubs)
      ? r.external_book_clubs[0]
      : r.external_book_clubs
    if (!clubRel?.slug) continue
    out.push({
      slug: clubRel.slug,
      year: String(r.pick_year),
      month: String(r.pick_month).padStart(2, '0'),
    })
  }
  return out
}

export function pickMonthLabel(year: number, month: number): string {
  return `${monthLabel(month)} ${year}`
}

export function previousMonth(
  year: number,
  month: number,
): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

export function nextMonth(
  year: number,
  month: number,
): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 }
  return { year, month: month + 1 }
}

export async function fetchCurrentMonthPicks(): Promise<ExternalPickWithBook[]> {
  if (!hasEnv()) return []
  const sb = createAdminClient()
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

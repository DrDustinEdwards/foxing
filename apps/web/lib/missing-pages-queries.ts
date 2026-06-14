import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugifySeriesName } from '@/lib/slug'

/**
 * Public catalog reads (people, series, themes, awards, challenges,
 * lists, passage of day, public user sub-pages, vocabulary export,
 * year-in-reading, buddy reads). Uses the admin client so the page
 * does NOT call cookies() and can be statically prerendered. Every
 * user-scoped query filters by an explicit userId param.
 */

/**
 * Data fetchers backing the missing-pages routes (people, series, themes,
 * awards, challenges, lists, passage of day, user sub-pages, vocabulary,
 * year in reading, buddy reads). Kept separate from `queries.ts` so the
 * parallel SEO terminal can keep editing that file without merge churn.
 */

function sb() {
  return createAdminClient()
}

function hasEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

function escapeLike(s: string): string {
  return s.replace(/[%_]/g, '\\$&')
}

// --- PEOPLE ---

export interface PersonRow {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  reading_personality: string | null
  is_public: boolean
  created_at: string
  books_count: number
  highlight_count: number
}

export type PeopleSort = 'most_books' | 'most_active' | 'newest'

export async function fetchPublicPeople(opts: {
  sort?: PeopleSort
  search?: string
  limit?: number
}): Promise<PersonRow[]> {
  if (!hasEnv()) return []
  const limit = opts.limit ?? 48
  const sort = opts.sort ?? 'most_books'
  const search = opts.search?.trim()

  let q = sb()
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, reading_personality, is_public, created_at',
    )
    .eq('is_public', true)
    .not('username', 'is', null)

  if (search) {
    const like = `%${escapeLike(search)}%`
    q = q.or(`display_name.ilike.${like},username.ilike.${like}`)
  }

  // We sort client-side after counts come back, but newest can sort here
  // directly to keep the page snappy when there are many profiles.
  if (sort === 'newest') {
    q = q.order('created_at', { ascending: false })
  } else {
    q = q.order('created_at', { ascending: false })
  }

  const { data } = await q.limit(limit * 3)
  if (!data) return []
  const profiles = data as Array<Omit<PersonRow, 'books_count' | 'highlight_count'>>
  if (profiles.length === 0) return []

  const ids = profiles.map((p) => p.id)
  const [booksRes, highlightsRes] = await Promise.all([
    sb()
      .from('user_books')
      .select('user_id')
      .in('user_id', ids)
      .eq('status', 'finished'),
    sb()
      .from('highlights')
      .select('user_id')
      .in('user_id', ids)
      .eq('is_public', true),
  ])

  const booksCount = new Map<string, number>()
  for (const row of (booksRes.data ?? []) as Array<{ user_id: string }>) {
    booksCount.set(row.user_id, (booksCount.get(row.user_id) ?? 0) + 1)
  }
  const highlightCount = new Map<string, number>()
  for (const row of (highlightsRes.data ?? []) as Array<{ user_id: string }>) {
    highlightCount.set(row.user_id, (highlightCount.get(row.user_id) ?? 0) + 1)
  }

  const enriched: PersonRow[] = profiles.map((p) => ({
    ...p,
    books_count: booksCount.get(p.id) ?? 0,
    highlight_count: highlightCount.get(p.id) ?? 0,
  }))

  if (sort === 'most_books') {
    enriched.sort((a, b) => b.books_count - a.books_count)
  } else if (sort === 'most_active') {
    enriched.sort(
      (a, b) =>
        b.books_count + b.highlight_count - (a.books_count + a.highlight_count),
    )
  }
  return enriched.slice(0, limit)
}

// --- SERIES ---

export interface SeriesSummary {
  slug: string
  name: string
  book_count: number
  covers: Array<string | null>
}

export interface SeriesBook {
  id: string
  slug: string | null
  title: string
  author: string
  cover_url: string | null
  word_count: number | null
  series_order: number | null
}

export async function fetchSeriesIndex(): Promise<SeriesSummary[]> {
  if (!hasEnv()) return []
  const { data } = await sb()
    .from('books')
    .select('series_name, series_order, cover_url, title')
    .not('series_name', 'is', null)
    .neq('series_name', '')
    .order('series_name', { ascending: true })
    .order('series_order', { ascending: true, nullsFirst: false })
    .limit(5000)
  if (!data) return []
  const rows = data as Array<{
    series_name: string | null
    series_order: number | null
    cover_url: string | null
    title: string
  }>
  const grouped = new Map<
    string,
    { covers: Array<string | null>; count: number }
  >()
  for (const r of rows) {
    if (!r.series_name) continue
    const entry = grouped.get(r.series_name) ?? { covers: [], count: 0 }
    if (entry.covers.length < 3) entry.covers.push(r.cover_url)
    entry.count += 1
    grouped.set(r.series_name, entry)
  }
  return Array.from(grouped.entries())
    .map(([name, { covers, count }]) => ({
      slug: slugifySeriesName(name),
      name,
      book_count: count,
      covers,
    }))
    .sort((a, b) => b.book_count - a.book_count)
}

export async function fetchSeriesBySlug(slug: string): Promise<{
  name: string
  books: SeriesBook[]
} | null> {
  if (!hasEnv()) return null
  const index = await fetchSeriesIndex()
  const match = index.find((s) => s.slug === slug)
  if (!match) return null
  const { data } = await sb()
    .from('books')
    .select('id, title, author, cover_url, word_count, series_order')
    .eq('series_name', match.name)
    .order('series_order', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true })
  return { name: match.name, books: ((data ?? []) as SeriesBook[]) }
}

// --- AWARDS ---

export interface AwardCategory {
  slug: string
  name: string
  blurb: string
  searchTerms: string[]
}

export const AWARD_CATEGORIES: AwardCategory[] = [
  {
    slug: 'nobel',
    name: 'Nobel Prize in Literature',
    blurb:
      'The Swedish Academy awards this each year to an author whose body of work has had a lasting impact.',
    searchTerms: ['nobel', 'nobel prize'],
  },
  {
    slug: 'pulitzer',
    name: 'Pulitzer Prize for Fiction',
    blurb:
      'For distinguished fiction by an American author, ideally dealing with American life.',
    searchTerms: ['pulitzer'],
  },
  {
    slug: 'booker',
    name: 'Booker Prize',
    blurb: 'The leading literary award in the English-speaking world.',
    searchTerms: ['booker'],
  },
  {
    slug: 'national-book-award',
    name: 'National Book Award',
    blurb:
      'A US literary prize given by the National Book Foundation since 1950.',
    searchTerms: ['national book award'],
  },
  {
    slug: 'hugo',
    name: 'Hugo Award',
    blurb:
      'The genre award for science fiction and fantasy, voted on by readers.',
    searchTerms: ['hugo award'],
  },
]

export interface AwardBookHit {
  id: string
  slug: string | null
  title: string
  author: string
  cover_url: string | null
  themes: string[] | null
}

export async function fetchAwardWinners(
  category: AwardCategory,
  limit = 8,
): Promise<AwardBookHit[]> {
  if (!hasEnv()) return []
  const orParts = category.searchTerms
    .map((t) => `description.ilike.%${escapeLike(t)}%`)
    .join(',')
  const { data } = await sb()
    .from('books')
    .select('id, slug, title, author, cover_url, themes')
    .or(orParts)
    .limit(limit)
  return (data as AwardBookHit[] | null) ?? []
}

// --- CHALLENGES ---

export interface ChallengeRow {
  id: string
  title: string
  description: string | null
  type: string
  target: number
  start_date: string | null
  end_date: string | null
  is_community: boolean
  created_at: string
  participant_count: number
  is_active: boolean
}

export async function fetchPublicChallenges(): Promise<ChallengeRow[]> {
  if (!hasEnv()) return []
  const today = new Date().toISOString().slice(0, 10)
  const { data: challenges } = await sb()
    .from('challenges')
    .select(
      'id, title, description, type, target, start_date, end_date, is_community, created_at',
    )
    .eq('is_community', true)
    .order('created_at', { ascending: false })
    .limit(100)
  if (!challenges) return []
  const rows = challenges as Array<Omit<ChallengeRow, 'participant_count' | 'is_active'>>
  const ids = rows.map((r) => r.id)
  if (ids.length === 0) return []
  const { data: joins } = await sb()
    .from('user_challenges')
    .select('challenge_id')
    .in('challenge_id', ids)
  const counts = new Map<string, number>()
  for (const j of (joins ?? []) as Array<{ challenge_id: string }>) {
    counts.set(j.challenge_id, (counts.get(j.challenge_id) ?? 0) + 1)
  }
  return rows
    .map((r) => ({
      ...r,
      participant_count: counts.get(r.id) ?? 0,
      is_active: r.end_date ? r.end_date >= today : true,
    }))
    .sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
      return b.participant_count - a.participant_count
    })
}

// --- THEMES ---

export interface ThemeBook {
  id: string
  slug: string | null
  title: string
  author: string
  cover_url: string | null
  themes: string[] | null
}

export async function fetchBooksForTheme(opts: {
  searchTerms: string[]
  limit?: number
}): Promise<ThemeBook[]> {
  if (!hasEnv()) return []
  const limit = opts.limit ?? 24
  const orParts: string[] = []
  for (const t of opts.searchTerms) {
    orParts.push(`description.ilike.%${escapeLike(t)}%`)
  }
  const themesArray = `{${opts.searchTerms.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`
  orParts.push(`themes.ov.${themesArray}`)
  const { data } = await sb()
    .from('books')
    .select('id, title, author, cover_url, themes')
    .or(orParts.join(','))
    .order('title', { ascending: true })
    .limit(limit)
  return (data as ThemeBook[] | null) ?? []
}

// --- LISTS DIRECTORY ---

export interface PublicListRow {
  id: string
  slug: string | null
  title: string
  description: string | null
  created_at: string
  is_featured: boolean
  creator: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
  book_count: number
  covers: Array<string | null>
  like_count: number
  liked_by_me: boolean
}

export type ListsSort = 'most_liked' | 'newest' | 'featured'

export async function fetchPublicLists(opts: {
  sort?: ListsSort
  limit?: number
  userId?: string | null
}): Promise<PublicListRow[]> {
  if (!hasEnv()) return []
  const limit = opts.limit ?? 48
  const sort = opts.sort ?? 'most_liked'

  let q = sb()
    .from('reading_lists')
    .select(
      'id, slug, title, description, is_public, is_featured, like_count, created_at, profiles:user_id(username, display_name, avatar_url)',
    )
    .eq('is_public', true)

  if (sort === 'featured') {
    q = q.eq('is_featured', true).order('created_at', { ascending: false })
  } else if (sort === 'most_liked') {
    q = q
      .order('like_count', { ascending: false })
      .order('created_at', { ascending: false })
  } else {
    q = q.order('created_at', { ascending: false })
  }

  const { data, error } = await q.limit(limit)
  if (error || !data) return []
  const rows = data as unknown as Array<{
    id: string
    slug: string | null
    title: string
    description: string | null
    is_public: boolean
    is_featured: boolean
    like_count: number | null
    created_at: string
    profiles: {
      username: string
      display_name: string
      avatar_url: string | null
    } | null
  }>
  const ids = rows.map((r) => r.id)
  const likedIds = await fetchLikedReadingListIds(opts.userId ?? null, ids)
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    created_at: r.created_at,
    is_featured: r.is_featured,
    creator: r.profiles,
    book_count: 0,
    covers: [],
    like_count: r.like_count ?? 0,
    liked_by_me: likedIds.has(r.id),
  }))
}

export async function fetchLikedReadingListIds(
  userId: string | null,
  listIds: string[],
): Promise<Set<string>> {
  if (!userId || listIds.length === 0) return new Set()
  const { data } = await sb()
    .from('reading_list_likes')
    .select('list_id')
    .eq('user_id', userId)
    .in('list_id', listIds)
  return new Set(
    ((data as { list_id: string }[] | null) ?? []).map(
      (r) => r.list_id,
    ),
  )
}

// --- PASSAGE OF THE DAY ---

export interface PassageOfDay {
  id: string
  text: string
  note: string | null
  date: string
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  }
  author: {
    username: string
    display_name: string
  } | null
}

const PASSAGE_POOL_SIZE = 100

export async function fetchPassageOfDay(
  date: string,
): Promise<PassageOfDay | null> {
  if (!hasEnv()) return null
  const { data } = await sb()
    .from('highlights')
    .select(
      'id, text, note, created_at, books:book_id(id, slug, title, author, cover_url), profiles:user_id(username, display_name)',
    )
    .eq('is_public', true)
    .not('note', 'is', null)
    .order('created_at', { ascending: false })
    .limit(PASSAGE_POOL_SIZE)
  if (!data || data.length === 0) {
    return await fetchPassageFallback(date)
  }
  const rows = data as unknown as Array<{
    id: string
    text: string
    note: string | null
    created_at: string
    books: PassageOfDay['book'] | null
    profiles: PassageOfDay['author']
  }>
  const filtered = rows.filter(
    (r) => r.text && r.text.length > 80 && r.text.length < 400 && r.books,
  )
  if (filtered.length === 0) return await fetchPassageFallback(date)
  const idx = dateOffset(date, filtered.length)
  const pick = filtered[idx]
  return pick.books
    ? {
        id: pick.id,
        text: pick.text,
        note: pick.note,
        date,
        book: pick.books,
        author: pick.profiles,
      }
    : null
}

async function fetchPassageFallback(
  date: string,
): Promise<PassageOfDay | null> {
  const { data } = await sb()
    .from('highlights')
    .select(
      'id, text, note, created_at, books:book_id(id, slug, title, author, cover_url), profiles:user_id(username, display_name)',
    )
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(PASSAGE_POOL_SIZE)
  if (!data || data.length === 0) return null
  const rows = data as unknown as Array<{
    id: string
    text: string
    note: string | null
    created_at: string
    books: PassageOfDay['book'] | null
    profiles: PassageOfDay['author']
  }>
  const filtered = rows.filter((r) => r.text && r.books)
  if (filtered.length === 0) return null
  const idx = dateOffset(date, filtered.length)
  const pick = filtered[idx]
  return pick.books
    ? {
        id: pick.id,
        text: pick.text,
        note: pick.note,
        date,
        book: pick.books,
        author: pick.profiles,
      }
    : null
}

function dateOffset(date: string, modulus: number): number {
  const d = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return 0
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  const days = Math.floor((d.getTime() - start) / 86_400_000)
  return ((days % modulus) + modulus) % modulus
}

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10)
}

// --- USER PUBLIC SUB-PAGE FETCHERS ---

export interface PublicLibraryEntry {
  id: string
  status: string
  rating: number | null
  finished_at: string | null
  created_at: string
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
    themes: string[] | null
  }
}

export async function fetchPublicLibrary(
  userId: string,
  status?: string,
): Promise<PublicLibraryEntry[]> {
  if (!hasEnv()) return []
  let q = sb()
    .from('user_books')
    .select(
      'id, status, rating, finished_at, created_at, books:book_id(id, slug, title, author, cover_url, themes)',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (status) q = q.eq('status', status)
  const { data } = await q
  if (!data) return []
  return (data as unknown as Array<Omit<PublicLibraryEntry, 'book'> & {
    books: PublicLibraryEntry['book'] | null
  }>)
    .filter((r) => r.books !== null)
    .map((r) => ({
      id: r.id,
      status: r.status,
      rating: r.rating,
      finished_at: r.finished_at,
      created_at: r.created_at,
      book: r.books!,
    }))
}

export interface PublicDiaryEntry {
  id: string
  slug: string | null
  log_date: string
  rating_half: number | null
  review: string | null
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  }
}

export async function fetchPublicDiary(
  userId: string,
  year?: number,
): Promise<PublicDiaryEntry[]> {
  if (!hasEnv()) return []
  let q = sb()
    .from('diary_entries')
    .select(
      'id, slug, log_date, rating_half, review, privacy, books:book_id(id, slug, title, author, cover_url)',
    )
    .eq('user_id', userId)
    .eq('privacy', 'public')
  if (year) {
    q = q.gte('log_date', `${year}-01-01`).lt('log_date', `${year + 1}-01-01`)
  }
  const { data, error } = await q.order('log_date', { ascending: false })
  if (error || !data) return []
  return (data as unknown as Array<Omit<PublicDiaryEntry, 'book'> & {
    books: PublicDiaryEntry['book'] | null
  }>)
    .filter((r) => r.books !== null)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      log_date: r.log_date,
      rating_half: r.rating_half,
      review: r.review,
      book: r.books!,
    }))
}

export async function fetchPublicDiaryEntry(opts: {
  userId: string
  slugOrId: string
}): Promise<PublicDiaryEntry | null> {
  if (!hasEnv()) return null
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      opts.slugOrId,
    )
  let { data, error } = await sb()
    .from('diary_entries')
    .select(
      'id, slug, log_date, rating_half, review, privacy, books:book_id(id, slug, title, author, cover_url)',
    )
    .eq('user_id', opts.userId)
    .eq('slug', opts.slugOrId)
    .eq('privacy', 'public')
    .maybeSingle()
  if ((!data || error) && isUuid) {
    const fallback = await sb()
      .from('diary_entries')
      .select(
        'id, slug, log_date, rating_half, review, privacy, books:book_id(id, slug, title, author, cover_url)',
      )
      .eq('user_id', opts.userId)
      .eq('id', opts.slugOrId)
      .eq('privacy', 'public')
      .maybeSingle()
    data = fallback.data
    error = fallback.error
  }
  if (error || !data) return null
  const r = data as unknown as Omit<PublicDiaryEntry, 'book'> & {
    books: PublicDiaryEntry['book'] | null
  }
  if (!r.books) return null
  return {
    id: r.id,
    slug: r.slug,
    log_date: r.log_date,
    rating_half: r.rating_half,
    review: r.review,
    book: r.books,
  }
}

export interface PublicReadingList {
  id: string
  slug: string | null
  title: string
  description: string | null
  is_public: boolean
  is_featured: boolean
  created_at: string
  like_count: number
  liked_by_me: boolean
}

export async function fetchPublicReadingLists(
  userId: string,
): Promise<PublicReadingList[]> {
  if (!hasEnv()) return []
  const { data, error } = await sb()
    .from('reading_lists')
    .select(
      'id, slug, title, description, is_public, is_featured, like_count, created_at',
    )
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as Array<Omit<PublicReadingList, 'liked_by_me'>>).map((r) => ({
    ...r,
    like_count: r.like_count ?? 0,
    liked_by_me: false,
  }))
}

export async function fetchPublicReadingList(opts: {
  userId: string
  slugOrId: string
  viewerId?: string | null
}): Promise<PublicReadingList | null> {
  if (!hasEnv()) return null
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      opts.slugOrId,
    )
  let { data, error } = await sb()
    .from('reading_lists')
    .select(
      'id, slug, title, description, is_public, is_featured, like_count, created_at',
    )
    .eq('user_id', opts.userId)
    .eq('slug', opts.slugOrId)
    .eq('is_public', true)
    .maybeSingle()
  if ((!data || error) && isUuid) {
    const fallback = await sb()
      .from('reading_lists')
      .select(
        'id, slug, title, description, is_public, is_featured, like_count, created_at',
      )
      .eq('user_id', opts.userId)
      .eq('id', opts.slugOrId)
      .eq('is_public', true)
      .maybeSingle()
    data = fallback.data
    error = fallback.error
  }
  if (error || !data) return null
  const row = data as Omit<PublicReadingList, 'liked_by_me'>
  const likedIds = await fetchLikedReadingListIds(opts.viewerId ?? null, [row.id])
  return {
    ...row,
    like_count: row.like_count ?? 0,
    liked_by_me: likedIds.has(row.id),
  }
}

export interface PublicHighlightEntry {
  id: string
  text: string
  note: string | null
  chapter: string | null
  color: string | null
  created_at: string
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  }
}

export async function fetchPublicUserHighlights(
  userId: string,
  bookId?: string,
): Promise<PublicHighlightEntry[]> {
  if (!hasEnv()) return []
  let q = sb()
    .from('highlights')
    .select(
      'id, text, note, chapter, color, created_at, books:book_id(id, slug, title, author, cover_url)',
    )
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(200)
  if (bookId) q = q.eq('book_id', bookId)
  const { data } = await q
  if (!data) return []
  return (data as unknown as Array<Omit<PublicHighlightEntry, 'book'> & {
    books: PublicHighlightEntry['book'] | null
  }>)
    .filter((r) => r.books !== null)
    .map((r) => ({
      id: r.id,
      text: r.text,
      note: r.note,
      chapter: r.chapter,
      color: r.color,
      created_at: r.created_at,
      book: r.books!,
    }))
}

export interface PublicUserReview {
  id: string
  rating: number | null
  review: string
  created_at: string
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  }
}

export async function fetchPublicUserReviews(
  userId: string,
  minRating?: number,
): Promise<PublicUserReview[]> {
  if (!hasEnv()) return []
  let q = sb()
    .from('user_books')
    .select(
      'id, rating, review, created_at, books:book_id(id, slug, title, author, cover_url)',
    )
    .eq('user_id', userId)
    .eq('review_is_public', true)
    .not('review', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)
  if (minRating) q = q.gte('rating', minRating)
  const { data } = await q
  if (!data) return []
  return (data as unknown as Array<Omit<PublicUserReview, 'book'> & {
    books: PublicUserReview['book'] | null
  }>)
    .filter((r) => r.books !== null)
    .map((r) => ({
      id: r.id,
      rating: r.rating,
      review: r.review,
      created_at: r.created_at,
      book: r.books!,
    }))
}

export async function fetchUserCounts(userId: string): Promise<{
  books_count: number
  highlight_count: number
  review_count: number
  list_count: number
  diary_count: number
}> {
  if (!hasEnv()) {
    return {
      books_count: 0,
      highlight_count: 0,
      review_count: 0,
      list_count: 0,
      diary_count: 0,
    }
  }
  const [booksRes, highlightsRes, reviewsRes, listsRes, diaryRes] =
    await Promise.all([
      sb()
        .from('user_books')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'finished'),
      sb()
        .from('highlights')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_public', true),
      sb()
        .from('user_books')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('review_is_public', true)
        .not('review', 'is', null),
      sb()
        .from('reading_lists')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_public', true),
      sb()
        .from('diary_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('privacy', 'public'),
    ])
  return {
    books_count: booksRes.count ?? 0,
    highlight_count: highlightsRes.count ?? 0,
    review_count: reviewsRes.count ?? 0,
    list_count: listsRes.error ? 0 : (listsRes.count ?? 0),
    diary_count: diaryRes.error ? 0 : (diaryRes.count ?? 0),
  }
}

// --- VOCABULARY ---

export interface VocabularyEntry {
  id: string
  word: string
  definition: string | null
  context: string | null
  ai_context: string | null
  context_sentence: string | null
  book_title: string | null
  book_id: string | null
  mastered: boolean | null
  looked_up_at: string | null
  created_at: string | null
  book: { id: string; slug: string | null; title: string; cover_url: string | null } | null
}

export async function fetchVocabulary(
  userId: string,
): Promise<VocabularyEntry[]> {
  if (!hasEnv()) return []
  const { data, error } = await sb()
    .from('vocabulary')
    .select(
      'id, word, definition, context, ai_context, context_sentence, book_title, book_id, mastered, looked_up_at, created_at, books:book_id(id, slug, title, cover_url)',
    )
    .eq('user_id', userId)
    .order('looked_up_at', { ascending: false })
  if (error || !data) return []
  return (data as unknown as Array<Omit<VocabularyEntry, 'book'> & {
    books: VocabularyEntry['book']
  }>).map((r) => ({
    id: r.id,
    word: r.word,
    definition: r.definition,
    context: r.context,
    ai_context: r.ai_context,
    context_sentence: r.context_sentence,
    book_title: r.book_title,
    book_id: r.book_id,
    mastered: r.mastered,
    looked_up_at: r.looked_up_at,
    created_at: r.created_at,
    book: r.books,
  }))
}

// --- YEAR IN READING ---

export interface YearStats {
  year: number
  books_count: number
  pages_count: number
  highlight_count: number
  average_rating: number | null
  longest_book: { title: string; pages: number } | null
  shortest_book: { title: string; pages: number } | null
  most_active_month: { month: number; count: number } | null
  top_genre: string | null
  top_author: string | null
  longest_streak: number
  finished_books: Array<{
    book_id: string
    title: string
    author: string
    cover_url: string | null
    finished_at: string
    rating: number | null
    word_count: number | null
  }>
}

export async function fetchYearStats(
  userId: string,
  year: number,
): Promise<YearStats> {
  const empty: YearStats = {
    year,
    books_count: 0,
    pages_count: 0,
    highlight_count: 0,
    average_rating: null,
    longest_book: null,
    shortest_book: null,
    most_active_month: null,
    top_genre: null,
    top_author: null,
    longest_streak: 0,
    finished_books: [],
  }
  if (!hasEnv()) return empty
  const start = `${year}-01-01T00:00:00.000Z`
  const end = `${year + 1}-01-01T00:00:00.000Z`
  const [booksRes, highlightsRes, streakRes] = await Promise.all([
    sb()
      .from('user_books')
      .select(
        'rating, finished_at, books:book_id(id, slug, title, author, cover_url, word_count, themes)',
      )
      .eq('user_id', userId)
      .eq('status', 'finished')
      .gte('finished_at', start)
      .lt('finished_at', end)
      .order('finished_at', { ascending: true }),
    sb()
      .from('highlights')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', start)
      .lt('created_at', end),
    sb()
      .from('reading_streaks')
      .select('longest_streak')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const finishedBooks = ((booksRes.data ?? []) as unknown as Array<{
    rating: number | null
    finished_at: string | null
    books: {
      id: string
      slug: string | null
      title: string
      author: string
      cover_url: string | null
      word_count: number | null
      themes: string[] | null
    } | null
  }>)
    .filter((r) => r.finished_at && r.books)
    .map((r) => ({
      book_id: r.books!.id,
      title: r.books!.title,
      author: r.books!.author,
      cover_url: r.books!.cover_url,
      finished_at: r.finished_at!,
      rating: r.rating,
      word_count: r.books!.word_count,
      themes: r.books!.themes,
    }))

  if (finishedBooks.length === 0) {
    return {
      ...empty,
      highlight_count: highlightsRes.count ?? 0,
      longest_streak:
        (streakRes.data as { longest_streak: number } | null)?.longest_streak ??
        0,
    }
  }

  const pagesCount = finishedBooks.reduce(
    (sum, b) => sum + Math.round((b.word_count ?? 0) / 250),
    0,
  )
  const ratings = finishedBooks
    .map((b) => b.rating)
    .filter((r): r is number => typeof r === 'number')
  const avg = ratings.length
    ? ratings.reduce((s, n) => s + n, 0) / ratings.length
    : null

  const sortedByLength = [...finishedBooks]
    .filter((b) => typeof b.word_count === 'number')
    .sort((a, b) => (b.word_count ?? 0) - (a.word_count ?? 0))
  const longest = sortedByLength[0]
  const shortest = sortedByLength[sortedByLength.length - 1]

  const monthCounts = new Array(12).fill(0) as number[]
  for (const b of finishedBooks) {
    const m = new Date(b.finished_at).getUTCMonth()
    monthCounts[m] += 1
  }
  const topMonthIdx = monthCounts.reduce(
    (best, count, i) => (count > monthCounts[best] ? i : best),
    0,
  )

  const themeCounts = new Map<string, number>()
  for (const b of finishedBooks) {
    for (const t of b.themes ?? []) {
      themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1)
    }
  }
  const topTheme = Array.from(themeCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0]

  const authorCounts = new Map<string, number>()
  for (const b of finishedBooks) {
    authorCounts.set(b.author, (authorCounts.get(b.author) ?? 0) + 1)
  }
  const topAuthor = Array.from(authorCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0]

  return {
    year,
    books_count: finishedBooks.length,
    pages_count: pagesCount,
    highlight_count: highlightsRes.count ?? 0,
    average_rating: avg,
    longest_book: longest
      ? {
          title: longest.title,
          pages: Math.round((longest.word_count ?? 0) / 250),
        }
      : null,
    shortest_book: shortest
      ? {
          title: shortest.title,
          pages: Math.round((shortest.word_count ?? 0) / 250),
        }
      : null,
    most_active_month: monthCounts[topMonthIdx]
      ? { month: topMonthIdx, count: monthCounts[topMonthIdx] }
      : null,
    top_genre: topTheme ? topTheme[0] : null,
    top_author: topAuthor ? topAuthor[0] : null,
    longest_streak:
      (streakRes.data as { longest_streak: number } | null)?.longest_streak ??
      0,
    finished_books: finishedBooks.map((b) => ({
      book_id: b.book_id,
      title: b.title,
      author: b.author,
      cover_url: b.cover_url,
      finished_at: b.finished_at,
      rating: b.rating,
      word_count: b.word_count,
    })),
  }
}

// --- BUDDY READS ---

export interface BuddyRead {
  id: string
  book_id: string
  user1_id: string
  user2_id: string
  started_at: string | null
  is_active: boolean
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  } | null
  user1: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
  user2: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

export async function fetchUserBuddyReads(
  userId: string,
): Promise<BuddyRead[]> {
  if (!hasEnv()) return []
  const { data } = await sb()
    .from('buddy_reads')
    .select(
      'id, book_id, user1_id, user2_id, started_at, is_active, book:book_id(id, slug, title, author, cover_url), user1:user1_id(username, display_name, avatar_url), user2:user2_id(username, display_name, avatar_url)',
    )
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order('started_at', { ascending: false })
  return ((data ?? []) as unknown as BuddyRead[])
}

export async function fetchBuddyReadById(
  id: string,
  userId: string,
): Promise<BuddyRead | null> {
  if (!hasEnv()) return null
  const { data } = await sb()
    .from('buddy_reads')
    .select(
      'id, book_id, user1_id, user2_id, started_at, is_active, book:book_id(id, slug, title, author, cover_url), user1:user1_id(username, display_name, avatar_url), user2:user2_id(username, display_name, avatar_url)',
    )
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const br = data as unknown as BuddyRead
  if (br.user1_id !== userId && br.user2_id !== userId) return null
  return br
}

export interface BuddyReadPost {
  id: string
  buddy_read_id: string
  author_id: string
  content: string
  page_number: number | null
  chapter: string | null
  has_spoiler: boolean
  created_at: string
  author: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

export async function fetchBuddyReadPosts(
  buddyReadId: string,
): Promise<BuddyReadPost[]> {
  if (!hasEnv()) return []
  const { data } = await sb()
    .from('buddy_read_posts')
    .select(
      'id, buddy_read_id, author_id, content, page_number, chapter, has_spoiler, created_at, author:author_id(username, display_name, avatar_url)',
    )
    .eq('buddy_read_id', buddyReadId)
    .order('created_at', { ascending: true })
  return ((data ?? []) as unknown as BuddyReadPost[])
}

import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { dayOfYear } from '@/lib/foxing'

/**
 * Projection of `books` columns we surface on cards and listings.
 * The real `books` schema lacks the spec's `slug`, `mood_tags`,
 * `weighted_rating`, and `is_staff_pick` columns. We adapt: use `id`
 * for routing slugs, `themes` arrays for mood chips, and compute
 * average ratings from `user_books.rating` on demand.
 */
export interface BookSummary {
  id: string
  title: string
  author: string
  cover_url: string | null
  themes: string[] | null
  weighted_rating: number | null
}

export interface BookFull extends BookSummary {
  description: string | null
  epub_url: string | null
  language: string | null
  subjects: string[] | null
  word_count: number | null
  series_name: string | null
  series_order: number | null
  country: string | null
  reading_difficulty: number | null
  gutenberg_id: number | null
  source: string | null
  source_type: 'catalog' | 'community' | null
  isbn: string | null
  isbn13: string | null
  publication_year: number | null
  publisher: string | null
  external_url: string | null
  amazon_url: string | null
  bookshop_url: string | null
  created_at: string
}

const BOOK_SUMMARY_COLS =
  'id, title, author, cover_url, themes' as const

const BOOK_FULL_COLS =
  'id, title, author, cover_url, themes, description, epub_url, language, subjects, word_count, series_name, series_order, country, reading_difficulty, gutenberg_id, source, source_type, isbn, isbn13, publication_year, publisher, external_url, amazon_url, bookshop_url, created_at' as const

function supabase() {
  return createClient()
}

function hasEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

/**
 * Today's Pick. Rotates daily using day-of-year as a deterministic seed.
 */
export async function fetchTodaysPick(): Promise<BookFull | null> {
  if (!hasEnv()) return null
  const sb = supabase()
  const { count } = await sb
    .from('books')
    .select('id', { count: 'exact', head: true })
  if (!count || count === 0) return null
  const offset = dayOfYear() % count
  const { data } = await sb
    .from('books')
    .select(BOOK_FULL_COLS)
    .order('id', { ascending: true })
    .range(offset, offset)
    .maybeSingle()
  return data as BookFull | null
}

/**
 * Popular this week. PostgREST has no GROUP BY, so we fetch recent
 * user_books inserts, count book_ids client-side, then resolve the
 * top N books in a second query.
 */
export async function fetchPopularThisWeek(limit = 8): Promise<BookSummary[]> {
    if (!hasEnv()) return []
    const sb = supabase()
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const { data: rows } = await sb
      .from('user_books')
      .select('book_id, created_at')
      .gt('created_at', since)
      .limit(500)
    if (!rows || rows.length === 0) return []

    const counts = new Map<string, number>()
    for (const row of rows) {
      if (!row.book_id) continue
      counts.set(row.book_id, (counts.get(row.book_id) ?? 0) + 1)
    }
    const topIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id)
    if (topIds.length === 0) return []

    const { data: books } = await sb
      .from('books')
      .select(BOOK_SUMMARY_COLS)
      .in('id', topIds)
    if (!books) return []

    const order = new Map(topIds.map((id, i) => [id, i]))
    return books
      .map((b) => ({ ...(b as BookSummary), weighted_rating: null }))
      .sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
      ) as BookSummary[]
}

export interface CommunityReview {
  id: string
  user_id: string
  book_id: string
  rating: number | null
  review: string
  created_at: string
  book: Pick<BookSummary, 'id' | 'title' | 'author' | 'cover_url'> | null
  author: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

/**
 * Community reviews. Returns recent public reviews with a rating of 4 or
 * higher. Without a review_likes table we order by recency.
 */
export async function fetchCommunityReviews(
  limit = 3,
): Promise<CommunityReview[]> {
    if (!hasEnv()) return []
    const sb = supabase()
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const { data } = await sb
      .from('user_books')
      .select(
        'id, user_id, book_id, rating, review, created_at, books:book_id(id, title, author, cover_url), profiles:user_id(username, display_name, avatar_url)',
      )
      .eq('review_is_public', true)
      .not('review', 'is', null)
      .gte('rating', 4)
      .gt('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (!data) return []
    return data.map((row) => {
      const r = row as unknown as {
        id: string
        user_id: string
        book_id: string
        rating: number | null
        review: string
        created_at: string
        books:
          | Pick<BookSummary, 'id' | 'title' | 'author' | 'cover_url'>
          | null
        profiles: {
          username: string
          display_name: string
          avatar_url: string | null
        } | null
      }
      return {
        id: r.id,
        user_id: r.user_id,
        book_id: r.book_id,
        rating: r.rating,
        review: r.review,
        created_at: r.created_at,
        book: r.books,
        author: r.profiles,
      }
    })
}

export interface BookWithRating extends BookFull {
  avg_rating: number | null
  rating_count: number
}

/**
 * Resolve a book by id or by a slug-style id-prefix match. Since the
 * schema lacks a slug column we accept the raw uuid.
 */
export async function fetchBookById(id: string): Promise<BookWithRating | null> {
  if (!hasEnv()) return null
  const sb = supabase()
  const { data: book } = await sb
    .from('books')
    .select(BOOK_FULL_COLS)
    .eq('id', id)
    .maybeSingle()
  if (!book) return null

  const { data: ratings } = await sb
    .from('user_books')
    .select('rating')
    .eq('book_id', id)
    .not('rating', 'is', null)
  let avg: number | null = null
  let count = 0
  if (ratings && ratings.length > 0) {
    const nums = ratings
      .map((r) => (r as { rating: number | null }).rating)
      .filter((n): n is number => typeof n === 'number')
    count = nums.length
    if (count > 0) avg = nums.reduce((s, n) => s + n, 0) / count
  }
  return { ...(book as BookFull), avg_rating: avg, rating_count: count }
}

export interface BookReview {
  id: string
  user_id: string
  rating: number | null
  review: string
  created_at: string
  author: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

export async function fetchBookReviews(
  bookId: string,
  limit = 5,
): Promise<BookReview[]> {
  if (!hasEnv()) return []
  const sb = supabase()
  const { data } = await sb
    .from('user_books')
    .select(
      'id, user_id, rating, review, created_at, profiles:user_id(username, display_name, avatar_url)',
    )
    .eq('book_id', bookId)
    .eq('review_is_public', true)
    .not('review', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data) return []
  return data.map((row) => {
    const r = row as unknown as {
      id: string
      user_id: string
      rating: number | null
      review: string
      created_at: string
      profiles: {
        username: string
        display_name: string
        avatar_url: string | null
      } | null
    }
    return {
      id: r.id,
      user_id: r.user_id,
      rating: r.rating,
      review: r.review,
      created_at: r.created_at,
      author: r.profiles,
    }
  })
}

export interface PublicHighlight {
  id: string
  text: string
  note: string | null
  created_at: string
  book: { id: string; title: string; author: string; cover_url: string | null } | null
  author: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

export async function fetchBookHighlights(
  bookId: string,
  limit = 3,
): Promise<PublicHighlight[]> {
  if (!hasEnv()) return []
  const sb = supabase()
  const { data } = await sb
    .from('highlights')
    .select(
      'id, text, note, created_at, books:book_id(id, title, author, cover_url), profiles:user_id(username, display_name, avatar_url)',
    )
    .eq('book_id', bookId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data) return []
  return (data as unknown as PublicHighlight[]).map((row) => row)
}

export async function fetchAiCache(
  bookId: string,
  action: string,
): Promise<string | null> {
  if (!hasEnv()) return null
  const sb = supabase()
  const { data } = await sb
    .from('book_ai_cache')
    .select('content')
    .eq('book_id', bookId)
    .eq('action', action)
    .maybeSingle()
  return (data as { content: string } | null)?.content ?? null
}

export async function fetchSimilarBooks(
  bookId: string,
  limit = 5,
): Promise<BookSummary[]> {
  if (!hasEnv()) return []
  const sb = supabase()
  const cache = await fetchAiCache(bookId, 'similar_books')
  if (!cache) return []
  let ids: string[] = []
  try {
    const parsed = JSON.parse(cache)
    if (Array.isArray(parsed)) {
      ids = parsed
        .map((x) => (typeof x === 'string' ? x : x?.id))
        .filter((x): x is string => typeof x === 'string')
        .slice(0, limit)
    }
  } catch {
    return []
  }
  if (ids.length === 0) return []
  const { data } = await sb
    .from('books')
    .select(BOOK_SUMMARY_COLS)
    .in('id', ids)
  return (
    (data as unknown as BookSummary[] | null)?.map((b) => ({
      ...b,
      weighted_rating: null,
    })) ?? []
  )
}

export interface ClubSummary {
  id: string
  name: string
  description: string | null
  cover_url: string | null
  current_book_id: string | null
  member_count: number
  current_book: Pick<BookSummary, 'id' | 'title' | 'cover_url'> | null
}

export async function fetchPublicClubsForBook(
  bookId: string,
  limit = 3,
): Promise<ClubSummary[]> {
  if (!hasEnv()) return []
  const sb = supabase()
  const { data } = await sb
    .from('clubs')
    .select(
      'id, name, description, cover_url, current_book_id, member_count, current_book:current_book_id(id, title, cover_url)',
    )
    .eq('current_book_id', bookId)
    .eq('visibility', 'public')
    .limit(limit)
  return (data as unknown as ClubSummary[] | null) ?? []
}

export interface PublicProfile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  reading_personality: string | null
  is_public: boolean
  progress_is_public: boolean | null
  subscription_tier: string | null
}

export async function fetchProfileByUsername(
  username: string,
): Promise<PublicProfile | null> {
  if (!hasEnv()) return null
  const sb = supabase()
  const { data } = await sb
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, bio, reading_personality, is_public, progress_is_public, subscription_tier',
    )
    .eq('username', username)
    .maybeSingle()
  return (data as PublicProfile | null) ?? null
}

export interface ProfileFavorite {
  position: number
  book: Pick<BookSummary, 'id' | 'title' | 'author' | 'cover_url'>
}

export async function fetchUserFavorites(
  userId: string,
): Promise<ProfileFavorite[]> {
  if (!hasEnv()) return []
  const sb = supabase()
  const { data } = await sb
    .from('user_favorites')
    .select('position, books:book_id(id, title, author, cover_url)')
    .eq('user_id', userId)
    .order('position', { ascending: true })
  if (!data) return []
  return (data as unknown as Array<{
    position: number
    books: Pick<BookSummary, 'id' | 'title' | 'author' | 'cover_url'> | null
  }>)
    .filter((r) => r.books !== null)
    .map((r) => ({ position: r.position, book: r.books! }))
}

export interface ProfileStats {
  books_finished: number
  highlights: number
  following: number
  followers: number
}

export async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  if (!hasEnv())
    return { books_finished: 0, highlights: 0, following: 0, followers: 0 }
  const sb = supabase()
  const [finished, highlights, following, followers] = await Promise.all([
    sb
      .from('user_books')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'finished'),
    sb
      .from('highlights')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    sb
      .from('follows')
      .select('following_id', { count: 'exact', head: true })
      .eq('follower_id', userId),
    sb
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('following_id', userId),
  ])
  return {
    books_finished: finished.count ?? 0,
    highlights: highlights.count ?? 0,
    following: following.count ?? 0,
    followers: followers.count ?? 0,
  }
}

export interface ProfileReview extends BookReview {
  book: { id: string; title: string; author: string; cover_url: string | null } | null
}

export async function fetchProfileReviews(
  userId: string,
  limit = 3,
): Promise<ProfileReview[]> {
  if (!hasEnv()) return []
  const sb = supabase()
  const { data } = await sb
    .from('user_books')
    .select(
      'id, user_id, rating, review, created_at, books:book_id(id, title, author, cover_url), profiles:user_id(username, display_name, avatar_url)',
    )
    .eq('user_id', userId)
    .eq('review_is_public', true)
    .not('review', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data) return []
  return data.map((row) => {
    const r = row as unknown as {
      id: string
      user_id: string
      rating: number | null
      review: string
      created_at: string
      books: {
        id: string
        title: string
        author: string
        cover_url: string | null
      } | null
      profiles: {
        username: string
        display_name: string
        avatar_url: string | null
      } | null
    }
    return {
      id: r.id,
      user_id: r.user_id,
      rating: r.rating,
      review: r.review,
      created_at: r.created_at,
      author: r.profiles,
      book: r.books,
    }
  })
}

export interface PublicClub {
  id: string
  name: string
  description: string | null
  cover_url: string | null
  current_book_id: string | null
  member_count: number
  visibility: string
  current_book: {
    id: string
    title: string
    author: string
    cover_url: string | null
    isbn: string | null
    isbn13: string | null
    source_type: 'catalog' | 'community' | null
    epub_url: string | null
    amazon_url: string | null
    bookshop_url: string | null
  } | null
}

const CLUB_CURRENT_BOOK_COLS =
  'id, title, author, cover_url, isbn, isbn13, source_type, epub_url, amazon_url, bookshop_url' as const

export async function fetchPublicClubById(
  id: string,
): Promise<PublicClub | null> {
  if (!hasEnv()) return null
  const sb = supabase()
  const { data } = await sb
    .from('clubs')
    .select(
      `id, name, description, cover_url, current_book_id, member_count, visibility, current_book:current_book_id(${CLUB_CURRENT_BOOK_COLS})`,
    )
    .eq('id', id)
    .eq('visibility', 'public')
    .maybeSingle()
  return (data as unknown as PublicClub | null) ?? null
}

export async function fetchPublicClubs(limit = 24): Promise<PublicClub[]> {
  if (!hasEnv()) return []
  const sb = supabase()
  const { data } = await sb
    .from('clubs')
    .select(
      `id, name, description, cover_url, current_book_id, member_count, visibility, current_book:current_book_id(${CLUB_CURRENT_BOOK_COLS})`,
    )
    .eq('visibility', 'public')
    .order('member_count', { ascending: false })
    .limit(limit)
  return (data as unknown as PublicClub[] | null) ?? []
}

export interface ClubPostPreview {
  id: string
  content: string
  created_at: string
  author: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

export async function fetchClubPostsPreview(
  clubId: string,
  limit = 3,
): Promise<ClubPostPreview[]> {
  if (!hasEnv()) return []
  const sb = supabase()
  const { data: threads } = await sb
    .from('club_threads')
    .select('id')
    .eq('club_id', clubId)
    .limit(50)
  const threadIds = ((threads as { id: string }[] | null) ?? []).map(
    (t) => t.id,
  )
  if (threadIds.length === 0) return []
  const { data } = await sb
    .from('club_posts')
    .select(
      'id, content, created_at, profiles:author_id(username, display_name, avatar_url)',
    )
    .in('thread_id', threadIds)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data) return []
  return data.map((row) => {
    const r = row as unknown as {
      id: string
      content: string
      created_at: string
      profiles: {
        username: string
        display_name: string
        avatar_url: string | null
      } | null
    }
    return {
      id: r.id,
      content: r.content,
      created_at: r.created_at,
      author: r.profiles,
    }
  })
}

export async function fetchActiveClubs(limit = 3): Promise<PublicClub[]> {
  if (!hasEnv()) return []
  const sb = supabase()
  const { data } = await sb
    .from('clubs')
    .select(
      `id, name, description, cover_url, current_book_id, member_count, visibility, current_book:current_book_id(${CLUB_CURRENT_BOOK_COLS})`,
    )
    .eq('visibility', 'public')
    .lt('member_count', 10)
    .gt('member_count', 0)
    .order('member_count', { ascending: false })
    .limit(limit)
  return (data as unknown as PublicClub[] | null) ?? []
}

export interface PublicQuote {
  id: string
  text: string
  note: string | null
  created_at: string
  book: { id: string; title: string; author: string; cover_url: string | null } | null
  author: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

export async function fetchPublicQuotes(
  page = 1,
  pageSize = 24,
): Promise<{ items: PublicQuote[]; total: number }> {
  if (!hasEnv()) return { items: [], total: 0 }
  const sb = supabase()
  const offset = (page - 1) * pageSize
  const { data, count } = await sb
    .from('highlights')
    .select(
      'id, text, note, created_at, books:book_id(id, title, author, cover_url), profiles:user_id(username, display_name, avatar_url)',
      { count: 'exact' },
    )
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)
  return {
    items: (data as unknown as PublicQuote[] | null) ?? [],
    total: count ?? 0,
  }
}

export async function fetchQuoteById(id: string): Promise<PublicQuote | null> {
  if (!hasEnv()) return null
  const sb = supabase()
  const { data } = await sb
    .from('highlights')
    .select(
      'id, text, note, created_at, books:book_id(id, title, author, cover_url), profiles:user_id(username, display_name, avatar_url)',
    )
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle()
  return (data as unknown as PublicQuote | null) ?? null
}

/**
 * Search across books, profiles, and clubs. Returns each category's
 * top matches. Callers pick which they need.
 */
export async function searchAll(query: string): Promise<{
  books: BookSummary[]
  people: PublicProfile[]
  clubs: PublicClub[]
}> {
  if (!hasEnv() || !query.trim()) return { books: [], people: [], clubs: [] }
  const sb = supabase()
  const like = `%${query.replace(/[%_]/g, '\\$&')}%`
  const [booksRes, peopleRes, clubsRes] = await Promise.all([
    sb
      .from('books')
      .select(BOOK_SUMMARY_COLS)
      .or(`title.ilike.${like},author.ilike.${like}`)
      .limit(20),
    sb
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, bio, reading_personality, is_public, progress_is_public, subscription_tier',
      )
      .eq('is_public', true)
      .or(`display_name.ilike.${like},username.ilike.${like}`)
      .limit(20),
    sb
      .from('clubs')
      .select(
        'id, name, description, cover_url, current_book_id, member_count, visibility, current_book:current_book_id(id, title, author, cover_url)',
      )
      .eq('visibility', 'public')
      .ilike('name', like)
      .limit(20),
  ])
  return {
    books: (
      (booksRes.data as unknown as BookSummary[] | null) ?? []
    ).map((b) => ({ ...b, weighted_rating: null })),
    people: (peopleRes.data as PublicProfile[] | null) ?? [],
    clubs: (clubsRes.data as unknown as PublicClub[] | null) ?? [],
  }
}

export interface BooksListResult {
  items: BookSummary[]
  total: number
}

/**
 * Books listing with optional filters. mood matches `themes` array
 * via Postgres `cs` (contains). search uses ILIKE on title/author.
 */
export async function fetchBooksList(opts: {
  mood?: string
  search?: string
  era?: string
  page?: number
  pageSize?: number
}): Promise<BooksListResult> {
  if (!hasEnv()) return { items: [], total: 0 }
  const sb = supabase()
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 24
  const offset = (page - 1) * pageSize

  let q = sb
    .from('books')
    .select(BOOK_SUMMARY_COLS, { count: 'exact' })
    .order('title', { ascending: true })

  if (opts.mood) {
    q = q.contains('themes', [opts.mood])
  }
  if (opts.search) {
    const like = `%${opts.search.replace(/[%_]/g, '\\$&')}%`
    q = q.or(`title.ilike.${like},author.ilike.${like}`)
  }

  const { data, count } = await q.range(offset, offset + pageSize - 1)
  return {
    items: (
      (data as unknown as BookSummary[] | null) ?? []
    ).map((b) => ({ ...b, weighted_rating: null })),
    total: count ?? 0,
  }
}

/**
 * All books by an author, matched by ILIKE on the author string.
 */
export async function fetchBooksByAuthor(
  authorName: string,
): Promise<BookSummary[]> {
  if (!hasEnv()) return []
  const sb = supabase()
  const like = `%${authorName.replace(/[%_]/g, '\\$&')}%`
  const { data } = await sb
    .from('books')
    .select(BOOK_SUMMARY_COLS)
    .ilike('author', like)
    .order('created_at', { ascending: false })
    .limit(40)
  return (
    (data as unknown as BookSummary[] | null) ?? []
  ).map((b) => ({ ...b, weighted_rating: null }))
}

/**
 * Recent public highlights from any book by this author.
 */
export async function fetchHighlightsByAuthor(
  authorName: string,
  limit = 3,
): Promise<PublicHighlight[]> {
  if (!hasEnv()) return []
  const sb = supabase()
  const like = `%${authorName.replace(/[%_]/g, '\\$&')}%`
  const { data: books } = await sb
    .from('books')
    .select('id')
    .ilike('author', like)
    .limit(100)
  const ids = ((books as { id: string }[] | null) ?? []).map((b) => b.id)
  if (ids.length === 0) return []
  const { data } = await sb
    .from('highlights')
    .select(
      'id, text, note, created_at, books:book_id(id, title, author, cover_url), profiles:user_id(username, display_name, avatar_url)',
    )
    .in('book_id', ids)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as unknown as PublicHighlight[] | null) ?? []
}

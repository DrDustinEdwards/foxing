import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Per-user server fetchers. Each function assumes the caller has already
 * confirmed an authenticated user via getAuthedUserId() or the (app)
 * layout. The functions take userId explicitly so they're easy to call
 * from server components without redundant auth checks.
 */

function sb() {
  return createClient()
}

export type LibraryStatus =
  | 'reading'
  | 'want_to_read'
  | 'finished'
  | 'paused'
  | 'abandoned'

export interface LibraryEntry {
  id: string
  status: LibraryStatus
  rating: number | null
  progress_percentage: number | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  is_favorite: boolean
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
    themes: string[] | null
    word_count: number | null
  }
}

export async function fetchLibrary(
  userId: string,
  status: LibraryStatus,
): Promise<LibraryEntry[]> {
  const { data } = await sb()
    .from('user_books')
    .select(
      'id, status, rating, progress_percentage, started_at, finished_at, created_at, is_favorite, books:book_id(id, slug, title, author, cover_url, themes, word_count)',
    )
    .eq('user_id', userId)
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (!data) return []
  return data
    .map((row) => {
      const r = row as unknown as Omit<LibraryEntry, 'book'> & {
        books: LibraryEntry['book'] | null
      }
      if (!r.books) return null
      return {
        id: r.id,
        status: r.status,
        rating: r.rating,
        progress_percentage: r.progress_percentage,
        started_at: r.started_at,
        finished_at: r.finished_at,
        created_at: r.created_at,
        is_favorite: r.is_favorite,
        book: r.books,
      }
    })
    .filter((x): x is LibraryEntry => x !== null)
}

export async function fetchCurrentlyReading(
  userId: string,
): Promise<LibraryEntry | null> {
  const items = await fetchLibrary(userId, 'reading')
  return items[0] ?? null
}

export interface ReadingStreak {
  current_streak: number
  longest_streak: number
  last_read_date: string | null
  total_books_finished: number
  total_pages_read: number
  total_highlights: number
}

export async function fetchReadingStreak(
  userId: string,
): Promise<ReadingStreak> {
  const { data } = await sb()
    .from('reading_streaks')
    .select(
      'current_streak, longest_streak, last_read_date, total_books_finished, total_pages_read, total_highlights',
    )
    .eq('user_id', userId)
    .maybeSingle()
  return (
    (data as ReadingStreak | null) ?? {
      current_streak: 0,
      longest_streak: 0,
      last_read_date: null,
      total_books_finished: 0,
      total_pages_read: 0,
      total_highlights: 0,
    }
  )
}

export interface FinishedBookForStats {
  finished_at: string
  rating: number | null
  word_count: number | null
  themes: string[] | null
}

export async function fetchFinishedBooksForStats(
  userId: string,
  since?: string,
  until?: string,
): Promise<FinishedBookForStats[]> {
  let q = sb()
    .from('user_books')
    .select(
      'finished_at, rating, books:book_id(word_count, themes)',
    )
    .eq('user_id', userId)
    .eq('status', 'finished')
    .not('finished_at', 'is', null)
  if (since) q = q.gte('finished_at', since)
  if (until) q = q.lte('finished_at', until)
  const { data } = await q.order('finished_at', { ascending: true })
  if (!data) return []
  return data
    .map((row) => {
      const r = row as unknown as {
        finished_at: string | null
        rating: number | null
        books: { word_count: number | null; themes: string[] | null } | null
      }
      if (!r.finished_at) return null
      return {
        finished_at: r.finished_at,
        rating: r.rating,
        word_count: r.books?.word_count ?? null,
        themes: r.books?.themes ?? null,
      }
    })
    .filter((x): x is FinishedBookForStats => x !== null)
}

export interface UserHighlight {
  id: string
  text: string
  note: string | null
  color: string | null
  chapter: string | null
  is_public: boolean
  created_at: string
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  }
}

export async function fetchUserHighlights(
  userId: string,
): Promise<UserHighlight[]> {
  const { data } = await sb()
    .from('highlights')
    .select(
      'id, text, note, color, chapter, is_public, created_at, books:book_id(id, slug, title, author, cover_url)',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (!data) return []
  return data
    .map((row) => {
      const r = row as unknown as Omit<UserHighlight, 'book'> & {
        books: UserHighlight['book'] | null
      }
      if (!r.books) return null
      return {
        id: r.id,
        text: r.text,
        note: r.note,
        color: r.color,
        chapter: r.chapter,
        is_public: r.is_public,
        created_at: r.created_at,
        book: r.books,
      }
    })
    .filter((x): x is UserHighlight => x !== null)
}

export interface UserGoal {
  id: string
  type: string
  target: number
  year: number
}

export async function fetchUserGoal(
  userId: string,
  year: number,
): Promise<UserGoal | null> {
  const { data } = await sb()
    .from('reading_goals')
    .select('id, type, target, year')
    .eq('user_id', userId)
    .eq('year', year)
    .maybeSingle()
  return (data as UserGoal | null) ?? null
}

export async function fetchBooksFinishedThisYear(
  userId: string,
): Promise<number> {
  const year = new Date().getFullYear()
  const start = `${year}-01-01T00:00:00.000Z`
  const { count } = await sb()
    .from('user_books')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'finished')
    .gte('finished_at', start)
  return count ?? 0
}

export interface ChallengeWithProgress {
  id: string
  title: string
  description: string | null
  type: string
  target: number
  start_date: string | null
  end_date: string | null
  is_community: boolean
  progress: number | null
  joined_at: string | null
  completed_at: string | null
}

export async function fetchActiveChallenges(
  userId: string,
): Promise<ChallengeWithProgress[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data: challenges } = await sb()
    .from('challenges')
    .select(
      'id, title, description, type, target, start_date, end_date, is_community, created_at',
    )
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('created_at', { ascending: false })
    .limit(20)
  if (!challenges) return []
  const ids = (challenges as { id: string }[]).map((c) => c.id)
  if (ids.length === 0) return []
  const { data: joins } = await sb()
    .from('user_challenges')
    .select('challenge_id, progress, joined_at, completed_at')
    .eq('user_id', userId)
    .in('challenge_id', ids)
  const joinMap = new Map(
    ((joins as Array<{
      challenge_id: string
      progress: number | null
      joined_at: string | null
      completed_at: string | null
    }> | null) ?? []).map((j) => [j.challenge_id, j]),
  )
  return (challenges as Array<{
    id: string
    title: string
    description: string | null
    type: string
    target: number
    start_date: string | null
    end_date: string | null
    is_community: boolean
  }>).map((c) => {
    const j = joinMap.get(c.id)
    return {
      ...c,
      progress: j?.progress ?? null,
      joined_at: j?.joined_at ?? null,
      completed_at: j?.completed_at ?? null,
    }
  })
}

/**
 * Diary entries. The diary_entries table is in the spec but not yet in
 * the live schema, so this function swallows the table-missing error and
 * returns an empty list. The page will render an empty state until the
 * table is created.
 */
export interface DiaryEntry {
  id: string
  log_date: string
  rating: number | null
  review: string | null
  privacy: string
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  }
}

export async function fetchDiaryEntries(
  userId: string,
  year?: number,
): Promise<DiaryEntry[]> {
  let q = sb()
    .from('diary_entries')
    .select(
      'id, log_date, rating, review, privacy, books:book_id(id, slug, title, author, cover_url)',
    )
    .eq('user_id', userId)
  if (year) {
    q = q
      .gte('log_date', `${year}-01-01`)
      .lt('log_date', `${year + 1}-01-01`)
  }
  const { data, error } = await q.order('log_date', { ascending: false })
  if (error || !data) return []
  return data
    .map((row) => {
      const r = row as unknown as Omit<DiaryEntry, 'book'> & {
        books: DiaryEntry['book'] | null
      }
      if (!r.books) return null
      return {
        id: r.id,
        log_date: r.log_date,
        rating: r.rating,
        review: r.review,
        privacy: r.privacy,
        book: r.books,
      }
    })
    .filter((x): x is DiaryEntry => x !== null)
}

/**
 * Reading lists. The reading_lists table is in the spec but not yet in
 * the live schema. Like fetchDiaryEntries this swallows the missing-table
 * error so the UI renders an empty state until the table exists.
 */
export interface UserList {
  id: string
  title: string
  description: string | null
  is_public: boolean
  is_featured: boolean
  created_at: string
  book_count: number
  cover_books: Array<{ cover_url: string | null; title: string }>
}

export async function fetchUserLists(userId: string): Promise<UserList[]> {
  const { data, error } = await sb()
    .from('reading_lists')
    .select('id, title, description, is_public, is_featured, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  // Without reading_list_books we can't populate covers. Return shells.
  return (
    data as Array<{
      id: string
      title: string
      description: string | null
      is_public: boolean
      is_featured: boolean
      created_at: string
    }>
  ).map((row) => ({
    ...row,
    book_count: 0,
    cover_books: [],
  }))
}

export async function fetchFeaturedLists(): Promise<UserList[]> {
  const { data, error } = await sb()
    .from('reading_lists')
    .select('id, title, description, is_public, is_featured, created_at')
    .eq('is_public', true)
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(12)
  if (error || !data) return []
  return (
    data as Array<{
      id: string
      title: string
      description: string | null
      is_public: boolean
      is_featured: boolean
      created_at: string
    }>
  ).map((row) => ({ ...row, book_count: 0, cover_books: [] }))
}

export async function fetchProfileBasics(userId: string): Promise<{
  display_name: string
  subscription_tier: string | null
  username: string
} | null> {
  const { data } = await sb()
    .from('profiles')
    .select('display_name, subscription_tier, username')
    .eq('id', userId)
    .maybeSingle()
  return data as {
    display_name: string
    subscription_tier: string | null
    username: string
  } | null
}

import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { UserHighlight } from '@/lib/user-queries-types'
export { type UserHighlight } from '@/lib/user-queries-types'

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
  rating_half: number | null
  progress_percentage: number | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  is_favorite: boolean
  tags: string[]
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
      'id, status, rating, rating_half, progress_percentage, started_at, finished_at, created_at, is_favorite, books:book_id(id, slug, title, author, cover_url, themes, word_count)',
    )
    .eq('user_id', userId)
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (!data) return []
  const rows = data
    .map((row) => {
      const r = row as unknown as Omit<LibraryEntry, 'book' | 'tags'> & {
        books: LibraryEntry['book'] | null
      }
      if (!r.books) return null
      return {
        id: r.id,
        status: r.status,
        rating: r.rating,
        rating_half: r.rating_half,
        progress_percentage: r.progress_percentage,
        started_at: r.started_at,
        finished_at: r.finished_at,
        created_at: r.created_at,
        is_favorite: r.is_favorite,
        tags: [] as string[],
        book: r.books,
      }
    })
    .filter((x): x is LibraryEntry => x !== null)

  if (rows.length === 0) return rows
  const bookIds = rows.map((r) => r.book.id)
  const { data: tagRows } = await sb()
    .from('user_book_tags')
    .select('book_id, tag')
    .eq('user_id', userId)
    .in('book_id', bookIds)
  const tagsByBook = new Map<string, string[]>()
  for (const t of (tagRows as { book_id: string; tag: string }[] | null) ?? []) {
    const list = tagsByBook.get(t.book_id) ?? []
    list.push(t.tag)
    tagsByBook.set(t.book_id, list)
  }
  for (const list of tagsByBook.values()) list.sort()
  return rows.map((r) => ({
    ...r,
    tags: tagsByBook.get(r.book.id) ?? [],
  }))
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
  streak_freeze_credits: number
}

export async function fetchReadingStreak(
  userId: string,
): Promise<ReadingStreak> {
  const { data } = await sb()
    .from('reading_streaks')
    .select(
      'current_streak, longest_streak, last_read_date, total_books_finished, total_pages_read, total_highlights, streak_freeze_credits',
    )
    .eq('user_id', userId)
    .maybeSingle()
  const row = data as Partial<ReadingStreak> | null
  return {
    current_streak: row?.current_streak ?? 0,
    longest_streak: row?.longest_streak ?? 0,
    last_read_date: row?.last_read_date ?? null,
    total_books_finished: row?.total_books_finished ?? 0,
    total_pages_read: row?.total_pages_read ?? 0,
    total_highlights: row?.total_highlights ?? 0,
    streak_freeze_credits: row?.streak_freeze_credits ?? 0,
  }
}

export interface FinishedBookForStats {
  finished_at: string
  rating: number | null
  rating_half: number | null
  word_count: number | null
  themes: string[] | null
}

export interface RecentReadingSession {
  id: string
  started_at: string
  ended_at: string | null
  pages_read: number
  avg_wpm: number | null
  book: {
    id: string
    slug: string | null
    title: string
    author: string
  } | null
}

export async function fetchRecentSessions(
  userId: string,
  limit = 10,
): Promise<RecentReadingSession[]> {
  const { data } = await sb()
    .from('reading_sessions')
    .select(
      'id, started_at, ended_at, pages_read, avg_wpm, books:book_id(id, slug, title, author)',
    )
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(limit)
  return ((data as unknown as Array<
    Omit<RecentReadingSession, 'book'> & {
      books: RecentReadingSession['book'] | null
    }
  > | null) ?? []).map((r) => ({
    id: r.id,
    started_at: r.started_at,
    ended_at: r.ended_at,
    pages_read: r.pages_read,
    avg_wpm: r.avg_wpm,
    book: r.books,
  }))
}

export interface ReadingTimeStats {
  total_minutes: number
  sessions_with_pages: number
}

export async function fetchReadingTimeStats(
  userId: string,
): Promise<ReadingTimeStats> {
  const { data } = await sb()
    .from('reading_sessions')
    .select('started_at, ended_at, pages_read')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
  const rows = (data as
    | { started_at: string; ended_at: string; pages_read: number }[]
    | null) ?? []
  let totalMs = 0
  let withPages = 0
  for (const r of rows) {
    const dur =
      new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()
    if (dur > 0) totalMs += dur
    if (r.pages_read > 0) withPages++
  }
  return {
    total_minutes: Math.round(totalMs / 60000),
    sessions_with_pages: withPages,
  }
}

export interface MoodCount {
  mood: string
  count: number
}

export async function fetchMoodDistribution(
  userId: string,
  since?: string,
  until?: string,
): Promise<MoodCount[]> {
  let q = sb()
    .from('user_books')
    .select('mood_tags, finished_at')
    .eq('user_id', userId)
    .eq('status', 'finished')
    .not('mood_tags', 'is', null)
  if (since) q = q.gte('finished_at', since)
  if (until) q = q.lte('finished_at', until)
  const { data } = await q
  const rows = (data as
    | { mood_tags: string[] | null; finished_at: string | null }[]
    | null) ?? []
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (!r.mood_tags) continue
    for (const m of r.mood_tags) {
      const key = m.trim()
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([mood, count]) => ({ mood, count }))
    .sort((a, b) => b.count - a.count)
}

export interface PacePoint {
  month: string
  avg_wpm: number | null
}

export async function fetchReadingPace(
  userId: string,
  since?: string,
  until?: string,
): Promise<{ points: PacePoint[]; sessionCount: number }> {
  let q = sb()
    .from('reading_sessions')
    .select('ended_at, avg_wpm')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .not('avg_wpm', 'is', null)
    .gt('avg_wpm', 0)
  if (since) q = q.gte('ended_at', since)
  if (until) q = q.lte('ended_at', until)
  const { data } = await q
  const rows = (data as
    | { ended_at: string | null; avg_wpm: number | null }[]
    | null) ?? []
  const buckets = new Map<string, { sum: number; count: number }>()
  for (const r of rows) {
    if (!r.ended_at || r.avg_wpm == null) continue
    const d = new Date(r.ended_at)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const b = buckets.get(key) ?? { sum: 0, count: 0 }
    b.sum += r.avg_wpm
    b.count += 1
    buckets.set(key, b)
  }
  const sortedKeys = [...buckets.keys()].sort()
  const points: PacePoint[] = sortedKeys.map((k) => {
    const [year, month] = k.split('-').map(Number)
    const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
      'en-US',
      { month: 'short' },
    )
    const b = buckets.get(k)!
    return { month: label, avg_wpm: Math.round(b.sum / b.count) }
  })
  return { points, sessionCount: rows.length }
}

export interface AuthorAndFormatStats {
  top_author: { name: string; count: number } | null
  longest_book:
    | { title: string; slug: string | null; id: string; word_count: number }
    | null
  format_counts: Record<string, number>
}

export async function fetchAuthorAndFormatStats(
  userId: string,
): Promise<AuthorAndFormatStats> {
  const { data } = await sb()
    .from('user_books')
    .select(
      'format_read, books:book_id(id, slug, title, author, word_count)',
    )
    .eq('user_id', userId)
    .eq('status', 'finished')
  const rows = (data as
    | Array<{
        format_read: string | null
        books: {
          id: string
          slug: string | null
          title: string
          author: string
          word_count: number | null
        } | null
      }>
    | null) ?? []
  const authorCounts = new Map<string, number>()
  const formatCounts: Record<string, number> = {}
  let longest: AuthorAndFormatStats['longest_book'] = null
  for (const r of rows) {
    if (r.books) {
      authorCounts.set(
        r.books.author,
        (authorCounts.get(r.books.author) ?? 0) + 1,
      )
      if (
        r.books.word_count &&
        (!longest || r.books.word_count > longest.word_count)
      ) {
        longest = {
          id: r.books.id,
          slug: r.books.slug,
          title: r.books.title,
          word_count: r.books.word_count,
        }
      }
    }
    const f = (r.format_read ?? 'unknown').toLowerCase()
    formatCounts[f] = (formatCounts[f] ?? 0) + 1
  }
  let topAuthor: AuthorAndFormatStats['top_author'] = null
  for (const [name, count] of authorCounts) {
    if (!topAuthor || count > topAuthor.count) {
      topAuthor = { name, count }
    }
  }
  return { top_author: topAuthor, longest_book: longest, format_counts: formatCounts }
}

export async function fetchFinishedBooksForStats(
  userId: string,
  since?: string,
  until?: string,
): Promise<FinishedBookForStats[]> {
  let q = sb()
    .from('user_books')
    .select(
      'finished_at, rating, rating_half, books:book_id(word_count, themes)',
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
        rating_half: number | null
        books: { word_count: number | null; themes: string[] | null } | null
      }
      if (!r.finished_at) return null
      return {
        finished_at: r.finished_at,
        rating: r.rating,
        rating_half: r.rating_half,
        word_count: r.books?.word_count ?? null,
        themes: r.books?.themes ?? null,
      }
    })
    .filter((x): x is FinishedBookForStats => x !== null)
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

/**
 * Per-day reading-activity counts for the last 52 weeks. Combines
 * reading_sessions (started_at) with user_books.finished_at so a day
 * counts as active if the user opened the reader or finished a book.
 * Keyed by YYYY-MM-DD.
 */
export async function fetchReadingActivity(
  userId: string,
  weeks = 52,
): Promise<Record<string, number>> {
  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)
  const sinceIso = since.toISOString()
  const [sessionsRes, finishedRes] = await Promise.all([
    sb()
      .from('reading_sessions')
      .select('started_at')
      .eq('user_id', userId)
      .gte('started_at', sinceIso)
      .limit(5000),
    sb()
      .from('user_books')
      .select('finished_at')
      .eq('user_id', userId)
      .eq('status', 'finished')
      .gte('finished_at', sinceIso)
      .limit(2000),
  ])
  const counts: Record<string, number> = {}
  function bump(iso: string | null) {
    if (!iso) return
    const day = iso.slice(0, 10)
    counts[day] = (counts[day] ?? 0) + 1
  }
  for (const r of (sessionsRes.data ?? []) as { started_at: string | null }[]) {
    bump(r.started_at)
  }
  for (const r of (finishedRes.data ?? []) as { finished_at: string | null }[]) {
    bump(r.finished_at)
  }
  return counts
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
  rating_half: number | null
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
      'id, log_date, rating_half, review, privacy, books:book_id(id, slug, title, author, cover_url)',
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
        rating_half: r.rating_half,
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

export async function fetchProgressProfile(userId: string): Promise<{
  xp_points: number
  reading_level: string
} | null> {
  const { data } = await sb()
    .from('profiles')
    .select('xp_points, reading_level')
    .eq('id', userId)
    .maybeSingle()
  if (!data) return null
  const row = data as {
    xp_points: number | null
    reading_level: string | null
  }
  return {
    xp_points: row.xp_points ?? 0,
    reading_level: row.reading_level ?? 'bookworm',
  }
}

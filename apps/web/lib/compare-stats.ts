import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface BookSummary {
  id: string
  slug: string | null
  title: string
  author: string
  cover_url: string | null
}

export interface UserCompareStats {
  books_finished: number
  avg_rating: number | null
  current_streak: number
  longest_streak: number
  top_themes: string[]
  top_moods: string[]
  most_read_author: string | null
}

export interface CompareResult {
  viewer: UserCompareStats
  other: UserCompareStats
  shared_books: BookSummary[]
  taste_percent: number
  shared_count: number
}

interface FinishedRow {
  book_id: string
  rating_half: number | null
  mood_tags: string[] | null
  book: {
    author: string | null
    themes: string[] | null
  } | null
}

const COLS =
  'book_id, rating_half, mood_tags, book:book_id(author, themes)' as const

function topN(values: string[], n: number): string[] {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k)
}

async function fetchUserStats(userId: string): Promise<{
  stats: UserCompareStats
  bookIds: Set<string>
}> {
  const sb = await createClient()
  const [finishedRes, streakRes] = await Promise.all([
    sb
      .from('user_books')
      .select(COLS)
      .eq('user_id', userId)
      .eq('status', 'finished'),
    sb
      .from('reading_streaks')
      .select('current_streak, longest_streak')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const rows =
    (finishedRes.data as unknown as FinishedRow[] | null) ?? []
  const streak = streakRes.data as
    | { current_streak: number | null; longest_streak: number | null }
    | null

  const ratings = rows
    .map((r) => r.rating_half)
    .filter((r): r is number => typeof r === 'number')
  const avg =
    ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length / 2
      : null

  const allThemes: string[] = []
  const allMoods: string[] = []
  const authorCounts = new Map<string, number>()
  for (const r of rows) {
    for (const t of r.book?.themes ?? []) allThemes.push(t)
    for (const m of r.mood_tags ?? []) allMoods.push(m)
    const a = r.book?.author
    if (a) authorCounts.set(a, (authorCounts.get(a) ?? 0) + 1)
  }
  const mostReadAuthor = [...authorCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0]

  return {
    stats: {
      books_finished: rows.length,
      avg_rating: avg,
      current_streak: streak?.current_streak ?? 0,
      longest_streak: streak?.longest_streak ?? 0,
      top_themes: topN(allThemes, 3),
      top_moods: topN(allMoods, 3),
      most_read_author: mostReadAuthor ?? null,
    },
    bookIds: new Set(rows.map((r) => r.book_id)),
  }
}

export async function fetchCompareStats(
  viewerId: string,
  profileId: string,
): Promise<CompareResult> {
  const [viewer, other] = await Promise.all([
    fetchUserStats(viewerId),
    fetchUserStats(profileId),
  ])
  const shared: string[] = []
  for (const id of viewer.bookIds) {
    if (other.bookIds.has(id)) shared.push(id)
  }
  const total = viewer.bookIds.size + other.bookIds.size - shared.length
  const percent = total > 0 ? Math.round((shared.length / total) * 100) : 0

  let sharedBooks: BookSummary[] = []
  if (shared.length > 0) {
    const sb = await createClient()
    const { data } = await sb
      .from('books')
      .select('id, slug, title, author, cover_url')
      .in('id', shared.slice(0, 5))
    sharedBooks = (data as BookSummary[] | null) ?? []
  }

  return {
    viewer: viewer.stats,
    other: other.stats,
    shared_books: sharedBooks,
    shared_count: shared.length,
    taste_percent: percent,
  }
}

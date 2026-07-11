// AI-driven recommendations + reading-personality string.
//
// Reads user history straight from Supabase, hands it to the ai-companion
// Edge Function, and returns parsed results. Both actions are cheap to call
// occasionally but expensive at scale, the UI layer caches results per
// session (recommendations) or per-finish (personality).

import { supabase } from './supabase'

export interface RecommendedBook {
  title: string
  author: string
  reason: string
  bookId?: string // hydrated when we find a matching row in our `books` table
}

interface FinishedHistoryItem {
  title: string
  author: string
  rating: number | null
}

async function collectHistory(userId: string): Promise<{
  finishedBooks: FinishedHistoryItem[]
  topGenres: string[]
  highlightSamples: string[]
  friendsReading: FinishedHistoryItem[]
}> {
  const [finishedRes, highlightsRes, allUserBooksRes, followedRes] = await Promise.all([
    supabase
      .from('user_books')
      .select('rating, finished_at, book:books(title, author, subjects)')
      .eq('user_id', userId)
      .eq('status', 'finished')
      .order('finished_at', { ascending: false })
      .limit(10),
    supabase
      .from('highlights')
      .select('text')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    // For genre extraction we want a broader slice than just the 10 most
    // recent finishes, include reading + want_to_read too.
    supabase
      .from('user_books')
      .select('book:books(subjects)')
      .eq('user_id', userId)
      .limit(50),
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId),
  ])

  type FinishedRow = {
    rating: number | null
    book: { title: string; author: string; subjects: string[] | null } | Array<{
      title: string; author: string; subjects: string[] | null
    }> | null
  }
  const finishedRows = ((finishedRes.data ?? []) as unknown) as FinishedRow[]
  const finishedBooks: FinishedHistoryItem[] = []
  for (const r of finishedRows) {
    const b = Array.isArray(r.book) ? r.book[0] : r.book
    if (b) finishedBooks.push({ title: b.title, author: b.author, rating: r.rating ?? null })
  }

  // Tally genres across everything we have access to.
  type GenreRow = { book: { subjects: string[] | null } | Array<{ subjects: string[] | null }> | null }
  const genreCounts = new Map<string, number>()
  for (const r of ((allUserBooksRes.data ?? []) as unknown) as GenreRow[]) {
    const b = Array.isArray(r.book) ? r.book[0] : r.book
    for (const s of b?.subjects ?? []) {
      // Subjects in Gutendex come as long sentences. Take the leading
      // segment before the first separator and keep it short for the prompt.
      const root = s.split(/[\u2014\u2013\-:]/)[0].trim().slice(0, 60)
      if (!root) continue
      genreCounts.set(root, (genreCounts.get(root) ?? 0) + 1)
    }
  }
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([g]) => g)

  const highlightSamples = ((highlightsRes.data ?? []) as Array<{ text: string }>)
    .map((h) => (h.text ?? '').trim())
    .filter((t) => t.length > 0)
    .slice(0, 10)

  // Friends' active reading list, what they've started but not yet finished.
  const followedIds = ((followedRes.data ?? []) as Array<{ following_id: string }>).map(
    (r) => r.following_id,
  )
  let friendsReading: FinishedHistoryItem[] = []
  if (followedIds.length > 0) {
    const { data: friendsRows } = await supabase
      .from('user_books')
      .select('book:books(title, author)')
      .in('user_id', followedIds)
      .eq('status', 'reading')
      .limit(10)
    type FR = { book: { title: string; author: string } | Array<{ title: string; author: string }> | null }
    for (const r of ((friendsRows ?? []) as unknown) as FR[]) {
      const b = Array.isArray(r.book) ? r.book[0] : r.book
      if (b) friendsReading.push({ title: b.title, author: b.author, rating: null })
    }
  }

  return { finishedBooks, topGenres, highlightSamples, friendsReading }
}

// Calls the ai-companion 'recommendations' action and post-hydrates each
// recommendation against our local books table so the UI can route taps
// directly to /book/[id] when we already have the work.
export async function getAIRecommendations(userId: string): Promise<RecommendedBook[]> {
  const history = await collectHistory(userId)
  const { data, error } = await supabase.functions.invoke(
    'ai-companion',
    { body: { action: 'recommendations', payload: history } },
  )
  if (error) {
    console.warn('[recommendations] invoke failed:', error.message)
    return []
  }
  if (data?.error) {
    console.warn('[recommendations] handler returned error:', data.error)
    return []
  }
  const raw = (data?.result ?? '').trim()
  const text = raw.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    console.warn('[recommendations] JSON parse failed:', text.slice(0, 200))
    return []
  }
  if (!Array.isArray(parsed)) return []
  const recs = parsed
    .filter((r): r is { title: string; author: string; reason: string } =>
      !!r && typeof r === 'object' && typeof (r as { title?: unknown }).title === 'string',
    )
    .slice(0, 6)
    .map((r) => ({ title: r.title, author: r.author, reason: r.reason }))

  // Hydrate bookId where we already have the title in our catalog.
  if (recs.length > 0) {
    const titles = recs.map((r) => r.title)
    const { data: matches } = await supabase
      .from('books')
      .select('id, title')
      .in('title', titles)
    const titleToId = new Map<string, string>()
    for (const m of (matches ?? []) as Array<{ id: string; title: string }>) {
      titleToId.set(m.title, m.id)
    }
    for (const r of recs) {
      const id = titleToId.get(r.title)
      if (id) (r as RecommendedBook).bookId = id
    }
  }
  return recs
}

// Returns the prose personality string and writes it back to
// profiles.reading_personality (assumed pre-existing per the spec).
export async function refreshReadingPersonality(userId: string): Promise<string | null> {
  const history = await collectHistory(userId)
  if (history.finishedBooks.length === 0 && history.highlightSamples.length === 0) {
    return null // nothing to base it on yet
  }
  const { data, error } = await supabase.functions.invoke(
    'ai-companion',
    { body: { action: 'reading_personality', payload: history } },
  )
  if (error) {
    console.warn('[recommendations] personality invoke failed:', error.message)
    return null
  }
  if (data?.error) {
    console.warn('[recommendations] personality handler error:', data.error)
    return null
  }
  const text = (data?.result ?? '').trim()
  if (!text) return null
  await supabase
    .from('profiles')
    .update({ reading_personality: text })
    .eq('id', userId)
  return text
}

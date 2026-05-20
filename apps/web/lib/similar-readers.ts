import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface SimilarReader {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  reading_personality: string | null
  shared_count: number
}

export async function fetchSimilarReaders(
  userId: string,
  limit = 24,
): Promise<SimilarReader[]> {
  const sb = createClient()
  const { data: myBooks } = await sb
    .from('user_books')
    .select('book_id')
    .eq('user_id', userId)
    .eq('status', 'finished')
  const myBookIds = ((myBooks as { book_id: string }[] | null) ?? []).map(
    (r) => r.book_id,
  )
  if (myBookIds.length < 1) return []

  const { data: follows } = await sb
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
  const followedIds = new Set(
    ((follows as { following_id: string }[] | null) ?? []).map(
      (r) => r.following_id,
    ),
  )
  followedIds.add(userId)

  const { data: overlaps } = await sb
    .from('user_books')
    .select('user_id')
    .in('book_id', myBookIds)
    .eq('status', 'finished')
  const rows =
    (overlaps as { user_id: string }[] | null) ?? []

  const counts = new Map<string, number>()
  for (const r of rows) {
    if (followedIds.has(r.user_id)) continue
    counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1)
  }
  if (counts.size === 0) return []

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
  const candidateIds = sorted.map(([id]) => id)

  const { data: profiles } = await sb
    .from('profiles')
    .select('id, username, display_name, avatar_url, reading_personality, is_public')
    .in('id', candidateIds)
  const profileRows =
    (profiles as
      | Array<{
          id: string
          username: string
          display_name: string
          avatar_url: string | null
          reading_personality: string | null
          is_public: boolean
        }>
      | null) ?? []
  const byId = new Map(profileRows.map((p) => [p.id, p]))

  return sorted
    .map(([id, shared_count]) => {
      const p = byId.get(id)
      if (!p || !p.is_public) return null
      return {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        reading_personality: p.reading_personality,
        shared_count,
      }
    })
    .filter((r): r is SimilarReader => r !== null)
}

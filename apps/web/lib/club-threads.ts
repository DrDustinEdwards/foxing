import 'server-only'
import { createClient } from '@/lib/supabase/server'

// NOTE: club_threads keys the author as `author_id` (verified against the live
// schema), NOT `created_by`. The old `created_by` projection silently errored
// and broke the thread view -- the same column drift that bit mobile.
export interface ClubThread {
  id: string
  club_id: string
  title: string
  chapter: string | null
  is_pinned: boolean | null
  has_spoilers: boolean | null
  author_id: string
  created_at: string
  updated_at: string | null
}

export interface ClubThreadSummary extends ClubThread {
  post_count: number
  author: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

export interface ClubThreadPost {
  id: string
  thread_id: string
  author_id: string
  content: string
  has_spoiler: boolean | null
  is_removed: boolean | null
  removed_reason: string | null
  is_pinned: boolean | null
  like_count: number | null
  created_at: string
  updated_at: string | null
  parent_post_id: string | null
  author: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

const THREAD_COLS =
  'id, club_id, title, chapter, is_pinned, has_spoilers, author_id, created_at, updated_at' as const

/** Thread list for a club's Discussions tab: pinned first, newest activity next. */
export async function fetchClubThreads(
  clubId: string,
): Promise<ClubThreadSummary[]> {
  const sb = await createClient()
  const { data } = await sb
    .from('club_threads')
    .select(
      `${THREAD_COLS}, post_count, author:author_id(username, display_name, avatar_url)`,
    )
    .eq('club_id', clubId)
    .order('is_pinned', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(100)
  return (data as unknown as ClubThreadSummary[] | null) ?? []
}

export async function fetchClubThread(
  clubId: string,
  threadId: string,
): Promise<{
  thread: ClubThread
  posts: ClubThreadPost[]
  savedSet: Set<string>
} | null> {
  const sb = await createClient()
  const { data: threadRow } = await sb
    .from('club_threads')
    .select(THREAD_COLS)
    .eq('id', threadId)
    .eq('club_id', clubId)
    .maybeSingle()
  if (!threadRow) return null
  const thread = threadRow as ClubThread

  const { data: postRows } = await sb
    .from('club_posts')
    .select(
      'id, thread_id, author_id, content, has_spoiler, is_removed, removed_reason, is_pinned, like_count, created_at, updated_at, parent_post_id, author:author_id(username, display_name, avatar_url)',
    )
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  const posts = (postRows as unknown as ClubThreadPost[] | null) ?? []

  const {
    data: { user },
  } = await sb.auth.getUser()
  const savedSet = new Set<string>()
  if (user && posts.length > 0) {
    const { data: saves } = await sb
      .from('saved_posts')
      .select('post_id')
      .eq('user_id', user.id)
      .in(
        'post_id',
        posts.map((p) => p.id),
      )
    for (const r of (saves as { post_id: string }[] | null) ?? []) {
      savedSet.add(r.post_id)
    }
  }

  return { thread, posts, savedSet }
}

import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface ClubThread {
  id: string
  club_id: string
  title: string | null
  created_by: string
  created_at: string
}

export interface ClubThreadPost {
  id: string
  thread_id: string
  author_id: string
  content: string
  has_spoiler: boolean | null
  created_at: string
  updated_at: string | null
  parent_post_id: string | null
  author: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

export async function fetchClubThread(
  clubId: string,
  threadId: string,
): Promise<{
  thread: ClubThread
  posts: ClubThreadPost[]
  savedSet: Set<string>
} | null> {
  const sb = createClient()
  const { data: threadRow } = await sb
    .from('club_threads')
    .select('id, club_id, title, created_by, created_at')
    .eq('id', threadId)
    .eq('club_id', clubId)
    .maybeSingle()
  if (!threadRow) return null
  const thread = threadRow as ClubThread

  const { data: postRows } = await sb
    .from('club_posts')
    .select(
      'id, thread_id, author_id, content, has_spoiler, created_at, updated_at, parent_post_id, author:author_id(username, display_name, avatar_url)',
    )
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  const posts =
    (postRows as unknown as ClubThreadPost[] | null) ?? []

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

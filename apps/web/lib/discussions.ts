import { createClient } from '@/lib/supabase/server'
import {
  DISCUSSION_TYPES,
  DISCUSSION_TYPE_CLASSES,
  type DiscussionType,
} from '@/lib/discussion-types'

// Re-export client-safe types and constants so existing server-component
// imports from @/lib/discussions keep working unchanged. The actual
// definitions live in @/lib/discussion-types, which client components
// must import from directly to avoid pulling in supabase/server.
export { DISCUSSION_TYPES, DISCUSSION_TYPE_CLASSES, type DiscussionType }

export interface DiscussionSummary {
  id: string
  title: string
  type: DiscussionType
  spoiler_tagged: boolean
  chapter_gate: string | null
  is_pinned: boolean
  created_at: string
  updated_at: string
  author: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
  reply_count: number
  last_activity_at: string
}

export async function fetchBookDiscussions(
  bookId: string,
): Promise<DiscussionSummary[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return []
  }
  const sb = await createClient()
  const { data } = await sb
    .from('discussions')
    .select(
      'id, title, type, spoiler_tagged, chapter_gate, is_pinned, created_at, updated_at, author:author_id(username, display_name, avatar_url)',
    )
    .eq('book_id', bookId)
    .is('club_id', null)
    .order('is_pinned', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(20)
  const rows = ((data as unknown as DiscussionSummary[] | null) ?? []).map(
    (r) => ({ ...r, reply_count: 0, last_activity_at: r.updated_at }),
  )
  if (rows.length === 0) return rows

  const ids = rows.map((r) => r.id)
  const { data: posts } = await sb
    .from('discussion_posts')
    .select('discussion_id, created_at')
    .in('discussion_id', ids)
  const replyCount = new Map<string, number>()
  const lastActivity = new Map<string, string>()
  for (const p of (posts as { discussion_id: string; created_at: string }[] | null) ?? []) {
    replyCount.set(p.discussion_id, (replyCount.get(p.discussion_id) ?? 0) + 1)
    const prev = lastActivity.get(p.discussion_id)
    if (!prev || p.created_at > prev) {
      lastActivity.set(p.discussion_id, p.created_at)
    }
  }
  return rows.map((r) => ({
    ...r,
    reply_count: Math.max((replyCount.get(r.id) ?? 0) - 1, 0),
    last_activity_at: lastActivity.get(r.id) ?? r.updated_at,
  }))
}

export interface DiscussionDetail extends DiscussionSummary {
  book_id: string
}

export async function fetchDiscussion(
  discussionId: string,
): Promise<DiscussionDetail | null> {
  const sb = await createClient()
  const { data } = await sb
    .from('discussions')
    .select(
      'id, book_id, title, type, spoiler_tagged, chapter_gate, is_pinned, created_at, updated_at, author:author_id(username, display_name, avatar_url)',
    )
    .eq('id', discussionId)
    .maybeSingle()
  if (!data) return null
  const row = data as unknown as DiscussionDetail
  return {
    ...row,
    reply_count: 0,
    last_activity_at: row.updated_at,
  }
}

export interface DiscussionPost {
  id: string
  discussion_id: string
  parent_id: string | null
  author_id: string
  content: string
  has_spoiler: boolean
  is_edited: boolean
  created_at: string
  author: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

export async function fetchDiscussionPosts(
  discussionId: string,
): Promise<DiscussionPost[]> {
  const sb = await createClient()
  const { data } = await sb
    .from('discussion_posts')
    .select(
      'id, discussion_id, parent_id, author_id, content, has_spoiler, is_edited, created_at, author:author_id(username, display_name, avatar_url)',
    )
    .eq('discussion_id', discussionId)
    .order('created_at', { ascending: true })
  return (data as unknown as DiscussionPost[] | null) ?? []
}

export interface PostReactionCount {
  post_id: string
  reaction: string
  count: number
  users: string[]
}

export async function fetchReactionsForPosts(
  postIds: string[],
): Promise<Map<string, PostReactionCount[]>> {
  if (postIds.length === 0) return new Map()
  const sb = await createClient()
  const { data } = await sb
    .from('post_reactions')
    .select('post_id, user_id, reaction')
    .in('post_id', postIds)
  const buckets = new Map<string, Map<string, Set<string>>>()
  for (const r of (data as { post_id: string; user_id: string; reaction: string }[] | null) ?? []) {
    const perPost = buckets.get(r.post_id) ?? new Map<string, Set<string>>()
    const perReaction = perPost.get(r.reaction) ?? new Set<string>()
    perReaction.add(r.user_id)
    perPost.set(r.reaction, perReaction)
    buckets.set(r.post_id, perPost)
  }
  const result = new Map<string, PostReactionCount[]>()
  for (const [postId, perPost] of buckets) {
    result.set(
      postId,
      [...perPost.entries()]
        .map(([reaction, users]) => ({
          post_id: postId,
          reaction,
          count: users.size,
          users: [...users],
        }))
        .sort((a, b) => b.count - a.count),
    )
  }
  return result
}

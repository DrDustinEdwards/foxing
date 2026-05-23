// Inline passage comments, club-scoped or public discussion threaded
// against a CFI. Live schema (verified via Supabase MCP):
//
//   passage_comments(id, club_id, book_id, author_id, cfi,
//                    passage_text, comment, is_pinned, visibility,
//                    spoiler_tagged, created_at)
//
//   passage_comment_replies(id, comment_id, author_id, content,
//                           created_at)
//
//   passage_comment_reactions(comment_id, user_id, emoji, created_at)
//
// Field naming on the TS types matches the DB columns directly so the
// Supabase client's select() returns rows that satisfy our interfaces
// without aliasing. The createComment / createReply input params keep
// friendly camelCase names (the inserts remap to snake_case columns).

import { supabase } from './supabase'
import { createNotification } from './notifications'
import { enqueue } from './offline-queue'

export type CommentVisibility = 'public' | 'club'

export interface CommentAuthor {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

export interface PassageCommentReaction {
  emoji: string
  count: number
  viewerReacted: boolean
}

export interface PassageCommentReply {
  id: string
  comment_id: string
  author_id: string
  content: string
  created_at: string
  author?: CommentAuthor | null
}

export interface PassageComment {
  id: string
  book_id: string
  club_id: string | null
  author_id: string
  cfi: string
  passage_text: string | null
  comment: string
  is_pinned: boolean
  visibility: CommentVisibility
  spoiler_tagged: boolean
  created_at: string
  author?: CommentAuthor | null
  replies?: PassageCommentReply[]
  reactions?: PassageCommentReaction[]
}

// All comments visible to the viewer for this book:
//   visibility = 'public', OR
//   visibility = 'club' AND comment.club_id in the viewer's clubIds.
// One query, returned set is then partitioned on the client.
export async function listCommentsForBook(
  bookId: string,
  clubIds: string[],
): Promise<PassageComment[]> {
  // The PostgREST `or` filter expresses an OR across the two visibility
  // arms. We always include the public arm; the club arm is only added
  // when the viewer is in at least one matching club.
  const orParts = ['visibility.eq.public']
  if (clubIds.length > 0) {
    const list = clubIds.map((id) => `"${id}"`).join(',')
    orParts.push(`and(visibility.eq.club,club_id.in.(${list}))`)
  }

  const { data, error } = await supabase
    .from('passage_comments')
    .select(
      'id, book_id, club_id, author_id, cfi, passage_text, comment, is_pinned, visibility, spoiler_tagged, created_at',
    )
    .eq('book_id', bookId)
    .or(orParts.join(','))
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[passage-comments] listCommentsForBook failed:', error.message)
    return []
  }
  return ((data ?? []) as unknown) as PassageComment[]
}

// All comments AT a specific CFI, with their replies + reactions joined.
// Used by the bottom sheet that opens when the user taps a comment
// marker. Same visibility OR clause as listCommentsForBook.
export async function listCommentsAtCfi(input: {
  bookId: string
  clubIds: string[]
  cfi: string
}): Promise<PassageComment[]> {
  const { data: { user } } = await supabase.auth.getUser()
  const viewerId = user?.id ?? null

  const orParts = ['visibility.eq.public']
  if (input.clubIds.length > 0) {
    const list = input.clubIds.map((id) => `"${id}"`).join(',')
    orParts.push(`and(visibility.eq.club,club_id.in.(${list}))`)
  }

  const { data, error } = await supabase
    .from('passage_comments')
    .select(
      '*, author:profiles!author_id(id, display_name, username, avatar_url)',
    )
    .eq('book_id', input.bookId)
    .eq('cfi', input.cfi)
    .or(orParts.join(','))
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[passage-comments] listCommentsAtCfi failed:', error.message)
    return []
  }
  const comments = ((data ?? []) as unknown) as PassageComment[]
  if (comments.length === 0) return comments

  const ids = comments.map((c) => c.id)
  const [repliesRes, reactionsRes] = await Promise.all([
    supabase
      .from('passage_comment_replies')
      .select('*, author:profiles!author_id(id, display_name, username, avatar_url)')
      .in('comment_id', ids)
      .order('created_at', { ascending: true }),
    supabase
      .from('passage_comment_reactions')
      .select('comment_id, user_id, emoji')
      .in('comment_id', ids),
  ])

  const repliesByComment = new Map<string, PassageCommentReply[]>()
  for (const r of (repliesRes.data ?? []) as PassageCommentReply[]) {
    const list = repliesByComment.get(r.comment_id) ?? []
    list.push(r)
    repliesByComment.set(r.comment_id, list)
  }

  const reactionsByComment = new Map<
    string,
    Map<string, { count: number; viewerReacted: boolean }>
  >()
  for (const r of (reactionsRes.data ?? []) as Array<{
    comment_id: string
    user_id: string
    emoji: string
  }>) {
    if (!reactionsByComment.has(r.comment_id)) {
      reactionsByComment.set(r.comment_id, new Map())
    }
    const m = reactionsByComment.get(r.comment_id)!
    const cur = m.get(r.emoji) ?? { count: 0, viewerReacted: false }
    cur.count += 1
    if (viewerId && r.user_id === viewerId) cur.viewerReacted = true
    m.set(r.emoji, cur)
  }

  return comments.map((c) => ({
    ...c,
    replies: repliesByComment.get(c.id) ?? [],
    reactions: Array.from(
      reactionsByComment.get(c.id)?.entries() ?? [],
    ).map(([emoji, v]) => ({
      emoji,
      count: v.count,
      viewerReacted: v.viewerReacted,
    })),
  }))
}

export async function createComment(input: {
  bookId: string
  // Optional: required when visibility === 'club', omitted for public.
  clubId?: string | null
  cfi: string
  passageText: string
  comment: string
  visibility: CommentVisibility
  spoilerTagged: boolean
}): Promise<PassageComment | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (input.visibility === 'club' && !input.clubId) {
    console.warn('[passage-comments] createComment: club visibility requires clubId')
    return null
  }
  const insertPayload = {
    book_id: input.bookId,
    club_id: input.visibility === 'club' ? input.clubId : null,
    author_id: user.id,
    cfi: input.cfi,
    passage_text: input.passageText.slice(0, 600),
    comment: input.comment,
    visibility: input.visibility,
    spoiler_tagged: input.spoilerTagged,
  }
  const { data, error } = await supabase
    .from('passage_comments')
    .insert(insertPayload)
    .select(
      '*, author:profiles!author_id(id, display_name, username, avatar_url)',
    )
    .single()
  if (error) {
    console.warn('[passage-comments] createComment failed:', error.message)
    // Best-effort offline retry; the comment won't surface in the sheet
    // until we're back online.
    enqueue({ table: 'passage_comments', op: 'insert', data: insertPayload }).catch(() => {})
    return null
  }
  return (data as unknown) as PassageComment
}

export async function createReply(input: {
  commentId: string
  content: string
}): Promise<PassageCommentReply | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('passage_comment_replies')
    .insert({
      comment_id: input.commentId,
      author_id: user.id,
      content: input.content,
    })
    .select(
      '*, author:profiles!author_id(id, display_name, username, avatar_url)',
    )
    .single()
  if (error) {
    console.warn('[passage-comments] createReply failed:', error.message)
    return null
  }
  // Notify the original commenter (skip if replying to your own comment).
  ;(async () => {
    const { data: parent } = await supabase
      .from('passage_comments')
      .select('author_id, book_id, cfi')
      .eq('id', input.commentId)
      .maybeSingle()
    const p = parent as { author_id: string; book_id: string; cfi: string } | null
    if (!p || p.author_id === user.id) return
    const { data: me } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', user.id)
      .maybeSingle()
    const me2 = me as { display_name: string | null; username: string | null } | null
    const name = me2?.display_name ?? me2?.username ?? 'Someone'
    await createNotification(
      p.author_id,
      'passage_reply',
      'New reply on your passage',
      `${name}: ${input.content.slice(0, 120)}`,
      { book_id: p.book_id, cfi: p.cfi, comment_id: input.commentId },
    )
  })().catch(() => {})
  return (data as unknown) as PassageCommentReply
}

export async function toggleCommentReaction(
  commentId: string,
  emoji: string,
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: existing } = await supabase
    .from('passage_comment_reactions')
    .select('comment_id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .maybeSingle()
  if (existing) {
    const { error } = await supabase
      .from('passage_comment_reactions')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
    return !error
  }
  const { error } = await supabase
    .from('passage_comment_reactions')
    .insert({ comment_id: commentId, user_id: user.id, emoji })
  return !error
}

// Which of the viewer's clubs are currently reading this book. Powers
// the margin-marker fetch and the Club button on the floating pill.
export async function listMatchingClubsForBook(
  viewerId: string,
  bookId: string,
): Promise<Array<{ club_id: string; name: string }>> {
  const { data, error } = await supabase
    .from('club_members')
    .select('club_id, clubs:club_id(id, name, current_book_id)')
    .eq('user_id', viewerId)
  if (error) {
    console.warn('[passage-comments] listMatchingClubsForBook failed:', error.message)
    return []
  }
  const rows = ((data ?? []) as unknown) as Array<{
    club_id: string
    clubs:
      | { id: string; name: string; current_book_id: string | null }
      | Array<{ id: string; name: string; current_book_id: string | null }>
      | null
  }>
  return rows
    .map((m) => ({
      club_id: m.club_id,
      club: Array.isArray(m.clubs) ? m.clubs[0] : m.clubs,
    }))
    .filter((m) => m.club?.current_book_id === bookId)
    .map((m) => ({ club_id: m.club_id, name: m.club!.name }))
}

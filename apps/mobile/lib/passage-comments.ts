// Inline passage comments, club-scoped discussion threaded against a CFI.
//
// SQL SCHEMA (apply via Supabase migrations before this code returns rows):
//
//   create table passage_comments (
//     id uuid primary key default gen_random_uuid(),
//     book_id uuid not null references books(id) on delete cascade,
//     club_id uuid not null references clubs(id) on delete cascade,
//     user_id uuid not null references profiles(id),
//     cfi text not null,
//     passage_text text,
//     body text not null,
//     has_spoilers boolean not null default false,
//     created_at timestamptz not null default now()
//   );
//   create index passage_comments_book_club on passage_comments(book_id, club_id);
//   create index passage_comments_cfi on passage_comments(cfi);
//
//   create table passage_comment_replies (
//     id uuid primary key default gen_random_uuid(),
//     comment_id uuid not null references passage_comments(id) on delete cascade,
//     user_id uuid not null references profiles(id),
//     body text not null,
//     has_spoilers boolean not null default false,
//     created_at timestamptz not null default now()
//   );
//
//   create table passage_comment_reactions (
//     comment_id uuid not null references passage_comments(id) on delete cascade,
//     user_id uuid not null references profiles(id) on delete cascade,
//     emoji text not null,
//     created_at timestamptz not null default now(),
//     primary key (comment_id, user_id, emoji)
//   );

import { supabase } from './supabase'
import { createNotification } from './notifications'
import { enqueue } from './offline-queue'

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
  user_id: string
  body: string
  has_spoilers: boolean
  created_at: string
  author?: CommentAuthor | null
}

export interface PassageComment {
  id: string
  book_id: string
  club_id: string
  user_id: string
  cfi: string
  passage_text: string | null
  body: string
  has_spoilers: boolean
  created_at: string
  author?: CommentAuthor | null
  replies?: PassageCommentReply[]
  reactions?: PassageCommentReaction[]
}

// ── Reader-side: list every comment for this book across the viewer's
// matching clubs. Used to compute margin dots.
export async function listCommentsForBook(
  bookId: string,
  clubIds: string[],
): Promise<PassageComment[]> {
  if (clubIds.length === 0) return []
  const { data, error } = await supabase
    .from('passage_comments')
    .select('id, book_id, club_id, user_id, cfi, passage_text, body, has_spoilers, created_at')
    .eq('book_id', bookId)
    .in('club_id', clubIds)
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[passage-comments] listCommentsForBook failed:', error.message)
    return []
  }
  return ((data ?? []) as unknown) as PassageComment[]
}

// ── Sheet-side: list comments at a specific CFI with replies + reactions.
// We use exact CFI match here; the reader-side margin-dot path already
// resolved CFI → paragraph, so passing the comment's own cfi back round-trip
// hits its own row.
export async function listCommentsAtCfi(input: {
  bookId: string
  clubIds: string[]
  cfi: string
}): Promise<PassageComment[]> {
  if (input.clubIds.length === 0) return []
  const { data: { user } } = await supabase.auth.getUser()
  const viewerId = user?.id ?? null

  const { data, error } = await supabase
    .from('passage_comments')
    .select(
      '*, author:profiles!user_id(id, display_name, username, avatar_url)',
    )
    .eq('book_id', input.bookId)
    .in('club_id', input.clubIds)
    .eq('cfi', input.cfi)
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
      .select('*, author:profiles!user_id(id, display_name, username, avatar_url)')
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

  const reactionsByComment = new Map<string, Map<string, { count: number; viewerReacted: boolean }>>()
  for (const r of (reactionsRes.data ?? []) as Array<{
    comment_id: string; user_id: string; emoji: string
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
    reactions: Array.from(reactionsByComment.get(c.id)?.entries() ?? []).map(
      ([emoji, v]) => ({ emoji, count: v.count, viewerReacted: v.viewerReacted }),
    ),
  }))
}

export async function createComment(input: {
  bookId: string
  clubId: string
  cfi: string
  passageText: string
  body: string
  hasSpoilers: boolean
}): Promise<PassageComment | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const insertPayload = {
    book_id: input.bookId,
    club_id: input.clubId,
    user_id: user.id,
    cfi: input.cfi,
    passage_text: input.passageText.slice(0, 600),
    body: input.body,
    has_spoilers: input.hasSpoilers,
  }
  const { data, error } = await supabase
    .from('passage_comments')
    .insert(insertPayload)
    .select('*, author:profiles!user_id(id, display_name, username, avatar_url)')
    .single()
  if (error) {
    console.warn('[passage-comments] createComment failed:', error.message)
    // Queue for retry on reconnect, the comment won't show in the sheet
    // immediately, but it'll land once we're back online.
    enqueue({ table: 'passage_comments', op: 'insert', data: insertPayload }).catch(() => {})
    return null
  }
  return (data as unknown) as PassageComment
}

export async function createReply(input: {
  commentId: string
  body: string
  hasSpoilers: boolean
}): Promise<PassageCommentReply | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('passage_comment_replies')
    .insert({
      comment_id: input.commentId,
      user_id: user.id,
      body: input.body,
      has_spoilers: input.hasSpoilers,
    })
    .select('*, author:profiles!user_id(id, display_name, username, avatar_url)')
    .single()
  if (error) {
    console.warn('[passage-comments] createReply failed:', error.message)
    return null
  }
  // Notify the commenter (skip if replying to your own comment).
  ;(async () => {
    const { data: parent } = await supabase
      .from('passage_comments')
      .select('user_id, book_id, cfi')
      .eq('id', input.commentId)
      .maybeSingle()
    const p = parent as { user_id: string; book_id: string; cfi: string } | null
    if (!p || p.user_id === user.id) return
    const { data: me } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', user.id)
      .maybeSingle()
    const me2 = me as { display_name: string | null; username: string | null } | null
    const name = me2?.display_name ?? me2?.username ?? 'Someone'
    await createNotification(
      p.user_id,
      'passage_reply',
      'New reply on your passage',
      `${name}: ${input.body.slice(0, 120)}`,
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

// ── Reader-open: which of the viewer's clubs are currently reading this book.
// Powers both the margin-dot fetch and the Club button visibility on the pill.
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
  // Supabase relation typing varies between client versions (single object
  // vs array). Normalize through `unknown` and accept either shape so we
  // don't fight the generated types here.
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

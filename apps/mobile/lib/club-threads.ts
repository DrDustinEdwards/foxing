import { type ClubPost, type ClubThread, fetchProfilesByIds } from './clubs'
import { supabase } from './supabase'
import { enqueue } from './offline-queue'
import { checkAndAwardBadges } from './streaks'
import { createNotification } from './notifications'

export async function fetchThreads(clubId: string): Promise<ClubThread[]> {
  const { data, error } = await supabase
    .from('club_threads')
    .select('*')
    .eq('club_id', clubId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[clubs] fetchThreads failed:', error.message)
    return []
  }
  const threads = ((data ?? []) as unknown) as ClubThread[]
  const authors = await fetchProfilesByIds(threads.map((t) => t.author_id))
  return threads.map((t) => ({ ...t, author: authors.get(t.author_id) ?? null }))
}

export async function fetchThread(threadId: string): Promise<ClubThread | null> {
  const { data, error } = await supabase
    .from('club_threads')
    .select('*')
    .eq('id', threadId)
    .maybeSingle()
  if (error) {
    console.warn('[clubs] fetchThread failed:', error.message)
    return null
  }
  if (!data) return null
  const thread = (data as unknown) as ClubThread
  const authors = await fetchProfilesByIds([thread.author_id])
  return { ...thread, author: authors.get(thread.author_id) ?? null }
}

export async function createThread(input: {
  clubId: string
  title: string
  chapter?: string | null
  openingPost?: string
  hasSpoilers?: boolean
}): Promise<ClubThread | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // is_ai_starter is intentionally NOT set here: it is reserved for the future
  // P2.9 AI-starter feature, where the ai-companion edge function is the only
  // writer that sets it true. User-created threads leave it at its false default.
  const { data, error } = await supabase
    .from('club_threads')
    .insert({
      club_id: input.clubId,
      title: input.title,
      chapter: input.chapter ?? null,
      author_id: user.id,
      has_spoilers: !!input.hasSpoilers,
    })
    .select()
    .single()
  if (error) {
    console.warn('[clubs] createThread failed:', error.message)
    return null
  }
  if (input.openingPost?.trim()) {
    await createPost({
      threadId: data.id,
      body: input.openingPost.trim(),
      hasSpoilers: !!input.hasSpoilers,
    })
  }
  return data as ClubThread
}

// Returns posts in chronological order with reactions hydrated for the
// current viewer. Caller is responsible for parent → child arrangement
// (we render one level of nesting client-side).
export async function fetchPosts(threadId: string): Promise<ClubPost[]> {
  const { data: { user } } = await supabase.auth.getUser()
  const viewerId = user?.id ?? null

  const { data, error } = await supabase
    .from('club_posts')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[clubs] fetchPosts failed:', error.message)
    return []
  }
  const posts = ((data ?? []) as unknown) as ClubPost[]
  if (posts.length === 0) return posts

  const authors = await fetchProfilesByIds(posts.map((p) => p.author_id))

  // Hydrate reactions in one query, group client-side.
  const ids = posts.map((p) => p.id)
  const { data: reacts } = await supabase
    .from('club_post_reactions')
    .select('post_id, user_id, emoji')
    .in('post_id', ids)
  const byPost = new Map<string, Map<string, { count: number; viewerReacted: boolean }>>()
  for (const r of (reacts ?? []) as Array<{ post_id: string; user_id: string; emoji: string }>) {
    if (!byPost.has(r.post_id)) byPost.set(r.post_id, new Map())
    const m = byPost.get(r.post_id)!
    const cur = m.get(r.emoji) ?? { count: 0, viewerReacted: false }
    cur.count += 1
    if (viewerId && r.user_id === viewerId) cur.viewerReacted = true
    m.set(r.emoji, cur)
  }
  return posts.map((p) => ({
    ...p,
    author: authors.get(p.author_id) ?? null,
    reactions: Array.from(byPost.get(p.id)?.entries() ?? []).map(([emoji, v]) => ({
      emoji,
      count: v.count,
      viewerReacted: v.viewerReacted,
    })),
  }))
}

export async function createPost(input: {
  threadId: string
  parentPostId?: string | null
  body: string
  hasSpoilers?: boolean
}): Promise<ClubPost | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const insertPayload = {
    thread_id: input.threadId,
    parent_post_id: input.parentPostId ?? null,
    author_id: user.id,
    content: input.body,
    has_spoiler: !!input.hasSpoilers,
  }
  const { data, error } = await supabase
    .from('club_posts')
    .insert(insertPayload)
    .select('*')
    .single()
  if (error) {
    console.warn('[clubs] createPost failed:', error.message)
    // Queue for retry on reconnect.
    enqueue({ table: 'club_posts', op: 'insert', data: insertPayload }).catch(() => {})
    return null
  }
  // first_discussion badge unlock
  checkAndAwardBadges(user.id).catch(() => {})
  const post = (data as unknown) as ClubPost
  const authors = await fetchProfilesByIds([post.author_id])
  return { ...post, author: authors.get(post.author_id) ?? null }
}

export async function savePost(postId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase
    .from('saved_posts')
    .insert({ user_id: user.id, post_id: postId })
  if (error && !error.message.includes('duplicate')) {
    console.warn('[clubs] savePost failed:', error.message)
    return false
  }
  return true
}

// Notify all OTHER members of a club that one of them just finished the
// current book. Use after user_books goes to status='finished'. Skips the
// finisher themselves; iterates clubs server-side filter to clubs reading
// the book.
export async function notifyClubMembersOfFinish(input: {
  finisherUserId: string
  bookId: string
  bookTitle: string
}): Promise<void> {
  try {
    const { data: clubs } = await supabase
      .from('clubs')
      .select('id, name')
      .eq('current_book_id', input.bookId)
    if (!clubs || clubs.length === 0) return
    // Look up the finisher's display name in one query.
    const { data: prof } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', input.finisherUserId)
      .maybeSingle()
    const finisherName =
      ((prof as { display_name?: string | null; username?: string | null } | null)?.display_name)
      ?? ((prof as { username?: string | null } | null)?.username)
      ?? 'Someone'
    const mod = await import('./notifications')
    for (const c of clubs as Array<{ id: string; name: string }>) {
      const { data: members } = await supabase
        .from('club_members')
        .select('user_id')
        .eq('club_id', c.id)
        .neq('user_id', input.finisherUserId)
      for (const m of (members ?? []) as Array<{ user_id: string }>) {
        await mod.createNotification(
          m.user_id,
          'member_finished',
          `${finisherName} just finished ${input.bookTitle}!`,
          `See their thoughts in ${c.name}.`,
          { book_id: input.bookId, club_id: c.id, finisher_id: input.finisherUserId },
        )
      }
    }
  } catch (e) {
    console.warn('[clubs] notifyClubMembersOfFinish failed:', e instanceof Error ? e.message : e)
  }
}

// Notify all members of a club that a scheduled chapter just unlocked.
// Caller passes the chapter label that just opened.
export async function notifyChapterUnlock(input: {
  clubId: string
  chapterName: string
}): Promise<void> {
  try {
    const { data: club } = await supabase
      .from('clubs')
      .select('name')
      .eq('id', input.clubId)
      .maybeSingle()
    const clubName = (club as { name?: string } | null)?.name ?? 'your club'
    const { data: members } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', input.clubId)
    if (!members || members.length === 0) return
    const mod = await import('./notifications')
    for (const m of members as Array<{ user_id: string }>) {
      await mod.createNotification(
        m.user_id,
        'chapter_unlock',
        `New chapter unlocked in ${clubName}`,
        `${input.chapterName} is now open for discussion.`,
        { club_id: input.clubId, chapter_name: input.chapterName },
      )
    }
  } catch (e) {
    console.warn('[clubs] notifyChapterUnlock failed:', e instanceof Error ? e.message : e)
  }
}

export async function reportPost(postId: string, reason: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase
    .from('post_reports')
    .insert({
      post_id: postId,
      reporter_id: user.id,
      reason,
      post_type: 'club_post',
    })
  if (error) {
    // Duplicate report from same user is non-fatal.
    if (error.code === '23505') return true
    console.warn('[clubs] reportPost failed:', error.message)
    return false
  }
  return true
}

export async function toggleReaction(postId: string, emoji: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: existing } = await supabase
    .from('club_post_reactions')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .maybeSingle()
  if (existing) {
    const { error } = await supabase
      .from('club_post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
    return !error
  }
  const { error } = await supabase
    .from('club_post_reactions')
    .insert({ post_id: postId, user_id: user.id, emoji })
  if (error) return false
  // Notify the post owner (skip self-reactions).
  ;(async () => {
    const { data: post } = await supabase
      .from('club_posts')
      .select('author_id, thread_id, thread:club_threads!thread_id(club_id, title)')
      .eq('id', postId)
      .maybeSingle()
    const p = post as
      | {
          author_id: string
          thread_id: string
          thread:
            | { club_id: string; title: string }
            | Array<{ club_id: string; title: string }>
            | null
        }
      | null
    if (!p || p.author_id === user.id) return
    const thread = Array.isArray(p.thread) ? p.thread[0] : p.thread
    await createNotification(
      p.author_id,
      'post_reaction',
      `Someone reacted ${emoji}`,
      thread?.title ? `On "${thread.title}"` : null,
      {
        club_id: thread?.club_id,
        thread_id: p.thread_id,
        post_id: postId,
        emoji,
      },
    )
  })().catch(() => {})
  return true
}

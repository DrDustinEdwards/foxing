'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/nav-user'
import {
  extractMentionHandles,
  resolveMentionedMembers,
} from '@/lib/club-notify'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function createClubPostReply(
  formData: FormData,
): Promise<ActionResult> {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const parentPostId =
    String(formData.get('parent_post_id') ?? '').trim() || null
  const content = String(formData.get('content') ?? '').trim().slice(0, 5000)
  const hasSpoiler = formData.get('has_spoiler') === 'on'
  if (!threadId || !content) {
    return { ok: false, error: 'Reply text is required.' }
  }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { data: thread } = await sb
    .from('club_threads')
    .select('club_id, author_id, title')
    .eq('id', threadId)
    .maybeSingle()
  const threadRow = thread as
    | { club_id: string | null; author_id: string | null; title: string | null }
    | null
  const clubId = threadRow?.club_id
  if (!clubId) return { ok: false, error: 'Thread not found.' }
  const { data: member } = await sb
    .from('club_members')
    .select('status')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!member || (member as { status: string | null }).status !== 'active') {
    return { ok: false, error: 'Only active members can reply.' }
  }
  const { data: inserted, error } = await sb
    .from('club_posts')
    .insert({
      thread_id: threadId,
      author_id: userId,
      content,
      has_spoiler: hasSpoiler,
      parent_post_id: parentPostId,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  const postId = (inserted as { id: string }).id
  const { data: club } = await sb
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const slug = (club as { slug: string | null } | null)?.slug

  await notifyReplyAndMentions({
    clubId,
    slug: slug ?? null,
    threadId,
    postId,
    parentPostId,
    content,
    actorId: userId,
    threadAuthorId: threadRow?.author_id ?? null,
  })

  if (slug) {
    revalidatePath(`/clubs/${slug}/threads/${threadId}`)
    revalidatePath(`/clubs/${slug}`)
  }
  return { ok: true }
}

// Notify the person replied-to (the parent comment's author, or the thread
// author for a top-level reply) plus any @mentioned active members. Each
// recipient gets at most one row -- a mention supersedes the reply ping --
// and the actor never notifies themselves. Uses the admin client because the
// recipients are other users (RLS only allows self-inserts).
async function notifyReplyAndMentions(args: {
  clubId: string
  slug: string | null
  threadId: string
  postId: string
  parentPostId: string | null
  content: string
  actorId: string
  threadAuthorId: string | null
}): Promise<void> {
  const admin = createAdminClient()

  let replyTargetId: string | null = null
  if (args.parentPostId) {
    const { data: parent } = await admin
      .from('club_posts')
      .select('author_id')
      .eq('id', args.parentPostId)
      .maybeSingle()
    replyTargetId = (parent as { author_id: string | null } | null)?.author_id ?? null
  } else {
    replyTargetId = args.threadAuthorId
  }

  const { data: actor } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', args.actorId)
    .maybeSingle()
  const actorName =
    (actor as { display_name: string | null } | null)?.display_name ?? 'A member'
  const snippet = args.content.slice(0, 140)
  const href = args.slug
    ? `/clubs/${args.slug}/threads/${args.threadId}`
    : undefined
  const data = {
    club_id: args.clubId,
    club_slug: args.slug,
    thread_id: args.threadId,
    post_id: args.postId,
    ...(href ? { href } : {}),
  }

  const rows = new Map<
    string,
    { user_id: string; type: string; title: string; body: string; data: typeof data }
  >()
  if (replyTargetId && replyTargetId !== args.actorId) {
    rows.set(replyTargetId, {
      user_id: replyTargetId,
      type: 'club_reply',
      title: `${actorName} replied to your ${args.parentPostId ? 'comment' : 'thread'}`,
      body: snippet,
      data,
    })
  }
  const mentioned = await resolveMentionedMembers(
    admin,
    args.clubId,
    extractMentionHandles(args.content),
    args.actorId,
  )
  for (const m of mentioned) {
    rows.set(m.user_id, {
      user_id: m.user_id,
      type: 'club_mention',
      title: `${actorName} mentioned you`,
      body: snippet,
      data,
    })
  }
  if (rows.size > 0) {
    await admin.from('notifications').insert([...rows.values()])
  }
}

export async function updateClubPost(
  formData: FormData,
): Promise<ActionResult> {
  const postId = String(formData.get('post_id') ?? '').trim()
  const content = String(formData.get('content') ?? '').trim().slice(0, 5000)
  if (!postId || !content) {
    return { ok: false, error: 'Content is required.' }
  }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { error } = await sb
    .from('club_posts')
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('author_id', userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// Toggle the viewer's like on a club post. Uses the user-scoped client so RLS
// enforces club membership on insert (with_check joins club_posts->club_threads
// and calls private.is_club_member). The trg_club_post_like_count trigger keeps
// club_posts.like_count correct, so the client reconciles its own optimistic
// count on next load.
export async function toggleClubPostLike(
  formData: FormData,
): Promise<{ ok: true; liked: boolean } | { ok: false; error: string }> {
  const postId = String(formData.get('post_id') ?? '').trim()
  if (!postId) return { ok: false, error: 'Missing id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { data: existing } = await sb
    .from('club_post_likes')
    .select('post_id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .maybeSingle()
  if (existing) {
    const { error } = await sb
      .from('club_post_likes')
      .delete()
      .eq('user_id', userId)
      .eq('post_id', postId)
    if (error) return { ok: false, error: error.message }
    return { ok: true, liked: false }
  }
  const { error } = await sb
    .from('club_post_likes')
    .insert({ post_id: postId, user_id: userId })
  if (error) return { ok: false, error: error.message }
  return { ok: true, liked: true }
}

export async function unsaveOwnClubPost(
  formData: FormData,
): Promise<ActionResult> {
  const postId = String(formData.get('post_id') ?? '').trim()
  if (!postId) return { ok: false, error: 'Missing id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { error } = await sb
    .from('saved_posts')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

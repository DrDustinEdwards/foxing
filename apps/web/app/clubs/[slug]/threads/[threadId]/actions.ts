'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthedUserId } from '@/lib/nav-user'

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
    .select('club_id')
    .eq('id', threadId)
    .maybeSingle()
  const clubId = (thread as { club_id: string | null } | null)?.club_id
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
  const { error } = await sb.from('club_posts').insert({
    thread_id: threadId,
    author_id: userId,
    content,
    has_spoiler: hasSpoiler,
    parent_post_id: parentPostId,
  })
  if (error) return { ok: false, error: error.message }
  const { data: club } = await sb
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const slug = (club as { slug: string | null } | null)?.slug
  if (slug) {
    revalidatePath(`/clubs/${slug}/threads/${threadId}`)
    revalidatePath(`/clubs/${slug}`)
  }
  return { ok: true }
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

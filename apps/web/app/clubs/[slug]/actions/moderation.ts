'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/nav-user'
import { type ActionResult, assertMod } from './_shared'

const REPORT_REASONS = new Set([
  'spam',
  'harassment',
  'spoilers',
  'offensive',
  'other',
])

export async function saveClubPost(
  formData: FormData,
): Promise<ActionResult> {
  const postId = String(formData.get('post_id') ?? '').trim()
  if (!postId) return { ok: false, error: 'Missing id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('saved_posts')
    .upsert(
      { user_id: userId, post_id: postId },
      { onConflict: 'user_id,post_id', ignoreDuplicates: true },
    )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/saved-posts')
  return { ok: true }
}

export async function unsaveClubPost(
  formData: FormData,
): Promise<ActionResult> {
  const postId = String(formData.get('post_id') ?? '').trim()
  if (!postId) return { ok: false, error: 'Missing id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('saved_posts')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/saved-posts')
  return { ok: true }
}

export async function reportClubPost(
  formData: FormData,
): Promise<ActionResult> {
  const postId = String(formData.get('post_id') ?? '').trim()
  const reasonRaw = String(formData.get('reason') ?? '').trim()
  if (!postId || !REPORT_REASONS.has(reasonRaw)) {
    return { ok: false, error: 'Pick a reason.' }
  }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('post_reports')
    .upsert(
      {
        post_id: postId,
        reporter_id: userId,
        reason: reasonRaw,
        post_type: 'club_post',
      },
      { onConflict: 'post_id,reporter_id', ignoreDuplicates: true },
    )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function dismissReport(
  formData: FormData,
): Promise<ActionResult> {
  const reportId = String(formData.get('report_id') ?? '').trim()
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!reportId || !clubId) return { ok: false, error: 'Missing fields.' }
  const auth = await assertMod(clubId)
  if (!auth.ok) return auth
  const admin = createAdminClient()
  const { error } = await admin
    .from('post_reports')
    .update({
      status: 'dismissed',
      reviewed_by: auth.actorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', reportId)
  if (error) return { ok: false, error: error.message }
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const clubSlug = (club as { slug: string | null } | null)?.slug
  if (clubSlug) revalidatePath(`/clubs/${clubSlug}`)
  return { ok: true }
}

export async function actionReport(
  formData: FormData,
): Promise<ActionResult> {
  const reportId = String(formData.get('report_id') ?? '').trim()
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!reportId || !clubId) return { ok: false, error: 'Missing fields.' }
  const auth = await assertMod(clubId)
  if (!auth.ok) return auth
  const admin = createAdminClient()
  await admin
    .from('post_reports')
    .update({
      status: 'actioned',
      reviewed_by: auth.actorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', reportId)
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const clubSlug = (club as { slug: string | null } | null)?.slug
  if (clubSlug) revalidatePath(`/clubs/${clubSlug}`)
  return { ok: true }
}

export async function removeClubPost(
  formData: FormData,
): Promise<ActionResult> {
  const postId = String(formData.get('post_id') ?? '').trim()
  const clubId = String(formData.get('club_id') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500) || null
  if (!postId || !clubId) return { ok: false, error: 'Missing fields.' }
  const auth = await assertMod(clubId)
  if (!auth.ok) return auth
  const admin = createAdminClient()
  // Confirm the post's thread belongs to this club before a mod of this club
  // can remove it (club_posts carries no club_id of its own).
  const { data: postRow } = await admin
    .from('club_posts')
    .select('thread_id')
    .eq('id', postId)
    .maybeSingle()
  const threadId = (postRow as { thread_id: string | null } | null)?.thread_id
  if (!threadId) return { ok: false, error: 'Post not found.' }
  const { data: threadRow } = await admin
    .from('club_threads')
    .select('club_id')
    .eq('id', threadId)
    .maybeSingle()
  const postClubId = (threadRow as { club_id: string | null } | null)?.club_id
  if (postClubId !== clubId) return { ok: false, error: 'Post not in this club.' }
  const { error } = await admin
    .from('club_posts')
    .update({
      is_removed: true,
      removed_at: new Date().toISOString(),
      removed_by: auth.actorId,
      removed_reason: reason,
    })
    .eq('id', postId)
  if (error) return { ok: false, error: error.message }
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const clubSlug = (club as { slug: string | null } | null)?.slug
  if (clubSlug) revalidatePath(`/clubs/${clubSlug}`)
  return { ok: true }
}

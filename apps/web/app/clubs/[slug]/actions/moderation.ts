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

// Resolve the club a report belongs to. post_reports carries no club_id of
// its own, so ownership must be derived from the reported entity (mirrors the
// thread->club hop in removeClubPost). Returns null if the report or its
// entity is missing, or the report type is unknown.
//
// NOTE: the join chains here are schema-verified (post_reports.post_id keys
// club_posts.id / passage_comments.id; club_posts.thread_id -> club_threads
// .club_id; passage_comments.club_id is direct), but post_reports is empty in
// production, so this has NOT been verified against a real report. Data-level
// verification is pending the first actual report row.
async function resolveReportClubId(
  admin: ReturnType<typeof createAdminClient>,
  reportId: string,
): Promise<string | null> {
  const { data: report } = await admin
    .from('post_reports')
    .select('post_id, post_type')
    .eq('id', reportId)
    .maybeSingle()
  const row =
    (report as { post_id: string | null; post_type: string | null } | null) ??
    null
  if (!row?.post_id) return null

  if (row.post_type === 'passage_comment') {
    const { data: comment } = await admin
      .from('passage_comments')
      .select('club_id')
      .eq('id', row.post_id)
      .maybeSingle()
    return (comment as { club_id: string | null } | null)?.club_id ?? null
  }

  if (row.post_type === 'club_post') {
    const { data: postRow } = await admin
      .from('club_posts')
      .select('thread_id')
      .eq('id', row.post_id)
      .maybeSingle()
    const threadId = (postRow as { thread_id: string | null } | null)?.thread_id
    if (!threadId) return null
    const { data: threadRow } = await admin
      .from('club_threads')
      .select('club_id')
      .eq('id', threadId)
      .maybeSingle()
    return (threadRow as { club_id: string | null } | null)?.club_id ?? null
  }

  return null
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
  const reportClubId = await resolveReportClubId(admin, reportId)
  if (!reportClubId) return { ok: false, error: 'Report not found.' }
  if (reportClubId !== clubId) {
    return { ok: false, error: 'Report not in this club.' }
  }
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
  const reportClubId = await resolveReportClubId(admin, reportId)
  if (!reportClubId) return { ok: false, error: 'Report not found.' }
  if (reportClubId !== clubId) {
    return { ok: false, error: 'Report not in this club.' }
  }
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

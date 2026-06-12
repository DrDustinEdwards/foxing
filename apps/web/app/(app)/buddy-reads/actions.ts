'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/nav-user'
import { checkAndAwardBadges } from '@/lib/badges'

type ActionResult = { ok: true } | { ok: false; error: string }

async function isPlus(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle()
  const tier = (data as { subscription_tier: string | null } | null)
    ?.subscription_tier
  return tier === 'plus'
}

export async function createBuddyRead(formData: FormData): Promise<void> {
  const bookId = String(formData.get('book_id') ?? '').trim()
  const partnerId = String(formData.get('partner_id') ?? '').trim()
  if (!bookId || !partnerId) {
    throw new Error('Book and partner are required.')
  }
  const userId = await getAuthedUserId()
  if (!userId) throw new Error('Sign in required.')
  if (partnerId === userId) {
    throw new Error('Pick someone else to buddy read with.')
  }
  if (!(await isPlus(userId))) {
    throw new Error('Buddy reads are a Plus feature.')
  }

  const sb = await createClient()
  const { data, error } = await sb
    .from('buddy_reads')
    .insert({
      book_id: bookId,
      user1_id: userId,
      user2_id: partnerId,
      started_at: new Date().toISOString(),
      is_active: true,
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(error?.message ?? 'Could not start buddy read.')
  }
  revalidatePath('/buddy-reads')
  redirect(`/buddy-reads/${(data as { id: string }).id}`)
}

async function assertBuddyMember(
  buddyReadId: string,
  userId: string,
): Promise<{ ok: true; clubId: string } | { ok: false; error: string }> {
  const sb = await createClient()
  const { data } = await sb
    .from('buddy_reads')
    .select('id, user1_id, user2_id, is_active')
    .eq('id', buddyReadId)
    .maybeSingle()
  const row = data as
    | { id: string; user1_id: string; user2_id: string; is_active: boolean | null }
    | null
  if (!row) return { ok: false, error: 'Buddy read not found.' }
  if (row.user1_id !== userId && row.user2_id !== userId) {
    return { ok: false, error: 'You are not in this buddy read.' }
  }
  if (!row.is_active) {
    return { ok: false, error: 'This buddy read is finished.' }
  }
  return { ok: true, clubId: row.id }
}

export async function createBuddyReadPost(
  formData: FormData,
): Promise<ActionResult> {
  const buddyReadId = String(formData.get('buddy_read_id') ?? '').trim()
  const content = String(formData.get('content') ?? '').trim().slice(0, 3000)
  const pageRaw = String(formData.get('page_number') ?? '').trim()
  const chapter = String(formData.get('chapter') ?? '').trim().slice(0, 80) || null
  const hasSpoiler = formData.get('has_spoiler') === 'on'
  if (!buddyReadId || !content) {
    return { ok: false, error: 'Content is required.' }
  }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const check = await assertBuddyMember(buddyReadId, userId)
  if (!check.ok) return check
  const pageNumber =
    pageRaw && Number.isInteger(Number(pageRaw)) && Number(pageRaw) > 0
      ? Number(pageRaw)
      : null

  const sb = await createClient()
  const { error } = await sb.from('buddy_read_posts').insert({
    buddy_read_id: buddyReadId,
    author_id: userId,
    content,
    page_number: pageNumber,
    chapter,
    has_spoiler: hasSpoiler,
  })
  if (error) return { ok: false, error: error.message }
  await checkAndAwardBadges(userId)
  revalidatePath(`/buddy-reads/${buddyReadId}`)
  return { ok: true }
}

export async function deleteBuddyReadPost(
  formData: FormData,
): Promise<ActionResult> {
  const postId = String(formData.get('post_id') ?? '').trim()
  const buddyReadId = String(formData.get('buddy_read_id') ?? '').trim()
  if (!postId || !buddyReadId) return { ok: false, error: 'Missing fields.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { data: post } = await sb
    .from('buddy_read_posts')
    .select('author_id')
    .eq('id', postId)
    .maybeSingle()
  const row = post as { author_id: string } | null
  if (!row) return { ok: false, error: 'Post not found.' }
  if (row.author_id !== userId) {
    return { ok: false, error: 'You can only delete your own posts.' }
  }
  const { error } = await sb.from('buddy_read_posts').delete().eq('id', postId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/buddy-reads/${buddyReadId}`)
  return { ok: true }
}

export async function finishBuddyRead(
  formData: FormData,
): Promise<ActionResult> {
  const buddyReadId = String(formData.get('buddy_read_id') ?? '').trim()
  if (!buddyReadId) return { ok: false, error: 'Missing id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { data: row } = await sb
    .from('buddy_reads')
    .select('user1_id, user2_id')
    .eq('id', buddyReadId)
    .maybeSingle()
  const br = row as { user1_id: string; user2_id: string } | null
  if (!br) return { ok: false, error: 'Buddy read not found.' }
  if (br.user1_id !== userId && br.user2_id !== userId) {
    return { ok: false, error: 'You are not in this buddy read.' }
  }
  const { error } = await sb
    .from('buddy_reads')
    .update({ is_active: false })
    .eq('id', buddyReadId)
  if (error) return { ok: false, error: error.message }
  await checkAndAwardBadges(userId)
  revalidatePath('/buddy-reads')
  revalidatePath(`/buddy-reads/${buddyReadId}`)
  return { ok: true }
}

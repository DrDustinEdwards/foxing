'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/nav-user'
import { reportWriteError } from '@/lib/db-write'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function enterGiveaway(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const giveawayId = String(formData.get('giveaway_id') ?? '').trim()
  if (!giveawayId) return { ok: false, error: 'Missing giveaway.' }
  const admin = createAdminClient()
  const { data: g } = await admin
    .from('giveaways')
    .select('id, deadline, winner_picked_at')
    .eq('id', giveawayId)
    .maybeSingle()
  if (!g) return { ok: false, error: 'Giveaway not found.' }
  const row = g as {
    deadline: string
    winner_picked_at: string | null
  }
  if (row.winner_picked_at || new Date(row.deadline) < new Date()) {
    return { ok: false, error: 'This giveaway has ended.' }
  }
  const { error } = await admin
    .from('giveaway_entries')
    .insert({ giveaway_id: giveawayId, user_id: userId })
  if (error && !error.message.toLowerCase().includes('duplicate')) {
    return { ok: false, error: error.message }
  }
  revalidatePath('/giveaways')
  revalidatePath(`/giveaways/${giveawayId}`)
  return { ok: true }
}

export async function createGiveaway(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { data: me } = await sb
    .from('profiles')
    .select('is_verified_author')
    .eq('id', userId)
    .maybeSingle()
  if (!(me as { is_verified_author: boolean | null } | null)?.is_verified_author) {
    return { ok: false, error: 'Verified authors only.' }
  }

  const title = String(formData.get('title') ?? '').trim().slice(0, 120)
  const description = String(formData.get('description') ?? '').trim().slice(0, 2000) || null
  const bookId = String(formData.get('book_id') ?? '').trim() || null
  const kindRaw = String(formData.get('kind') ?? 'digital').trim()
  const kind = kindRaw === 'physical' ? 'physical' : 'digital'
  const prizeCount = Math.max(1, Math.min(100, Number(formData.get('prize_count') ?? 1)))
  const deadline = String(formData.get('deadline') ?? '').trim()
  if (!title || !deadline) {
    return { ok: false, error: 'Title and deadline required.' }
  }
  const deadlineDate = new Date(deadline)
  if (!Number.isFinite(deadlineDate.getTime()) || deadlineDate <= new Date()) {
    return { ok: false, error: 'Deadline must be in the future.' }
  }

  const { error } = await sb.from('giveaways').insert({
    author_user_id: userId,
    title,
    description,
    book_id: bookId,
    kind,
    prize_count: prizeCount,
    deadline: deadlineDate.toISOString(),
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/giveaways')
  revalidatePath('/author-dashboard')
  return { ok: true }
}

export async function pickGiveawayWinners(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const admin = createAdminClient()
  const { data: me } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()
  if (!(me as { is_admin: boolean | null } | null)?.is_admin) {
    return { ok: false, error: 'Admin only.' }
  }
  const giveawayId = String(formData.get('giveaway_id') ?? '').trim()
  if (!giveawayId) return { ok: false, error: 'Missing giveaway.' }

  const { data: g } = await admin
    .from('giveaways')
    .select('prize_count, winner_picked_at')
    .eq('id', giveawayId)
    .maybeSingle()
  const row = g as
    | { prize_count: number | null; winner_picked_at: string | null }
    | null
  if (!row) return { ok: false, error: 'Not found.' }
  if (row.winner_picked_at) {
    return { ok: false, error: 'Winners already picked.' }
  }
  const prizeCount = Math.max(1, row.prize_count ?? 1)

  const { data: entryRows } = await admin
    .from('giveaway_entries')
    .select('id, user_id')
    .eq('giveaway_id', giveawayId)
  const entries =
    (entryRows as { id: string; user_id: string }[] | null) ?? []
  if (entries.length === 0) {
    return { ok: false, error: 'No entries to pick from.' }
  }
  const shuffled = [...entries].sort(() => Math.random() - 0.5)
  const winners = shuffled.slice(0, prizeCount)
  const winnerIds = winners.map((w) => w.id)
  if (winnerIds.length > 0) {
    const { error } = await admin
      .from('giveaway_entries')
      .update({ won: true })
      .in('id', winnerIds)
    if (error) return { ok: false, error: error.message }
  }
  const { error: markError } = await admin
    .from('giveaways')
    .update({ winner_picked_at: new Date().toISOString() })
    .eq('id', giveawayId)
  // If this write fails the giveaway still looks open and winners could be re-picked.
  if (reportWriteError(markError, { op: 'pickGiveawayWinners.markPicked', table: 'giveaways' })) {
    return { ok: false, error: 'Winners were marked but the giveaway could not be closed. Retry.' }
  }
  revalidatePath('/admin/giveaways')
  revalidatePath('/giveaways')
  revalidatePath(`/giveaways/${giveawayId}`)
  return { ok: true }
}

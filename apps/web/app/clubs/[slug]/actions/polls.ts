'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubRole, isClubMod } from '@/lib/club-membership'
import { getAuthedUserId } from '@/lib/nav-user'
import {
  FOXING_EMBED_COLOR,
  getClubDiscordWebhook,
  postToDiscord,
} from '@/lib/discord'
import { FOXING_BASE_URL } from '@/lib/metadata'
import type { ActionResult } from './_shared'

async function postPollToDiscord(
  clubId: string,
  poll: { title: string; options: string[] },
  clubSlug: string | null,
): Promise<void> {
  const hook = await getClubDiscordWebhook(clubId)
  if (!hook) return
  const link = clubSlug ? `${FOXING_BASE_URL}/clubs/${clubSlug}` : undefined
  const optionsList = poll.options
    .map((opt, i) => `${i + 1}. ${opt}`)
    .join('\n')
  await postToDiscord(hook.url, '🗳 New club poll', [
    {
      title: poll.title,
      description: optionsList,
      url: link,
      color: FOXING_EMBED_COLOR,
      timestamp: new Date().toISOString(),
    },
  ])
}

export async function createClubPoll(
  formData: FormData,
): Promise<ActionResult> {
  const get = (k: string) => String(formData.get(k) ?? '').trim()
  const clubId = get('club_id')
  const title = get('title').slice(0, 120)
  const pollTypeRaw = get('poll_type')
  const pollType = pollTypeRaw === 'ranked' ? 'ranked' : 'single'
  const closesAt = get('closes_at') || null
  const description = get('description').slice(0, 2000) || null
  const optionsRaw = formData.getAll('option_label[]').map((v) => String(v))
  const optionBookIds = formData.getAll('option_book_id[]').map((v) => String(v))
  const options = optionsRaw
    .map((label, i) => ({
      label: label.trim().slice(0, 200),
      book_id: (optionBookIds[i] ?? '').trim() || null,
    }))
    .filter((o) => o.label.length > 0)
  if (!clubId || !title || options.length < 2) {
    return { ok: false, error: 'Title and at least 2 options required.' }
  }
  if (options.length > 8) {
    return { ok: false, error: 'Up to 8 options allowed.' }
  }

  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const role = await getClubRole(clubId, userId)
  if (!isClubMod(role)) return { ok: false, error: 'Moderator access required.' }

  const sb = await createClient()
  const { data: poll, error } = await sb
    .from('club_polls')
    .insert({
      club_id: clubId,
      created_by: userId,
      title,
      description,
      poll_type: pollType,
      closes_at: closesAt,
    })
    .select('id, title')
    .single()
  if (error || !poll) {
    return { ok: false, error: error?.message ?? 'Could not create poll.' }
  }

  const admin = createAdminClient()
  const { error: optionsError } = await admin.from('club_poll_options').insert(
    options.map((o, i) => ({
      poll_id: poll.id,
      label: o.label,
      book_id: o.book_id,
      position: i,
    })),
  )
  if (optionsError) {
    await admin.from('club_polls').delete().eq('id', poll.id)
    return { ok: false, error: optionsError.message }
  }

  const { data: members } = await admin
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('status', 'active')
  const rows = (members as { user_id: string }[] | null) ?? []
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const clubSlug = (club as { slug: string | null } | null)?.slug ?? null
  if (rows.length > 0) {
    await admin.from('notifications').insert(
      rows.map((r) => ({
        user_id: r.user_id,
        type: 'club_poll',
        title: poll.title,
        body: 'Vote on the next book',
        data: {
          club_id: clubId,
          club_slug: clubSlug,
          poll_id: poll.id,
        },
      })),
    )
  }

  void postPollToDiscord(
    clubId,
    {
      title: poll.title,
      options: options.map((o) => o.label),
    },
    clubSlug,
  )

  if (clubSlug) revalidatePath(`/clubs/${clubSlug}`)
  return { ok: true }
}

export async function voteOnPoll(
  formData: FormData,
): Promise<ActionResult> {
  const pollId = String(formData.get('poll_id') ?? '').trim()
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!pollId || !clubId) return { ok: false, error: 'Missing fields.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const role = await getClubRole(clubId, userId)
  if (!role) return { ok: false, error: 'Join the club to vote.' }

  const sb = await createClient()
  const { data: poll } = await sb
    .from('club_polls')
    .select('id, poll_type, is_closed, closes_at')
    .eq('id', pollId)
    .maybeSingle()
  const pollRow = poll as
    | { poll_type: 'single' | 'ranked'; is_closed: boolean; closes_at: string | null }
    | null
  if (!pollRow) return { ok: false, error: 'Poll not found.' }
  if (pollRow.is_closed) return { ok: false, error: 'Poll is closed.' }
  if (pollRow.closes_at && new Date(pollRow.closes_at).getTime() < Date.now()) {
    return { ok: false, error: 'Poll has expired.' }
  }

  const admin = createAdminClient()
  await admin
    .from('club_poll_votes')
    .delete()
    .eq('poll_id', pollId)
    .eq('user_id', userId)

  if (pollRow.poll_type === 'single') {
    const optionId = String(formData.get('option_id') ?? '').trim()
    if (!optionId) return { ok: false, error: 'Choose an option.' }
    const { error } = await admin.from('club_poll_votes').insert({
      poll_id: pollId,
      option_id: optionId,
      user_id: userId,
      rank: null,
    })
    if (error) return { ok: false, error: error.message }
  } else {
    const optionIds = formData.getAll('ranked_option_id[]').map((v) => String(v))
    const ranks = formData.getAll('ranked_rank[]').map((v) => Number(v))
    const rows: Array<{
      poll_id: string
      option_id: string
      user_id: string
      rank: number
    }> = []
    for (let i = 0; i < optionIds.length; i++) {
      const id = optionIds[i]
      const rank = ranks[i]
      if (id && Number.isInteger(rank) && rank > 0) {
        rows.push({ poll_id: pollId, option_id: id, user_id: userId, rank })
      }
    }
    if (rows.length === 0) {
      return { ok: false, error: 'Rank at least one option.' }
    }
    const { error } = await admin.from('club_poll_votes').insert(rows)
    if (error) return { ok: false, error: error.message }
  }

  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const clubSlug = (club as { slug: string | null } | null)?.slug
  if (clubSlug) revalidatePath(`/clubs/${clubSlug}`)
  return { ok: true }
}

export async function closePoll(
  formData: FormData,
): Promise<ActionResult> {
  const pollId = String(formData.get('poll_id') ?? '').trim()
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!pollId || !clubId) return { ok: false, error: 'Missing fields.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const role = await getClubRole(clubId, userId)
  if (!isClubMod(role)) return { ok: false, error: 'Moderator access required.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('club_polls')
    .update({ is_closed: true })
    .eq('id', pollId)
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

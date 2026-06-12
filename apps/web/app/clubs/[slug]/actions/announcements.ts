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

interface AnnouncementPayload {
  club_id: string
  title: string
  body: string | null
  event_date: string | null
  event_end_date: string | null
  event_location: string | null
  event_address: string | null
  event_city: string | null
  event_state: string | null
  event_zip: string | null
  book_id: string | null
  is_pinned: boolean
}

function parseAnnouncement(formData: FormData): AnnouncementPayload {
  const get = (k: string) => String(formData.get(k) ?? '').trim()
  const isEvent = formData.get('is_event') === 'on'
  const stateRaw = get('event_state').toUpperCase().slice(0, 2)
  return {
    club_id: get('club_id'),
    title: get('title').slice(0, 120),
    body: get('body').slice(0, 2000) || null,
    event_date: isEvent && get('event_date') ? get('event_date') : null,
    event_end_date:
      isEvent && get('event_end_date') ? get('event_end_date') : null,
    event_location: isEvent ? get('event_location') || null : null,
    event_address: isEvent ? get('event_address') || null : null,
    event_city: isEvent ? get('event_city') || null : null,
    event_state: isEvent ? stateRaw || null : null,
    event_zip: isEvent ? get('event_zip') || null : null,
    book_id: get('book_id') || null,
    is_pinned: formData.get('is_pinned') === 'on',
  }
}

async function notifyClubMembers(
  clubId: string,
  announcement: {
    id: string
    title: string
    body: string | null
    event_date: string | null
    event_location: string | null
  },
  clubSlug: string | null,
): Promise<void> {
  const admin = createAdminClient()
  const { data: members } = await admin
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('status', 'active')
  const rows = (members as { user_id: string }[] | null) ?? []
  if (rows.length === 0) return
  const isEvent = Boolean(announcement.event_date)
  const body = isEvent
    ? [
        announcement.event_date
          ? new Date(announcement.event_date).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : '',
        announcement.event_location ?? '',
      ]
        .filter(Boolean)
        .join(' · ')
    : (announcement.body ?? '').slice(0, 100)
  await admin.from('notifications').insert(
    rows.map((r) => ({
      user_id: r.user_id,
      type: isEvent ? 'club_event' : 'club_announcement',
      title: announcement.title,
      body,
      data: {
        club_id: clubId,
        club_slug: clubSlug,
        announcement_id: announcement.id,
      },
    })),
  )
}

async function postAnnouncementToDiscord(
  clubId: string,
  announcement: {
    title: string
    body: string | null
    event_date: string | null
    event_location: string | null
  },
  clubSlug: string | null,
): Promise<void> {
  const hook = await getClubDiscordWebhook(clubId)
  if (!hook) return
  const link = clubSlug ? `${FOXING_BASE_URL}/clubs/${clubSlug}` : undefined
  const description = announcement.body
    ? announcement.body.slice(0, 400)
    : undefined
  await postToDiscord(hook.url, '📣 New club announcement', [
    {
      title: announcement.title,
      description,
      url: link,
      color: FOXING_EMBED_COLOR,
      timestamp: new Date().toISOString(),
    },
  ])
}

export async function createAnnouncement(
  formData: FormData,
): Promise<ActionResult> {
  const payload = parseAnnouncement(formData)
  if (!payload.club_id || !payload.title) {
    return { ok: false, error: 'Title is required.' }
  }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const role = await getClubRole(payload.club_id, userId)
  if (!isClubMod(role)) return { ok: false, error: 'Moderator access required.' }

  const sb = await createClient()
  const { data, error } = await sb
    .from('club_announcements')
    .insert({
      club_id: payload.club_id,
      created_by: userId,
      title: payload.title,
      body: payload.body,
      event_date: payload.event_date,
      event_end_date: payload.event_end_date,
      event_location: payload.event_location,
      event_address: payload.event_address,
      event_city: payload.event_city,
      event_state: payload.event_state,
      event_zip: payload.event_zip,
      book_id: payload.book_id,
      is_pinned: payload.is_pinned,
    })
    .select('id, title, body, event_date, event_location')
    .single()
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Could not save announcement.' }
  }

  const admin = createAdminClient()
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', payload.club_id)
    .maybeSingle()
  const clubSlug = (club as { slug: string | null } | null)?.slug ?? null

  await notifyClubMembers(payload.club_id, data, clubSlug)
  void postAnnouncementToDiscord(payload.club_id, data, clubSlug)

  revalidatePath('/events')
  if (clubSlug) revalidatePath(`/clubs/${clubSlug}`)
  if (payload.event_state) {
    revalidatePath(`/events/${payload.event_state.toLowerCase()}`)
    if (payload.event_city) {
      revalidatePath(
        `/events/${payload.event_state.toLowerCase()}/${payload.event_city.toLowerCase()}`,
      )
    }
  }
  return { ok: true }
}

export async function removeAnnouncement(
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '').trim()
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!id || !clubId) return { ok: false, error: 'Missing id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const role = await getClubRole(clubId, userId)
  if (!isClubMod(role)) return { ok: false, error: 'Moderator access required.' }

  const sb = await createClient()
  const { error } = await sb
    .from('club_announcements')
    .update({
      is_removed: true,
      removed_at: new Date().toISOString(),
      removed_by: userId,
    })
    .eq('id', id)
    .eq('club_id', clubId)
  if (error) return { ok: false, error: error.message }

  const admin = createAdminClient()
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const clubSlug = (club as { slug: string | null } | null)?.slug
  revalidatePath('/events')
  if (clubSlug) revalidatePath(`/clubs/${clubSlug}`)
  return { ok: true }
}

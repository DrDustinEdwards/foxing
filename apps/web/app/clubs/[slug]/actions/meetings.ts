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
import { type ActionResult, assertMod } from './_shared'

async function notifyClubAboutMeeting(
  clubId: string,
  meeting: {
    id: string
    title: string
    meeting_date: string
    location_name: string | null
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
  const dateStr = new Date(meeting.meeting_date).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const body = [dateStr, meeting.location_name].filter(Boolean).join(' · ')
  await admin.from('notifications').insert(
    rows.map((r) => ({
      user_id: r.user_id,
      type: 'club_event',
      title: meeting.title,
      body,
      data: {
        club_id: clubId,
        club_slug: clubSlug,
        meeting_id: meeting.id,
      },
    })),
  )
}

async function postMeetingToDiscord(
  clubId: string,
  meeting: {
    title: string
    meeting_date: string
    location_name: string | null
  },
  clubSlug: string | null,
): Promise<void> {
  const hook = await getClubDiscordWebhook(clubId)
  if (!hook) return
  const link = clubSlug ? `${FOXING_BASE_URL}/clubs/${clubSlug}` : undefined
  const date = new Date(meeting.meeting_date)
  const dateLabel = date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  await postToDiscord(hook.url, '📅 New meeting scheduled', [
    {
      title: meeting.title,
      description: meeting.location_name ?? undefined,
      url: link,
      color: FOXING_EMBED_COLOR,
      fields: [{ name: 'When', value: dateLabel }],
      timestamp: new Date().toISOString(),
    },
  ])
}

function generateMeetCode(): string {
  const seg = (len: number) => {
    const bytes = new Uint8Array(len)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) =>
      'abcdefghijklmnopqrstuvwxyz'[b % 26],
    ).join('')
  }
  return `${seg(3)}-${seg(4)}-${seg(3)}`
}

export async function createClubMeeting(
  formData: FormData,
): Promise<ActionResult> {
  const get = (k: string) => String(formData.get(k) ?? '').trim()
  const clubId = get('club_id')
  const title = get('title').slice(0, 120)
  const meetingDate = get('meeting_date')
  if (!clubId || !title || !meetingDate) {
    return { ok: false, error: 'Title and date are required.' }
  }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const role = await getClubRole(clubId, userId)
  if (!isClubMod(role)) return { ok: false, error: 'Moderator access required.' }

  const meetingTypeRaw = get('meeting_type') || 'in_person'
  const meetingType = ['in_person', 'virtual', 'hybrid'].includes(meetingTypeRaw)
    ? meetingTypeRaw
    : 'in_person'
  const rsvpLimitRaw = get('rsvp_limit')
  const rsvpLimit = rsvpLimitRaw ? Number(rsvpLimitRaw) || null : null
  const isRecurring = formData.get('is_recurring') === 'on'
  const recurrenceRule = isRecurring ? get('recurrence_rule') || null : null

  let locationUrl: string | null = get('location_url') || null
  if (
    !locationUrl &&
    (meetingType === 'virtual' || meetingType === 'hybrid')
  ) {
    locationUrl = `https://meet.google.com/${generateMeetCode()}`
  }

  const sb = await createClient()
  const { data, error } = await sb
    .from('club_meetings')
    .insert({
      club_id: clubId,
      created_by: userId,
      title,
      description: get('description').slice(0, 2000) || null,
      book_id: get('book_id') || null,
      meeting_date: meetingDate,
      end_date: get('end_date') || null,
      location_name: get('location_name') || null,
      location_address: get('location_address') || null,
      location_url: locationUrl,
      meeting_type: meetingType,
      is_recurring: isRecurring,
      recurrence_rule: recurrenceRule,
      rsvp_limit: rsvpLimit,
    })
    .select('id, title, meeting_date, location_name')
    .single()
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Could not save meeting.' }
  }

  const admin = createAdminClient()
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const clubSlug = (club as { slug: string | null } | null)?.slug ?? null

  await notifyClubAboutMeeting(
    clubId,
    {
      id: data.id,
      title: data.title,
      meeting_date: data.meeting_date,
      location_name: data.location_name,
    },
    clubSlug,
  )
  void postMeetingToDiscord(
    clubId,
    {
      title: data.title,
      meeting_date: data.meeting_date,
      location_name: data.location_name,
    },
    clubSlug,
  )

  if (clubSlug) revalidatePath(`/clubs/${clubSlug}`)
  return { ok: true }
}

export async function rsvpToMeeting(
  formData: FormData,
): Promise<ActionResult> {
  const meetingId = String(formData.get('meeting_id') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()
  if (!meetingId || !['going', 'maybe', 'not_going'].includes(status)) {
    return { ok: false, error: 'Invalid RSVP.' }
  }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }

  const sb = await createClient()
  const { data: meeting } = await sb
    .from('club_meetings')
    .select('club_id')
    .eq('id', meetingId)
    .maybeSingle()
  const clubId = (meeting as { club_id: string } | null)?.club_id
  if (!clubId) return { ok: false, error: 'Meeting not found.' }
  const role = await getClubRole(clubId, userId)
  if (!role) {
    return { ok: false, error: 'You need to join the club to RSVP.' }
  }

  const admin = createAdminClient()
  await admin
    .from('club_meeting_rsvps')
    .delete()
    .eq('meeting_id', meetingId)
    .eq('user_id', userId)
  const { error } = await admin.from('club_meeting_rsvps').insert({
    meeting_id: meetingId,
    user_id: userId,
    status,
  })
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

export async function cancelClubMeeting(
  formData: FormData,
): Promise<ActionResult> {
  const meetingId = String(formData.get('meeting_id') ?? '').trim()
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!meetingId || !clubId) return { ok: false, error: 'Missing fields.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const role = await getClubRole(clubId, userId)
  if (!isClubMod(role)) return { ok: false, error: 'Moderator access required.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('club_meetings')
    .update({
      is_cancelled: true,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', meetingId)
    .eq('club_id', clubId)
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

export async function createScheduleEntry(
  formData: FormData,
): Promise<ActionResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  const chapterName = String(formData.get('chapter_name') ?? '').trim().slice(0, 120)
  const unlockDate = String(formData.get('unlock_date') ?? '').trim()
  if (!clubId || !chapterName || !unlockDate) {
    return { ok: false, error: 'Chapter and unlock date required.' }
  }
  const auth = await assertMod(clubId)
  if (!auth.ok) return auth
  const admin = createAdminClient()
  const { error } = await admin.from('club_schedule').insert({
    club_id: clubId,
    chapter_name: chapterName,
    unlock_date: unlockDate,
  })
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

export async function deleteScheduleEntry(
  formData: FormData,
): Promise<ActionResult> {
  const scheduleId = String(formData.get('schedule_id') ?? '').trim()
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!scheduleId || !clubId) return { ok: false, error: 'Missing fields.' }
  const auth = await assertMod(clubId)
  if (!auth.ok) return auth
  const admin = createAdminClient()
  const { error } = await admin
    .from('club_schedule')
    .delete()
    .eq('id', scheduleId)
    .eq('club_id', clubId)
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

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubRole, isClubMod } from '@/lib/club-membership'
import { getAuthedUserId } from '@/lib/nav-user'

type ActionResult = { ok: true } | { ok: false; error: string }

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

  const sb = createClient()
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

  const sb = createClient()
  const { error } = await sb
    .from('club_announcements')
    .update({
      is_removed: true,
      removed_at: new Date().toISOString(),
      removed_by: userId,
    })
    .eq('id', id)
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

interface MemberActionInput {
  club_id: string
  user_id: string
}

function parseMemberAction(formData: FormData): MemberActionInput {
  return {
    club_id: String(formData.get('club_id') ?? '').trim(),
    user_id: String(formData.get('user_id') ?? '').trim(),
  }
}

async function assertMod(clubId: string): Promise<
  | { ok: true; actorId: string; role: NonNullable<Awaited<ReturnType<typeof getClubRole>>> }
  | { ok: false; error: string }
> {
  const actorId = await getAuthedUserId()
  if (!actorId) return { ok: false, error: 'Sign in required.' }
  const role = await getClubRole(clubId, actorId)
  if (!isClubMod(role)) return { ok: false, error: 'Moderator access required.' }
  return { ok: true, actorId, role: role! }
}

export async function muteClubMember(
  formData: FormData,
): Promise<ActionResult> {
  const { club_id, user_id } = parseMemberAction(formData)
  const durationHours = Number(formData.get('duration_hours') ?? 24)
  if (!club_id || !user_id) return { ok: false, error: 'Missing fields.' }
  const auth = await assertMod(club_id)
  if (!auth.ok) return auth
  const until =
    durationHours <= 0
      ? new Date('9999-12-31T00:00:00Z').toISOString()
      : new Date(Date.now() + durationHours * 3600 * 1000).toISOString()
  const admin = createAdminClient()
  const { error } = await admin
    .from('club_members')
    .update({ muted_until: until, muted_by: auth.actorId, status: 'muted' })
    .eq('club_id', club_id)
    .eq('user_id', user_id)
  if (error) return { ok: false, error: error.message }
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', club_id)
    .maybeSingle()
  const clubSlug = (club as { slug: string | null } | null)?.slug
  if (clubSlug) revalidatePath(`/clubs/${clubSlug}`)
  return { ok: true }
}

export async function banClubMember(
  formData: FormData,
): Promise<ActionResult> {
  const { club_id, user_id } = parseMemberAction(formData)
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500) || null
  if (!club_id || !user_id) return { ok: false, error: 'Missing fields.' }
  const auth = await assertMod(club_id)
  if (!auth.ok) return auth
  const admin = createAdminClient()
  const { error } = await admin
    .from('club_members')
    .update({
      banned_at: new Date().toISOString(),
      banned_by: auth.actorId,
      ban_reason: reason,
      status: 'banned',
    })
    .eq('club_id', club_id)
    .eq('user_id', user_id)
  if (error) return { ok: false, error: error.message }
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', club_id)
    .maybeSingle()
  const clubSlug = (club as { slug: string | null } | null)?.slug
  if (clubSlug) revalidatePath(`/clubs/${clubSlug}`)
  return { ok: true }
}

export async function removeClubMember(
  formData: FormData,
): Promise<ActionResult> {
  const { club_id, user_id } = parseMemberAction(formData)
  if (!club_id || !user_id) return { ok: false, error: 'Missing fields.' }
  const auth = await assertMod(club_id)
  if (!auth.ok) return auth
  const admin = createAdminClient()
  const { error } = await admin
    .from('club_members')
    .delete()
    .eq('club_id', club_id)
    .eq('user_id', user_id)
  if (error) return { ok: false, error: error.message }
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', club_id)
    .maybeSingle()
  const clubSlug = (club as { slug: string | null } | null)?.slug
  if (clubSlug) revalidatePath(`/clubs/${clubSlug}`)
  return { ok: true }
}

export async function changeClubMemberRole(
  formData: FormData,
): Promise<ActionResult> {
  const { club_id, user_id } = parseMemberAction(formData)
  const newRole = String(formData.get('role') ?? '').trim()
  if (
    !club_id ||
    !user_id ||
    !['admin', 'moderator', 'member'].includes(newRole)
  ) {
    return { ok: false, error: 'Invalid role.' }
  }
  const auth = await assertMod(club_id)
  if (!auth.ok) return auth
  if (auth.role !== 'admin') {
    return { ok: false, error: 'Only club admins can change roles.' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('club_members')
    .update({ role: newRole })
    .eq('club_id', club_id)
    .eq('user_id', user_id)
  if (error) return { ok: false, error: error.message }
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', club_id)
    .maybeSingle()
  const clubSlug = (club as { slug: string | null } | null)?.slug
  if (clubSlug) revalidatePath(`/clubs/${clubSlug}`)
  return { ok: true }
}

export async function inviteClubMember(
  formData: FormData,
): Promise<ActionResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  const identifier = String(formData.get('identifier') ?? '').trim()
  if (!clubId || !identifier) return { ok: false, error: 'Missing fields.' }
  const auth = await assertMod(clubId)
  if (!auth.ok) return auth
  const admin = createAdminClient()
  const isEmail = identifier.includes('@')
  let invitedUserId: string | null = null
  if (!isEmail) {
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('username', identifier.toLowerCase())
      .maybeSingle()
    if (!profile) {
      return { ok: false, error: 'No member found with that username.' }
    }
    invitedUserId = (profile as { id: string }).id
  }
  const { error } = await admin.from('club_invites').insert({
    club_id: clubId,
    invited_by: auth.actorId,
    invited_user_id: invitedUserId,
    email: isEmail ? identifier.toLowerCase() : null,
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

const REPORT_REASONS = new Set([
  'spam',
  'harassment',
  'spoilers',
  'offensive',
  'other',
])

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

export async function approveClubMember(
  formData: FormData,
): Promise<ActionResult> {
  const { club_id, user_id } = parseMemberAction(formData)
  if (!club_id || !user_id) return { ok: false, error: 'Missing fields.' }
  const auth = await assertMod(club_id)
  if (!auth.ok) return auth
  const admin = createAdminClient()
  const { error } = await admin
    .from('club_members')
    .update({ status: 'active', joined_at: new Date().toISOString() })
    .eq('club_id', club_id)
    .eq('user_id', user_id)
    .eq('status', 'pending')
  if (error) return { ok: false, error: error.message }
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', club_id)
    .maybeSingle()
  const clubSlug = (club as { slug: string | null } | null)?.slug
  if (clubSlug) revalidatePath(`/clubs/${clubSlug}`)
  return { ok: true }
}

export async function declineClubMember(
  formData: FormData,
): Promise<ActionResult> {
  const { club_id, user_id } = parseMemberAction(formData)
  if (!club_id || !user_id) return { ok: false, error: 'Missing fields.' }
  const auth = await assertMod(club_id)
  if (!auth.ok) return auth
  const admin = createAdminClient()
  const { error } = await admin
    .from('club_members')
    .delete()
    .eq('club_id', club_id)
    .eq('user_id', user_id)
    .eq('status', 'pending')
  if (error) return { ok: false, error: error.message }
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', club_id)
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

// ─── Meetings ──────────────────────────────────────────────────────────────

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

  const sb = createClient()
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
      location_url: get('location_url') || null,
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

  const sb = createClient()
  // Confirm membership.
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
  // Upsert: delete then insert (no unique constraint guaranteed).
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

// ─── Club settings ─────────────────────────────────────────────────────────

interface ClubSettingsPayload {
  name: string
  description: string | null
  visibility: 'public' | 'private' | 'secret'
  member_approval: boolean
  max_members: number | null
  reading_pace: 'relaxed' | 'moderate' | 'intensive' | 'custom'
  chapters_per_week: number | null
  genre_tags: string[]
  current_book_id: string | null
}

function parseClubSettings(formData: FormData): ClubSettingsPayload {
  const get = (k: string) => String(formData.get(k) ?? '').trim()
  const visibilityRaw = get('visibility')
  const visibility: ClubSettingsPayload['visibility'] = (
    ['public', 'private', 'secret'] as const
  ).includes(visibilityRaw as 'public' | 'private' | 'secret')
    ? (visibilityRaw as 'public' | 'private' | 'secret')
    : 'public'
  const paceRaw = get('reading_pace')
  const reading_pace: ClubSettingsPayload['reading_pace'] = (
    ['relaxed', 'moderate', 'intensive', 'custom'] as const
  ).includes(paceRaw as 'relaxed' | 'moderate' | 'intensive' | 'custom')
    ? (paceRaw as 'relaxed' | 'moderate' | 'intensive' | 'custom')
    : 'moderate'
  const maxRaw = get('max_members')
  const cpwRaw = get('chapters_per_week')
  const tagsRaw = get('genre_tags')
  return {
    name: get('name').slice(0, 80),
    description: get('description').slice(0, 500) || null,
    visibility,
    member_approval: formData.get('member_approval') === 'on',
    max_members: maxRaw ? Number(maxRaw) || null : null,
    reading_pace,
    chapters_per_week:
      reading_pace === 'custom' && cpwRaw ? Number(cpwRaw) || null : null,
    genre_tags: tagsRaw
      ? tagsRaw
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 12)
      : [],
    current_book_id: get('current_book_id') || null,
  }
}

export async function updateClubSettings(
  formData: FormData,
): Promise<ActionResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!clubId) return { ok: false, error: 'Missing club id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const role = await getClubRole(clubId, userId)
  if (role !== 'admin') return { ok: false, error: 'Admin access required.' }

  const payload = parseClubSettings(formData)
  if (!payload.name) return { ok: false, error: 'Club name is required.' }

  const admin = createAdminClient()
  const { data: prior } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const priorSlug = (prior as { slug: string | null } | null)?.slug

  const { error } = await admin
    .from('clubs')
    .update({
      name: payload.name,
      description: payload.description,
      visibility: payload.visibility,
      member_approval: payload.member_approval,
      max_members: payload.max_members,
      reading_pace: payload.reading_pace,
      chapters_per_week: payload.chapters_per_week,
      genre_tags: payload.genre_tags,
      current_book_id: payload.current_book_id,
    })
    .eq('id', clubId)
  if (error) return { ok: false, error: error.message }

  const { data: after } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const newSlug = (after as { slug: string | null } | null)?.slug
  revalidatePath('/clubs')
  if (priorSlug) revalidatePath(`/clubs/${priorSlug}`)
  if (newSlug && newSlug !== priorSlug) revalidatePath(`/clubs/${newSlug}`)
  return { ok: true }
}

export async function transferClubOwnership(
  formData: FormData,
): Promise<ActionResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  const username = String(formData.get('username') ?? '').trim().toLowerCase()
  const confirm = formData.get('confirm') === 'on'
  if (!clubId || !username) return { ok: false, error: 'Missing fields.' }
  if (!confirm) return { ok: false, error: 'Confirm by checking the box.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const role = await getClubRole(clubId, userId)
  if (role !== 'admin') return { ok: false, error: 'Admin access required.' }

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  const targetId = (target as { id: string } | null)?.id
  if (!targetId) {
    return { ok: false, error: 'No member found with that username.' }
  }
  if (targetId === userId) {
    return { ok: false, error: 'You already own this club.' }
  }
  const { data: targetMember } = await admin
    .from('club_members')
    .select('user_id, status')
    .eq('club_id', clubId)
    .eq('user_id', targetId)
    .maybeSingle()
  const member = targetMember as { user_id: string; status: string | null } | null
  if (!member || member.status !== 'active') {
    return { ok: false, error: 'That user is not an active member.' }
  }

  const { error: demote } = await admin
    .from('club_members')
    .update({ role: 'member' })
    .eq('club_id', clubId)
    .eq('user_id', userId)
  if (demote) return { ok: false, error: demote.message }
  const { error: promote } = await admin
    .from('club_members')
    .update({ role: 'admin' })
    .eq('club_id', clubId)
    .eq('user_id', targetId)
  if (promote) return { ok: false, error: promote.message }
  const { error: club } = await admin
    .from('clubs')
    .update({ creator_id: targetId })
    .eq('id', clubId)
  if (club) return { ok: false, error: club.message }

  const { data: clubRow } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const slug = (clubRow as { slug: string | null } | null)?.slug
  if (slug) revalidatePath(`/clubs/${slug}`)
  return { ok: true }
}

export async function deleteClub(formData: FormData): Promise<void> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  const confirmName = String(formData.get('confirm_name') ?? '').trim()
  if (!clubId) throw new Error('Missing club id.')
  const userId = await getAuthedUserId()
  if (!userId) throw new Error('Sign in required.')
  const role = await getClubRole(clubId, userId)
  if (role !== 'admin') throw new Error('Admin access required.')

  const admin = createAdminClient()
  const { data: clubRow } = await admin
    .from('clubs')
    .select('name, slug')
    .eq('id', clubId)
    .maybeSingle()
  const club = clubRow as { name: string; slug: string | null } | null
  if (!club) throw new Error('Club not found.')
  if (club.name.toLowerCase() !== confirmName.toLowerCase()) {
    throw new Error('Confirmation name does not match.')
  }

  const { error } = await admin.from('clubs').delete().eq('id', clubId)
  if (error) throw new Error(error.message)

  revalidatePath('/clubs')
  if (club.slug) revalidatePath(`/clubs/${club.slug}`)
  redirect('/clubs')
}

// ─── Polls ─────────────────────────────────────────────────────────────────

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

  const sb = createClient()
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
    // Try to clean up: best-effort
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

  const sb = createClient()
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
  // Clear existing votes for this poll+user.
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

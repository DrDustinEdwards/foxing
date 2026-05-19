'use server'

import { revalidatePath } from 'next/cache'
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

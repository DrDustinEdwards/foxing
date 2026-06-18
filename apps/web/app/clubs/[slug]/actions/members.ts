'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubRole } from '@/lib/club-membership'
import { getAuthedUserId } from '@/lib/nav-user'
import { emitActivity, resolveActivityVisibility } from '@/lib/activity'
import { type ActionResult, assertMod } from './_shared'

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

export async function joinWaitlist(
  formData: FormData,
): Promise<ActionResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!clubId) return { ok: false, error: 'Missing club.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const admin = createAdminClient()
  const { data: club } = await admin
    .from('clubs')
    .select('member_count, max_members, slug')
    .eq('id', clubId)
    .maybeSingle()
  const row = club as
    | {
        member_count: number | null
        max_members: number | null
        slug: string | null
      }
    | null
  if (!row) return { ok: false, error: 'Club not found.' }
  if (
    row.max_members === null ||
    (row.member_count ?? 0) < row.max_members
  ) {
    return { ok: false, error: 'Club is not full yet.' }
  }
  const { data: existing } = await admin
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) {
    return { ok: false, error: 'You are already in this club.' }
  }
  const { error } = await admin
    .from('club_waitlist')
    .upsert(
      { club_id: clubId, user_id: userId },
      { onConflict: 'club_id,user_id', ignoreDuplicates: true },
    )
  if (error) return { ok: false, error: error.message }
  if (row.slug) revalidatePath(`/clubs/${row.slug}`)
  return { ok: true }
}

export async function leaveWaitlist(
  formData: FormData,
): Promise<ActionResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!clubId) return { ok: false, error: 'Missing club.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('club_waitlist')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', userId)
  if (error) return { ok: false, error: error.message }
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const slug = (club as { slug: string | null } | null)?.slug
  if (slug) revalidatePath(`/clubs/${slug}`)
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
  const { data: updated, error } = await admin
    .from('club_members')
    .update({ status: 'active', joined_at: new Date().toISOString() })
    .eq('club_id', club_id)
    .eq('user_id', user_id)
    .eq('status', 'pending')
    .select('user_id')
  if (error) return { ok: false, error: error.message }
  const { data: club } = await admin
    .from('clubs')
    .select('slug, name')
    .eq('id', club_id)
    .maybeSingle()
  const clubRow = club as { slug: string | null; name: string | null } | null
  const clubSlug = clubRow?.slug

  // Notify the requester that they're in -- only if a pending row was actually
  // flipped to active (avoids a spurious ping on re-approve).
  if (((updated as { user_id: string }[] | null) ?? []).length > 0) {
    const href = clubSlug ? `/clubs/${clubSlug}` : undefined
    await admin.from('notifications').insert({
      user_id,
      type: 'club_join_approved',
      title: 'Request approved',
      body: clubRow?.name
        ? `You're now a member of ${clubRow.name}`
        : "You're now a member of the club",
      data: {
        club_id,
        club_slug: clubSlug ?? null,
        ...(href ? { href } : {}),
      },
    })
    // The approved member just joined -- emit for them (admin client, since the
    // actor here is the mod, not the new member).
    const visibility = await resolveActivityVisibility(admin, user_id)
    await emitActivity(admin, {
      userId: user_id,
      type: 'joined_club',
      targetId: club_id,
      data: { club_slug: clubSlug ?? null },
      visibility,
    })
  }

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

// Direct join for an open public club. Inserts an active membership (or a
// pending one if the club requires approval). RLS allows a self-insert
// (club_members_insert_self: user_id = auth.uid()); the admin client is used
// here so capacity/visibility can be validated server-side, mirroring
// joinWaitlist / requestToJoinClub. role is always 'member'
// (club_members_role_check is admin|moderator|member -- never 'owner').
export async function joinClub(
  formData: FormData,
): Promise<
  { ok: true; status: 'active' | 'pending' } | { ok: false; error: string }
> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!clubId) return { ok: false, error: 'Missing club id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const admin = createAdminClient()
  const { data: club } = await admin
    .from('clubs')
    .select('slug, visibility, member_approval, max_members, member_count')
    .eq('id', clubId)
    .maybeSingle()
  const row = club as
    | {
        slug: string | null
        visibility: string | null
        member_approval: boolean | null
        max_members: number | null
        member_count: number | null
      }
    | null
  if (!row) return { ok: false, error: 'Club not found.' }
  if (row.visibility !== 'public') {
    return { ok: false, error: 'This club is invite-only.' }
  }
  const { data: existing } = await admin
    .from('club_members')
    .select('status')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle()
  const status = (existing as { status: string | null } | null)?.status ?? null
  if (status === 'active' || status === 'muted') {
    return { ok: false, error: 'You are already a member.' }
  }
  if (status === 'pending') {
    return { ok: false, error: 'Your request is already pending.' }
  }
  if (status === 'banned') {
    return { ok: false, error: 'You cannot join this club.' }
  }
  const isFull =
    row.max_members !== null && (row.member_count ?? 0) >= row.max_members
  if (isFull && !row.member_approval) {
    return { ok: false, error: 'Club is full. Join the waitlist instead.' }
  }
  const nextStatus: 'active' | 'pending' = row.member_approval
    ? 'pending'
    : 'active'
  const { error } = await admin.from('club_members').upsert(
    { club_id: clubId, user_id: userId, role: 'member', status: nextStatus },
    { onConflict: 'club_id,user_id' },
  )
  if (error) return { ok: false, error: error.message }
  if (nextStatus === 'active') {
    const visibility = await resolveActivityVisibility(admin, userId)
    await emitActivity(admin, {
      userId,
      type: 'joined_club',
      targetId: clubId,
      data: { club_slug: row.slug },
      visibility,
    })
  }
  if (row.slug) revalidatePath(`/clubs/${row.slug}`)
  return { ok: true, status: nextStatus }
}

// Leave a club by deleting your own membership row
// (club_members_delete_self covers this under RLS). The creator cannot leave
// without first transferring ownership (see transferClubOwnership).
export async function leaveClub(formData: FormData): Promise<ActionResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!clubId) return { ok: false, error: 'Missing club id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const admin = createAdminClient()
  const { data: club } = await admin
    .from('clubs')
    .select('slug, creator_id')
    .eq('id', clubId)
    .maybeSingle()
  const row = club as { slug: string | null; creator_id: string | null } | null
  if (!row) return { ok: false, error: 'Club not found.' }
  if (row.creator_id === userId) {
    return {
      ok: false,
      error: 'Transfer ownership before leaving the club.',
    }
  }
  const { error } = await admin
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', userId)
  if (error) return { ok: false, error: error.message }
  if (row.slug) revalidatePath(`/clubs/${row.slug}`)
  return { ok: true }
}

// Generate a shareable invite. invite_code + expires_at (now()+7d) are filled
// by column defaults, so the insert just needs club_id + invited_by; the code
// is read back for the share link. /clubs/[slug]/join?code= redeems it.
export async function generateClubInvite(
  formData: FormData,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!clubId) return { ok: false, error: 'Missing club id.' }
  const auth = await assertMod(clubId)
  if (!auth.ok) return auth
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('club_invites')
    .insert({ club_id: clubId, invited_by: auth.actorId })
    .select('invite_code')
    .single()
  if (error) return { ok: false, error: error.message }
  const code = (data as { invite_code: string | null }).invite_code
  if (!code) return { ok: false, error: 'Could not generate an invite.' }
  return { ok: true, code }
}

// Redeem an invite code: validate code + expiry + club match, then insert an
// active membership and mark the invite accepted. Uses the admin client because
// the redeemer cannot SELECT the invite under RLS (invites are visible only to
// the invitee or club mods).
export async function redeemClubInvite(
  formData: FormData,
): Promise<ActionResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  const code = String(formData.get('code') ?? '').trim()
  if (!clubId || !code) return { ok: false, error: 'Missing invite code.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const admin = createAdminClient()
  const { data: inviteRow } = await admin
    .from('club_invites')
    .select('id, club_id, status, expires_at')
    .eq('invite_code', code)
    .maybeSingle()
  const invite = inviteRow as
    | { id: string; club_id: string; status: string | null; expires_at: string | null }
    | null
  if (!invite || invite.club_id !== clubId) {
    return { ok: false, error: 'This invite is not valid.' }
  }
  if (invite.status !== 'pending') {
    return { ok: false, error: 'This invite has already been used.' }
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    await admin
      .from('club_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id)
    return { ok: false, error: 'This invite has expired.' }
  }
  const { data: existing } = await admin
    .from('club_members')
    .select('status')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle()
  const status = (existing as { status: string | null } | null)?.status ?? null
  if (status === 'banned') {
    return { ok: false, error: 'You cannot join this club.' }
  }
  const newlyJoined = status !== 'active' && status !== 'muted'
  if (newlyJoined) {
    const { error: insErr } = await admin.from('club_members').upsert(
      { club_id: clubId, user_id: userId, role: 'member', status: 'active' },
      { onConflict: 'club_id,user_id' },
    )
    if (insErr) return { ok: false, error: insErr.message }
  }
  await admin
    .from('club_invites')
    .update({ status: 'accepted', invited_user_id: userId })
    .eq('id', invite.id)
  const { data: clubRow } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const slug = (clubRow as { slug: string | null } | null)?.slug
  if (newlyJoined) {
    const visibility = await resolveActivityVisibility(admin, userId)
    await emitActivity(admin, {
      userId,
      type: 'joined_club',
      targetId: clubId,
      data: { club_slug: slug ?? null },
      visibility,
    })
  }
  if (slug) revalidatePath(`/clubs/${slug}`)
  return { ok: true }
}

export async function requestToJoinClub(
  formData: FormData,
): Promise<ActionResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!clubId) return { ok: false, error: 'Missing club id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const admin = createAdminClient()
  const { data: club } = await admin
    .from('clubs')
    .select('slug, member_approval')
    .eq('id', clubId)
    .maybeSingle()
  const clubRow = club as
    | { slug: string | null; member_approval: boolean | null }
    | null
  if (!clubRow?.member_approval) {
    return {
      ok: false,
      error: 'This club does not require approval. Join via the app instead.',
    }
  }
  const { data: existing } = await admin
    .from('club_members')
    .select('status')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle()
  const status =
    (existing as { status: string | null } | null)?.status ?? null
  if (status === 'pending') {
    return { ok: false, error: 'Your request is already pending.' }
  }
  if (status === 'active') {
    return { ok: false, error: 'You are already a member.' }
  }
  if (status === 'banned') {
    return { ok: false, error: 'You cannot join this club.' }
  }
  const { error } = await admin.from('club_members').upsert(
    {
      club_id: clubId,
      user_id: userId,
      role: 'member',
      status: 'pending',
    },
    { onConflict: 'club_id,user_id' },
  )
  if (error) return { ok: false, error: error.message }

  // Notify the club's admins/moderators so the pending request is visible.
  const { data: mods } = await admin
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId)
    .in('role', ['admin', 'moderator'])
    .eq('status', 'active')
  const modIds = ((mods as { user_id: string }[] | null) ?? [])
    .map((m) => m.user_id)
    .filter((id) => id !== userId)
  if (modIds.length > 0) {
    const { data: requester } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()
    const requesterName =
      (requester as { display_name: string | null } | null)?.display_name ??
      'A reader'
    const href = clubRow.slug ? `/clubs/${clubRow.slug}` : undefined
    await admin.from('notifications').insert(
      modIds.map((uid) => ({
        user_id: uid,
        type: 'club_join_request',
        title: 'New join request',
        body: `${requesterName} asked to join`,
        data: {
          club_id: clubId,
          club_slug: clubRow.slug ?? null,
          requester_id: userId,
          ...(href ? { href } : {}),
        },
      })),
    )
  }

  if (clubRow.slug) revalidatePath(`/clubs/${clubRow.slug}`)
  return { ok: true }
}

import 'server-only'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type ClubRole = 'admin' | 'moderator' | 'member' | null

export interface ClubMemberRow {
  user_id: string
  club_id: string
  role: 'admin' | 'moderator' | 'member'
  status: 'active' | 'banned' | 'muted' | 'pending' | null
  joined_at: string
  banned_at: string | null
  muted_until: string | null
  ban_reason: string | null
  profile: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

export async function getClubRole(
  clubId: string,
  userId: string | null,
): Promise<ClubRole> {
  if (!userId) return null
  const sb = await createClient()
  const { data } = await sb
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle()
  const row = data as { role: ClubMemberRow['role'] } | null
  return row?.role ?? null
}

export function isClubMod(role: ClubRole): boolean {
  return role === 'admin' || role === 'moderator'
}

export async function getClubMembershipStatus(
  clubId: string,
  userId: string | null,
): Promise<'active' | 'pending' | 'banned' | 'muted' | null> {
  if (!userId) return null
  const sb = await createClient()
  const { data } = await sb
    .from('club_members')
    .select('status')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle()
  const row = data as
    | { status: 'active' | 'pending' | 'banned' | 'muted' | null }
    | null
  return row?.status ?? null
}

export async function assertActiveClubMember(
  admin: SupabaseClient,
  clubId: string,
  userId: string,
): Promise<NextResponse | null> {
  const { data } = await admin
    .from('club_members')
    .select('status')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle()
  const row = data as { status: string | null } | null
  if (row?.status !== 'active') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return null
}

const MEMBER_COLS =
  'user_id, club_id, role, status, joined_at, banned_at, muted_until, ban_reason, profile:user_id(username, display_name, avatar_url)' as const

export async function fetchClubMembers(
  clubId: string,
): Promise<ClubMemberRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('club_members')
    .select(MEMBER_COLS)
    .eq('club_id', clubId)
    .order('role', { ascending: true })
    .order('joined_at', { ascending: true })
  return ((data as unknown as ClubMemberRow[] | null) ?? []).filter(
    (m) => m.profile,
  )
}

// Book clubs data layer.
//
// SQL SCHEMA (apply via Supabase migrations before these calls return rows):
//
//   create table clubs (
//     id uuid primary key default gen_random_uuid(),
//     name text not null,
//     description text,
//     cover_url text,
//     created_by uuid not null references profiles(id) on delete cascade,
//     current_book_id uuid references books(id) on delete set null,
//     current_chapter text,
//     pace text not null default 'chill' check (pace in ('chill', 'steady', 'fast')),
//     is_public boolean not null default true,
//     member_count integer not null default 1,
//     created_at timestamptz not null default now()
//   );
//
//   create table club_members (
//     club_id uuid not null references clubs(id) on delete cascade,
//     user_id uuid not null references profiles(id) on delete cascade,
//     role text not null default 'member' check (role in ('admin', 'moderator', 'member')),
//     joined_at timestamptz not null default now(),
//     primary key (club_id, user_id)
//   );
//
//   create table club_threads (
//     id uuid primary key default gen_random_uuid(),
//     club_id uuid not null references clubs(id) on delete cascade,
//     title text not null,
//     chapter text,
//     created_by uuid not null references profiles(id),
//     is_starter boolean not null default false,
//     pinned boolean not null default false,
//     post_count integer not null default 0,
//     created_at timestamptz not null default now()
//   );
//
//   create table club_posts (
//     id uuid primary key default gen_random_uuid(),
//     thread_id uuid not null references club_threads(id) on delete cascade,
//     parent_post_id uuid references club_posts(id) on delete cascade,
//     user_id uuid not null references profiles(id),
//     body text not null,
//     has_spoilers boolean not null default false,
//     created_at timestamptz not null default now()
//   );
//
//   create table club_post_reactions (
//     post_id uuid not null references club_posts(id) on delete cascade,
//     user_id uuid not null references profiles(id) on delete cascade,
//     emoji text not null,
//     created_at timestamptz not null default now(),
//     primary key (post_id, user_id, emoji)
//   );
//
// RLS sketch (read = members or public; write = members):
//   alter table clubs enable row level security;
//   create policy clubs_read on clubs for select using (
//     is_public or exists (
//       select 1 from club_members m where m.club_id = clubs.id and m.user_id = auth.uid()
//     )
//   );
//   create policy clubs_create on clubs for insert with check (created_by = auth.uid());
//   create policy club_members_read on club_members for select using (true);
//   create policy club_members_self_join on club_members for insert with check (user_id = auth.uid());
//   create policy club_members_self_leave on club_members for delete using (user_id = auth.uid());
//   -- (Threads, posts, reactions: similar, membership-gated writes.)

import { supabase } from './supabase'
import { checkAndAwardBadges } from './streaks'

export type ClubPace = 'chill' | 'steady' | 'fast'
export type ClubRole = 'admin' | 'moderator' | 'member'

export const PACE_OPTIONS: Array<{ id: ClubPace; label: string; subtitle: string }> = [
  { id: 'chill', label: 'Chill', subtitle: 'A chapter a week, no pressure.' },
  { id: 'steady', label: 'Steady', subtitle: 'Two-to-three chapters a week.' },
  { id: 'fast', label: 'Fast', subtitle: 'Daily reading, fast turnaround.' },
]

export interface ClubBook {
  id: string
  title: string
  author: string
  cover_url: string | null
}

export interface Club {
  id: string
  name: string
  description: string | null
  cover_url: string | null
  created_by: string
  current_book_id: string | null
  current_chapter: string | null
  pace: ClubPace
  is_public: boolean
  member_count: number
  // Optional: clubs can cap membership. When set and reached, joins go to
  // club_waitlist instead.
  max_members?: number | null
  created_at: string
}

export interface ClubWithBook extends Club {
  current_book: ClubBook | null
}

export interface ClubMember {
  club_id: string
  user_id: string
  role: ClubRole
  joined_at: string
  profile: {
    id: string
    display_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

export interface ClubThread {
  id: string
  club_id: string
  title: string
  chapter: string | null
  // Schedule gate, when this matches a club_schedule.chapter_name whose
  // unlock_date is in the future, the thread is locked in the UI.
  chapter_name?: string | null
  author_id: string
  is_ai_starter: boolean
  is_pinned: boolean
  post_count: number
  created_at: string
  author?: {
    id: string
    display_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

export interface ReactionGroup {
  emoji: string
  count: number
  viewerReacted: boolean
}

export interface ClubPost {
  id: string
  thread_id: string
  parent_post_id: string | null
  author_id: string
  content: string
  has_spoiler: boolean
  created_at: string
  author?: {
    id: string
    display_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
  reactions?: ReactionGroup[]
}

interface ProfileLite {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

// club_threads.author_id, club_posts.author_id, and club_members.user_id all FK
// to auth.users (not profiles), so PostgREST cannot embed the author. Resolve the
// profiles in one by-id query and join them in app code (same pattern as the web
// fetchHighlightAuthors fix).
export async function fetchProfilesByIds(ids: string[]): Promise<Map<string, ProfileLite>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', unique)
  const map = new Map<string, ProfileLite>()
  for (const p of ((data ?? []) as ProfileLite[])) map.set(p.id, p)
  return map
}

// ── List ─────────────────────────────────────────────────────────────────

export async function listMyClubs(userId: string): Promise<ClubWithBook[]> {
  const { data: memberships, error: mErr } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', userId)
  if (mErr) {
    console.warn('[clubs] listMyClubs memberships failed:', mErr.message)
    return []
  }
  const ids = ((memberships ?? []) as Array<{ club_id: string }>).map((m) => m.club_id)
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('clubs')
    .select('*, current_book:books!current_book_id(id, title, author, cover_url)')
    .in('id', ids)
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[clubs] listMyClubs failed:', error.message)
    return []
  }
  return ((data ?? []) as unknown) as ClubWithBook[]
}

export async function listPublicClubs(limit = 30): Promise<ClubWithBook[]> {
  const { data, error } = await supabase
    .from('clubs')
    .select('*, current_book:books!current_book_id(id, title, author, cover_url)')
    .eq('is_public', true)
    .order('member_count', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[clubs] listPublicClubs failed:', error.message)
    return []
  }
  return ((data ?? []) as unknown) as ClubWithBook[]
}

// ── Single club ──────────────────────────────────────────────────────────

export async function fetchClub(id: string): Promise<ClubWithBook | null> {
  const { data, error } = await supabase
    .from('clubs')
    .select('*, current_book:books!current_book_id(id, title, author, cover_url)')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.warn('[clubs] fetchClub failed:', error.message)
    return null
  }
  return (data as unknown) as ClubWithBook | null
}

export async function fetchMembers(clubId: string): Promise<ClubMember[]> {
  const { data, error } = await supabase
    .from('club_members')
    .select('*')
    .eq('club_id', clubId)
    .order('joined_at', { ascending: true })
  if (error) {
    console.warn('[clubs] fetchMembers failed:', error.message)
    return []
  }
  const members = ((data ?? []) as unknown) as ClubMember[]
  const profiles = await fetchProfilesByIds(members.map((m) => m.user_id))
  return members.map((m) => ({ ...m, profile: profiles.get(m.user_id) ?? null }))
}

export async function isMember(clubId: string, userId: string): Promise<ClubRole | null> {
  const { data } = await supabase
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle()
  return ((data as { role: ClubRole } | null)?.role) ?? null
}

// ── Create / join / leave ────────────────────────────────────────────────

export interface CreateClubInput {
  name: string
  description?: string | null
  current_book_id?: string | null
  pace: ClubPace
  is_public: boolean
}

// Slug for /clubs/[slug] routing. Matches the web slug rule (lib/slug.ts).
function slugifyClub(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'club'
  )
}

async function uniqueClubSlug(name: string): Promise<string> {
  const base = slugifyClub(name)
  const { data } = await supabase.from('clubs').select('slug').like('slug', `${base}%`)
  const taken = new Set(
    ((data ?? []) as Array<{ slug: string | null }>)
      .map((r) => r.slug)
      .filter((s): s is string => !!s),
  )
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export async function createClub(input: CreateClubInput): Promise<Club | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // Live columns are creator_id / visibility / slug (NOT created_by / is_public /
  // pace). current_book_id is optional, so a club can be a standing community.
  const slug = await uniqueClubSlug(input.name)
  const visibility = input.is_public ? 'public' : 'private'
  const { data, error } = await supabase
    .from('clubs')
    .insert({
      name: input.name,
      description: input.description ?? null,
      current_book_id: input.current_book_id ?? null,
      creator_id: user.id,
      visibility,
      reading_pace: input.pace,
      slug,
      // Start at 0: the club_member_count_trigger increments on the owner
      // membership insert below (DEFAULT 1 + trigger would double-count).
      member_count: 0,
    })
    // NOTE: creator membership role is 'admin' below (highest allowed by the
    // club_members_role_check: admin/moderator/member). There is no 'owner'.
    .select()
    .single()
  if (error) {
    console.warn('[clubs] createClub failed:', error.message)
    return null
  }
  const { error: memErr } = await supabase.from('club_members').insert({
    club_id: data.id,
    user_id: user.id,
    role: 'admin',
    status: 'active',
  })
  if (memErr) {
    console.warn('[clubs] createClub owner membership failed:', memErr.message)
    // Roll back so we never leave a club without an owner.
    await supabase.from('clubs').delete().eq('id', data.id)
    return null
  }
  // first_club + club_founder unlocks
  checkAndAwardBadges(user.id).catch(() => {})
  // Map live columns back onto the Club shape the UI still reads.
  return {
    ...data,
    is_public: visibility === 'public',
    created_by: user.id,
    pace: input.pace,
  } as Club
}

export async function joinClub(clubId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase
    .from('club_members')
    .insert({ club_id: clubId, user_id: user.id, role: 'member' })
  if (error) {
    console.warn('[clubs] joinClub failed:', error.message)
    return false
  }
  checkAndAwardBadges(user.id).catch(() => {})
  return true
}

export async function leaveClub(clubId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', user.id)
  if (error) {
    console.warn('[clubs] leaveClub failed:', error.message)
    return false
  }
  return true
}

// ── Threads ──────────────────────────────────────────────────────────────

// ── Posts ────────────────────────────────────────────────────────────────

// ── Phase G enhancements: waitlist, schedule, save/report posts, stats ──

export interface ClubScheduleRow {
  club_id: string
  chapter_name: string
  unlock_date: string
}

export interface ClubStats {
  members: number
  threads: number
  posts: number
  mostActive: { user_id: string; display_name: string | null; username: string | null; count: number } | null
}

export async function getClubStats(clubId: string): Promise<ClubStats> {
  const [membersRes, threadsRes, postsRes, topPosterRes] = await Promise.all([
    supabase
      .from('club_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('club_id', clubId),
    supabase
      .from('club_threads')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId),
    // Posts query needs a join to threads to scope by club, we count
    // client-side from the row set so RLS plays nicely.
    supabase
      .from('club_posts')
      .select('id, author_id, thread:club_threads!thread_id(club_id)')
      .eq('thread.club_id', clubId)
      .limit(1000),
    // Top poster, same set used for the count, processed in code.
    Promise.resolve(null),
  ])
  void topPosterRes
  type PR = {
    id: string
    author_id: string
    thread: { club_id: string } | Array<{ club_id: string }> | null
  }
  const posts = (((postsRes.data ?? []) as unknown) as PR[]).filter((p) => {
    const t = Array.isArray(p.thread) ? p.thread[0] : p.thread
    return t?.club_id === clubId
  })
  const tally = new Map<string, number>()
  for (const p of posts) {
    tally.set(p.author_id, (tally.get(p.author_id) ?? 0) + 1)
  }
  let topId: string | null = null
  let topCount = 0
  for (const [user_id, count] of tally) {
    if (count > topCount) {
      topCount = count
      topId = user_id
    }
  }
  // club_posts.author_id FKs auth.users, so the top poster's profile is fetched
  // separately rather than embedded.
  let mostActive: ClubStats['mostActive'] = null
  if (topId) {
    const profile = (await fetchProfilesByIds([topId])).get(topId)
    mostActive = {
      user_id: topId,
      display_name: profile?.display_name ?? null,
      username: profile?.username ?? null,
      count: topCount,
    }
  }
  return {
    members: membersRes.count ?? 0,
    threads: threadsRes.count ?? 0,
    posts: posts.length,
    mostActive,
  }
}

export async function getClubSchedule(clubId: string): Promise<ClubScheduleRow[]> {
  const { data, error } = await supabase
    .from('club_schedule')
    .select('club_id, chapter_name, unlock_date')
    .eq('club_id', clubId)
  if (error) return []
  return ((data ?? []) as ClubScheduleRow[])
}

export async function joinWaitlist(clubId: string): Promise<number | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // Position = current waitlist count + 1.
  const { count } = await supabase
    .from('club_waitlist')
    .select('user_id', { count: 'exact', head: true })
    .eq('club_id', clubId)
  const position = (count ?? 0) + 1
  // club_waitlist has only (club_id, user_id, joined_at) -- there is no
  // position column; position is derived from arrival order.
  const { error } = await supabase
    .from('club_waitlist')
    .insert({ club_id: clubId, user_id: user.id })
  if (error && !error.message.includes('duplicate')) {
    console.warn('[clubs] joinWaitlist failed:', error.message)
    return null
  }
  return position
}

export async function getWaitlistPosition(clubId: string): Promise<number | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // No position column on club_waitlist; derive it from arrival order, matching
  // joinWaitlist (position = number of rows joined at or before this user).
  const { data: mine } = await supabase
    .from('club_waitlist')
    .select('joined_at')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .maybeSingle()
  const joinedAt = (mine as { joined_at: string } | null)?.joined_at
  if (!joinedAt) return null
  const { count } = await supabase
    .from('club_waitlist')
    .select('user_id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .lte('joined_at', joinedAt)
  return count ?? null
}

// ── Phase H notification helpers ────────────────────────────────────────

// ── Books search (for current_book picker in CreateClubSheet) ───────────

export async function searchBooks(query: string, limit = 12): Promise<ClubBook[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, cover_url')
    .ilike('title', `%${q}%`)
    .limit(limit)
  if (error) {
    console.warn('[clubs] searchBooks failed:', error.message)
    return []
  }
  return ((data ?? []) as ClubBook[])
}

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
import { createNotification } from './notifications'
import { enqueue } from './offline-queue'

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
  // Schedule gate, when this matches a club_schedule.chapter_gate whose
  // unlock_date is in the future, the thread is locked in the UI.
  chapter_gate?: string | null
  created_by: string
  is_starter: boolean
  pinned: boolean
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
    .select('*, profile:profiles!user_id(id, display_name, username, avatar_url)')
    .eq('club_id', clubId)
    .order('joined_at', { ascending: true })
  if (error) {
    console.warn('[clubs] fetchMembers failed:', error.message)
    return []
  }
  return ((data ?? []) as unknown) as ClubMember[]
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

export async function fetchThreads(clubId: string): Promise<ClubThread[]> {
  const { data, error } = await supabase
    .from('club_threads')
    .select('*, author:profiles!created_by(id, display_name, username, avatar_url)')
    .eq('club_id', clubId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[clubs] fetchThreads failed:', error.message)
    return []
  }
  return ((data ?? []) as unknown) as ClubThread[]
}

export async function fetchThread(threadId: string): Promise<ClubThread | null> {
  const { data, error } = await supabase
    .from('club_threads')
    .select('*, author:profiles!created_by(id, display_name, username, avatar_url)')
    .eq('id', threadId)
    .maybeSingle()
  if (error) {
    console.warn('[clubs] fetchThread failed:', error.message)
    return null
  }
  return (data as unknown) as ClubThread | null
}

export async function createThread(input: {
  clubId: string
  title: string
  chapter?: string | null
  isStarter?: boolean
  openingPost?: string
  hasSpoilers?: boolean
}): Promise<ClubThread | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('club_threads')
    .insert({
      club_id: input.clubId,
      title: input.title,
      chapter: input.chapter ?? null,
      created_by: user.id,
      is_starter: !!input.isStarter,
    })
    .select()
    .single()
  if (error) {
    console.warn('[clubs] createThread failed:', error.message)
    return null
  }
  if (input.openingPost?.trim()) {
    await createPost({
      threadId: data.id,
      body: input.openingPost.trim(),
      hasSpoilers: !!input.hasSpoilers,
    })
  }
  return data as ClubThread
}

// ── Posts ────────────────────────────────────────────────────────────────

// Returns posts in chronological order with reactions hydrated for the
// current viewer. Caller is responsible for parent → child arrangement
// (we render one level of nesting client-side).
export async function fetchPosts(threadId: string): Promise<ClubPost[]> {
  const { data: { user } } = await supabase.auth.getUser()
  const viewerId = user?.id ?? null

  const { data, error } = await supabase
    .from('club_posts')
    .select('*, author:profiles!author_id(id, display_name, username, avatar_url)')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[clubs] fetchPosts failed:', error.message)
    return []
  }
  const posts = ((data ?? []) as unknown) as ClubPost[]
  if (posts.length === 0) return posts

  // Hydrate reactions in one query, group client-side.
  const ids = posts.map((p) => p.id)
  const { data: reacts } = await supabase
    .from('club_post_reactions')
    .select('post_id, user_id, emoji')
    .in('post_id', ids)
  const byPost = new Map<string, Map<string, { count: number; viewerReacted: boolean }>>()
  for (const r of (reacts ?? []) as Array<{ post_id: string; user_id: string; emoji: string }>) {
    if (!byPost.has(r.post_id)) byPost.set(r.post_id, new Map())
    const m = byPost.get(r.post_id)!
    const cur = m.get(r.emoji) ?? { count: 0, viewerReacted: false }
    cur.count += 1
    if (viewerId && r.user_id === viewerId) cur.viewerReacted = true
    m.set(r.emoji, cur)
  }
  return posts.map((p) => ({
    ...p,
    reactions: Array.from(byPost.get(p.id)?.entries() ?? []).map(([emoji, v]) => ({
      emoji,
      count: v.count,
      viewerReacted: v.viewerReacted,
    })),
  }))
}

export async function createPost(input: {
  threadId: string
  parentPostId?: string | null
  body: string
  hasSpoilers?: boolean
}): Promise<ClubPost | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const insertPayload = {
    thread_id: input.threadId,
    parent_post_id: input.parentPostId ?? null,
    author_id: user.id,
    content: input.body,
    has_spoiler: !!input.hasSpoilers,
  }
  const { data, error } = await supabase
    .from('club_posts')
    .insert(insertPayload)
    .select('*, author:profiles!author_id(id, display_name, username, avatar_url)')
    .single()
  if (error) {
    console.warn('[clubs] createPost failed:', error.message)
    // Queue for retry on reconnect.
    enqueue({ table: 'club_posts', op: 'insert', data: insertPayload }).catch(() => {})
    return null
  }
  // first_discussion badge unlock
  checkAndAwardBadges(user.id).catch(() => {})
  return (data as unknown) as ClubPost
}

// ── Phase G enhancements: waitlist, schedule, save/report posts, stats ──

export interface ClubScheduleRow {
  club_id: string
  chapter_gate: string
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
      .select('id, author_id, thread:club_threads!thread_id(club_id), author:profiles!author_id(display_name, username)')
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
    author: { display_name: string | null; username: string | null }
      | Array<{ display_name: string | null; username: string | null }>
      | null
  }
  const posts = (((postsRes.data ?? []) as unknown) as PR[]).filter((p) => {
    const t = Array.isArray(p.thread) ? p.thread[0] : p.thread
    return t?.club_id === clubId
  })
  const tally = new Map<string, { count: number; profile: { display_name: string | null; username: string | null } | null }>()
  for (const p of posts) {
    const cur = tally.get(p.author_id)
    const profile = Array.isArray(p.author) ? p.author[0] ?? null : p.author
    tally.set(p.author_id, {
      count: (cur?.count ?? 0) + 1,
      profile: cur?.profile ?? profile,
    })
  }
  let mostActive: ClubStats['mostActive'] = null
  for (const [user_id, v] of tally) {
    if (!mostActive || v.count > mostActive.count) {
      mostActive = {
        user_id,
        display_name: v.profile?.display_name ?? null,
        username: v.profile?.username ?? null,
        count: v.count,
      }
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
    .select('club_id, chapter_gate, unlock_date')
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
  const { error } = await supabase
    .from('club_waitlist')
    .insert({ club_id: clubId, user_id: user.id, position })
  if (error && !error.message.includes('duplicate')) {
    console.warn('[clubs] joinWaitlist failed:', error.message)
    return null
  }
  return position
}

export async function getWaitlistPosition(clubId: string): Promise<number | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('club_waitlist')
    .select('position')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .maybeSingle()
  return ((data as { position: number } | null)?.position) ?? null
}

export async function savePost(postId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase
    .from('saved_posts')
    .insert({ user_id: user.id, post_id: postId })
  if (error && !error.message.includes('duplicate')) {
    console.warn('[clubs] savePost failed:', error.message)
    return false
  }
  return true
}

// ── Phase H notification helpers ────────────────────────────────────────

// Notify all OTHER members of a club that one of them just finished the
// current book. Use after user_books goes to status='finished'. Skips the
// finisher themselves; iterates clubs server-side filter to clubs reading
// the book.
export async function notifyClubMembersOfFinish(input: {
  finisherUserId: string
  bookId: string
  bookTitle: string
}): Promise<void> {
  try {
    const { data: clubs } = await supabase
      .from('clubs')
      .select('id, name')
      .eq('current_book_id', input.bookId)
    if (!clubs || clubs.length === 0) return
    // Look up the finisher's display name in one query.
    const { data: prof } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', input.finisherUserId)
      .maybeSingle()
    const finisherName =
      ((prof as { display_name?: string | null; username?: string | null } | null)?.display_name)
      ?? ((prof as { username?: string | null } | null)?.username)
      ?? 'Someone'
    const mod = await import('./notifications')
    for (const c of clubs as Array<{ id: string; name: string }>) {
      const { data: members } = await supabase
        .from('club_members')
        .select('user_id')
        .eq('club_id', c.id)
        .neq('user_id', input.finisherUserId)
      for (const m of (members ?? []) as Array<{ user_id: string }>) {
        await mod.createNotification(
          m.user_id,
          'member_finished',
          `${finisherName} just finished ${input.bookTitle}!`,
          `See their thoughts in ${c.name}.`,
          { book_id: input.bookId, club_id: c.id, finisher_id: input.finisherUserId },
        )
      }
    }
  } catch (e) {
    console.warn('[clubs] notifyClubMembersOfFinish failed:', e instanceof Error ? e.message : e)
  }
}

// Notify all members of a club that a scheduled chapter just unlocked.
// Caller passes the chapter label that just opened.
export async function notifyChapterUnlock(input: {
  clubId: string
  chapterName: string
}): Promise<void> {
  try {
    const { data: club } = await supabase
      .from('clubs')
      .select('name')
      .eq('id', input.clubId)
      .maybeSingle()
    const clubName = (club as { name?: string } | null)?.name ?? 'your club'
    const { data: members } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', input.clubId)
    if (!members || members.length === 0) return
    const mod = await import('./notifications')
    for (const m of members as Array<{ user_id: string }>) {
      await mod.createNotification(
        m.user_id,
        'chapter_unlock',
        `New chapter unlocked in ${clubName}`,
        `${input.chapterName} is now open for discussion.`,
        { club_id: input.clubId, chapter_name: input.chapterName },
      )
    }
  } catch (e) {
    console.warn('[clubs] notifyChapterUnlock failed:', e instanceof Error ? e.message : e)
  }
}

export async function reportPost(postId: string, reason: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase
    .from('post_reports')
    .insert({
      post_id: postId,
      reporter_id: user.id,
      reason,
      post_type: 'club_post',
    })
  if (error) {
    // Duplicate report from same user is non-fatal.
    if (error.code === '23505') return true
    console.warn('[clubs] reportPost failed:', error.message)
    return false
  }
  return true
}

export async function toggleReaction(postId: string, emoji: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: existing } = await supabase
    .from('club_post_reactions')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .maybeSingle()
  if (existing) {
    const { error } = await supabase
      .from('club_post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
    return !error
  }
  const { error } = await supabase
    .from('club_post_reactions')
    .insert({ post_id: postId, user_id: user.id, emoji })
  if (error) return false
  // Notify the post owner (skip self-reactions).
  ;(async () => {
    const { data: post } = await supabase
      .from('club_posts')
      .select('author_id, thread_id, thread:club_threads!thread_id(club_id, title)')
      .eq('id', postId)
      .maybeSingle()
    const p = post as
      | {
          author_id: string
          thread_id: string
          thread:
            | { club_id: string; title: string }
            | Array<{ club_id: string; title: string }>
            | null
        }
      | null
    if (!p || p.author_id === user.id) return
    const thread = Array.isArray(p.thread) ? p.thread[0] : p.thread
    await createNotification(
      p.author_id,
      'post_reaction',
      `Someone reacted ${emoji}`,
      thread?.title ? `On "${thread.title}"` : null,
      {
        club_id: thread?.club_id,
        thread_id: p.thread_id,
        post_id: postId,
        emoji,
      },
    )
  })().catch(() => {})
  return true
}

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

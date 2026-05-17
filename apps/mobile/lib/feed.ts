// Activity feed assembly.
//
// The feed has no dedicated `events` table, we fan out reads across the
// six tables that already log user actions, then merge and sort by event
// timestamp. This keeps Phase 3 v1 schema-free; if/when traffic warrants
// it, a materialized `activity_events` view is the obvious next step.
//
// Cursor model: a single `before` ISO timestamp shared across all sources.
// Each pagination call fetches rows older than the cursor from every source
// in parallel, merges, sorts, and trims to `PAGE_SIZE`. Sources may return
// fewer rows than requested, that's expected and just means that source
// has been exhausted for this page.

import { supabase } from './supabase'

export type ActivityType =
  | 'started_book'
  | 'finished_book'
  | 'added_to_library'
  | 'highlighted'
  | 'looked_up_word'
  | 'earned_badge'
  | 'followed_user'
  | 'chapter_reaction'

export interface ActivityActor {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

export interface ActivityBook {
  id: string
  title: string
  author: string
  cover_url: string | null
}

export interface ActivityBadge {
  slug: string
  name: string
}

export interface ActivityEvent {
  // Composite key, `<type>:<row-id>`. Used to dedupe across paginations
  // and to avoid double-rendering events that arrive via realtime AND a
  // subsequent fetch.
  key: string
  type: ActivityType
  actorId: string
  // Raw foreign-key IDs the row carries, hydrated to full objects below.
  bookId?: string | null
  targetUserId?: string | null
  badgeId?: string | null
  createdAt: string // ISO

  // Per-type payload pulled directly off the source row.
  text?: string
  word?: string
  color?: string | null
  // Chapter reaction payload, `text` doubles as the optional note since
  // it's never set alongside a highlight body.
  reactionEmoji?: string
  reactionChapter?: string | null

  // Hydrated after `hydrateEvents`. Optional because we keep raw events
  // available even if a profile/book/badge can't be resolved.
  actor?: ActivityActor
  book?: ActivityBook
  targetUser?: ActivityActor
  badge?: ActivityBadge
}

export const PAGE_SIZE = 20
// Oversample per source: a single source could dominate the page, so
// fetching more than PAGE_SIZE per source reduces the chance of a "phantom
// gap" where a later page would have missed events.
const PER_SOURCE_LIMIT = 30

// ──────────────────────────────────────────────────────────────────────────
// Followed-IDs lookup
// ──────────────────────────────────────────────────────────────────────────

export async function getFollowedIds(viewerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', viewerId)
  if (error) {
    console.warn('[feed] getFollowedIds failed:', error.message)
    return []
  }
  return ((data ?? []) as Array<{ following_id: string }>).map((r) => r.following_id)
}

// ──────────────────────────────────────────────────────────────────────────
// Page fetcher
// ──────────────────────────────────────────────────────────────────────────

export async function fetchActivityPage(
  followedIds: string[],
  before: string | null,
): Promise<ActivityEvent[]> {
  if (followedIds.length === 0) return []

  // `lt` cursor: nothing strictly newer than `before` is returned. On the
  // first call we want all recent events, so use "now" as the cursor.
  const cursorIso = before ?? new Date().toISOString()

  const [
    startedRes,
    finishedRes,
    addedRes,
    highlightsRes,
    vocabRes,
    badgesRes,
    followsRes,
    chapterReactionsRes,
  ] = await Promise.all([
    supabase
      .from('user_books')
      .select('id, user_id, book_id, started_at')
      .in('user_id', followedIds)
      .not('started_at', 'is', null)
      .lt('started_at', cursorIso)
      .order('started_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from('user_books')
      .select('id, user_id, book_id, finished_at')
      .in('user_id', followedIds)
      .eq('status', 'finished')
      .not('finished_at', 'is', null)
      .lt('finished_at', cursorIso)
      .order('finished_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from('user_books')
      .select('id, user_id, book_id, created_at')
      .in('user_id', followedIds)
      .eq('status', 'want_to_read')
      .lt('created_at', cursorIso)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from('highlights')
      .select('id, user_id, book_id, text, color, created_at')
      .in('user_id', followedIds)
      .lt('created_at', cursorIso)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from('vocabulary')
      .select('id, user_id, book_id, word, created_at')
      .in('user_id', followedIds)
      .lt('created_at', cursorIso)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from('user_badges')
      .select('id, user_id, badge_id, earned_at')
      .in('user_id', followedIds)
      .lt('earned_at', cursorIso)
      .order('earned_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from('follows')
      .select('follower_id, following_id, created_at')
      .in('follower_id', followedIds)
      .lt('created_at', cursorIso)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    // Chapter reactions, only the public ones show up in the public feed.
    // Close-friends-tier reactions are surfaced via a separate path (TBD).
    supabase
      .from('chapter_reactions')
      .select('id, user_id, book_id, chapter_name, emoji, note, created_at')
      .in('user_id', followedIds)
      .eq('privacy', 'public')
      .lt('created_at', cursorIso)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT),
  ])

  // Log any source-level errors but keep going, a single source failing
  // shouldn't blank the whole feed.
  for (const [name, res] of [
    ['started', startedRes],
    ['finished', finishedRes],
    ['added', addedRes],
    ['highlights', highlightsRes],
    ['vocab', vocabRes],
    ['badges', badgesRes],
    ['follows', followsRes],
    ['chapter_reactions', chapterReactionsRes],
  ] as const) {
    if (res.error) console.warn(`[feed] source "${name}" failed:`, res.error.message)
  }

  const events: ActivityEvent[] = []

  for (const r of (startedRes.data ?? []) as Array<{
    id: string; user_id: string; book_id: string | null; started_at: string
  }>) {
    events.push({
      key: `started:${r.id}`,
      type: 'started_book',
      actorId: r.user_id,
      bookId: r.book_id,
      createdAt: r.started_at,
    })
  }
  for (const r of (finishedRes.data ?? []) as Array<{
    id: string; user_id: string; book_id: string | null; finished_at: string
  }>) {
    events.push({
      key: `finished:${r.id}`,
      type: 'finished_book',
      actorId: r.user_id,
      bookId: r.book_id,
      createdAt: r.finished_at,
    })
  }
  for (const r of (addedRes.data ?? []) as Array<{
    id: string; user_id: string; book_id: string | null; created_at: string
  }>) {
    events.push({
      key: `added:${r.id}`,
      type: 'added_to_library',
      actorId: r.user_id,
      bookId: r.book_id,
      createdAt: r.created_at,
    })
  }
  for (const r of (highlightsRes.data ?? []) as Array<{
    id: string; user_id: string; book_id: string | null; text: string | null; color: string | null; created_at: string
  }>) {
    events.push({
      key: `highlight:${r.id}`,
      type: 'highlighted',
      actorId: r.user_id,
      bookId: r.book_id,
      text: r.text ?? undefined,
      color: r.color,
      createdAt: r.created_at,
    })
  }
  for (const r of (vocabRes.data ?? []) as Array<{
    id: string; user_id: string; book_id: string | null; word: string | null; created_at: string
  }>) {
    events.push({
      key: `vocab:${r.id}`,
      type: 'looked_up_word',
      actorId: r.user_id,
      bookId: r.book_id,
      word: r.word ?? undefined,
      createdAt: r.created_at,
    })
  }
  for (const r of (badgesRes.data ?? []) as Array<{
    id: string; user_id: string; badge_id: string; earned_at: string
  }>) {
    events.push({
      key: `badge:${r.id}`,
      type: 'earned_badge',
      actorId: r.user_id,
      badgeId: r.badge_id,
      createdAt: r.earned_at,
    })
  }
  for (const r of (followsRes.data ?? []) as Array<{
    follower_id: string; following_id: string; created_at: string
  }>) {
    events.push({
      // Follows have no row id, synthesize from the edge pair.
      key: `follow:${r.follower_id}:${r.following_id}`,
      type: 'followed_user',
      actorId: r.follower_id,
      targetUserId: r.following_id,
      createdAt: r.created_at,
    })
  }
  for (const r of (chapterReactionsRes.data ?? []) as Array<{
    id: string
    user_id: string
    book_id: string | null
    chapter_name: string | null
    emoji: string
    note: string | null
    created_at: string
  }>) {
    events.push({
      key: `chapter_reaction:${r.id}`,
      type: 'chapter_reaction',
      actorId: r.user_id,
      bookId: r.book_id,
      createdAt: r.created_at,
      text: r.note ?? undefined,
      reactionEmoji: r.emoji,
      reactionChapter: r.chapter_name,
    })
  }

  events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  return events.slice(0, PAGE_SIZE)
}

// ──────────────────────────────────────────────────────────────────────────
// Hydration, fill in actor/book/badge/targetUser
// ──────────────────────────────────────────────────────────────────────────

export async function hydrateEvents(events: ActivityEvent[]): Promise<ActivityEvent[]> {
  if (events.length === 0) return events

  const actorIds = new Set<string>()
  const bookIds = new Set<string>()
  const badgeIds = new Set<string>()
  const targetIds = new Set<string>()

  for (const e of events) {
    if (e.actorId) actorIds.add(e.actorId)
    if (e.bookId) bookIds.add(e.bookId)
    if (e.badgeId) badgeIds.add(e.badgeId)
    if (e.targetUserId) targetIds.add(e.targetUserId)
  }
  // Both actor and target are profiles, one query covers both.
  const profileIds = new Set<string>([...actorIds, ...targetIds])

  const [profilesRes, booksRes, badgesRes] = await Promise.all([
    profileIds.size
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', [...profileIds])
      : Promise.resolve({ data: [] as ActivityActor[], error: null }),
    bookIds.size
      ? supabase
          .from('books')
          .select('id, title, author, cover_url')
          .in('id', [...bookIds])
      : Promise.resolve({ data: [] as ActivityBook[], error: null }),
    badgeIds.size
      ? supabase
          .from('badges')
          .select('id, slug, name')
          .in('id', [...badgeIds])
      : Promise.resolve({ data: [] as Array<{ id: string; slug: string; name: string }>, error: null }),
  ])

  const profileMap = new Map<string, ActivityActor>(
    ((profilesRes.data ?? []) as ActivityActor[]).map((p) => [p.id, p]),
  )
  const bookMap = new Map<string, ActivityBook>(
    ((booksRes.data ?? []) as ActivityBook[]).map((b) => [b.id, b]),
  )
  const badgeMap = new Map<string, ActivityBadge & { id: string }>(
    ((badgesRes.data ?? []) as Array<{ id: string; slug: string; name: string }>).map((b) => [b.id, b]),
  )

  return events.map((e) => ({
    ...e,
    actor: profileMap.get(e.actorId),
    book: e.bookId ? bookMap.get(e.bookId) : undefined,
    targetUser: e.targetUserId ? profileMap.get(e.targetUserId) : undefined,
    badge: e.badgeId ? badgeMap.get(e.badgeId) : undefined,
  }))
}

// Format an ISO timestamp as "5m ago", "yesterday", "Mar 5". Locale-aware
// for older dates only, the bucketed labels read the same in every locale.
export function relativeTime(iso: string): string {
  const now = Date.now()
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const sec = Math.max(0, Math.floor((now - t) / 1000))
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'yesterday'
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

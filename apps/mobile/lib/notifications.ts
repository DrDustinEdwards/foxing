// In-app notifications.
//
// SQL SCHEMA:
//
//   create table notifications (
//     id uuid primary key default gen_random_uuid(),
//     user_id uuid not null references profiles(id) on delete cascade,
//     type text not null,
//     title text not null,
//     body text,
//     data jsonb default '{}'::jsonb,
//     read_at timestamptz,
//     created_at timestamptz not null default now()
//   );
//   create index notifications_user_unread on notifications(user_id, read_at);
//
// Realtime publication: add `notifications` to `supabase_realtime` so the
// bell badge updates without a refresh.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'

export type NotificationType =
  | 'new_follower'
  | 'passage_reply'
  | 'post_reaction'
  | 'badge_earned'
  | 'club_book_changed'
  | 'streak_risk'
  | 'chapter_unlock'
  | 'member_finished'
  | 'shared_highlight'
  | 'weekly_digest'
  | 'level_up'
  | 'book_recommendation'
  | 'year_in_reading'

export interface NotificationRow {
  id: string
  user_id: string
  type: NotificationType | string
  title: string
  body: string | null
  data: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string | null,
  data: Record<string, unknown> = {},
): Promise<void> {
  // Best-effort fire-and-forget, never block the action that triggered the
  // notification on the notification write.
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      data,
    })
    if (error) console.warn('[notifications] insert failed:', error.message)
  } catch (e) {
    console.warn('[notifications] insert threw:', e instanceof Error ? e.message : e)
  }
}

export async function listNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    console.warn('[notifications] list failed:', error.message)
    return []
  }
  return ((data ?? []) as unknown) as NotificationRow[]
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) {
    console.warn('[notifications] unread count failed:', error.message)
    return 0
  }
  return count ?? 0
}

export async function markRead(notificationId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
}

export async function markAllRead(userId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await supabase.from('notifications').delete().eq('id', notificationId)
}

// Weekly digest, call on app open. Idempotent within a 6-day window so a
// user opening the app several times on Sunday only gets one digest.
//
// Tracking lives in AsyncStorage rather than a column on profiles to keep
// the schema unchanged.

const WEEKLY_DIGEST_KEY = 'last_weekly_digest_at'

export async function weeklyDigestCheck(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Sunday only. Local time, matches what the user expects given
    // "this week" framing.
    const now = new Date()
    if (now.getDay() !== 0) return
    const lastIso = await AsyncStorage.getItem(`${WEEKLY_DIGEST_KEY}:${user.id}`)
    if (lastIso) {
      const lastTime = new Date(lastIso).getTime()
      if (Number.isFinite(lastTime) && Date.now() - lastTime < 6 * 86_400_000) return
    }
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const [sessionsRes, highlightsRes] = await Promise.all([
      supabase
        .from('reading_sessions')
        .select('started_at, ended_at, pages_read')
        .eq('user_id', user.id)
        .gte('started_at', since),
      supabase
        .from('highlights')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', since),
    ])
    type S = { started_at: string; ended_at: string | null; pages_read: number | null }
    const sessions = (sessionsRes.data ?? []) as S[]
    const days = new Set(sessions.map((s) => s.started_at.slice(0, 10))).size
    const pages = sessions.reduce((acc, s) => acc + (s.pages_read ?? 0), 0)
    const highlights = highlightsRes.count ?? 0
    // Only ship the digest if the user did at least something this week.
    // otherwise it's a sad reminder of inactivity.
    if (days === 0 && pages === 0 && highlights === 0) {
      await AsyncStorage.setItem(`${WEEKLY_DIGEST_KEY}:${user.id}`, now.toISOString())
      return
    }
    await createNotification(
      user.id,
      'weekly_digest',
      'Your week in reading',
      `${pages.toLocaleString()} pages · ${days} day${days === 1 ? '' : 's'} · ${highlights} highlight${highlights === 1 ? '' : 's'} this week`,
      { pages, days, highlights },
    )
    await AsyncStorage.setItem(`${WEEKLY_DIGEST_KEY}:${user.id}`, now.toISOString())
  } catch (e) {
    console.warn('[notifications] weeklyDigestCheck failed:', e instanceof Error ? e.message : e)
  }
}

// Resolve where tapping a notification should go. Returns an Expo Router
// href or null if there's nowhere meaningful to send the user.
export function notificationRoute(n: NotificationRow): string | null {
  const data = (n.data ?? {}) as Record<string, unknown>
  switch (n.type) {
    case 'new_follower': {
      const id = data.follower_id
      return typeof id === 'string' ? `/user/${id}` : null
    }
    case 'passage_reply': {
      const cfi = data.cfi
      const bookId = data.book_id
      return typeof bookId === 'string' && typeof cfi === 'string'
        ? `/reader/${bookId}`
        : null
    }
    case 'post_reaction': {
      const clubId = data.club_id
      const threadId = data.thread_id
      return typeof clubId === 'string' && typeof threadId === 'string'
        ? `/clubs/${clubId}/thread/${threadId}`
        : null
    }
    case 'badge_earned':
      return '/badges'
    case 'club_book_changed': {
      const clubId = data.club_id
      return typeof clubId === 'string' ? `/clubs/${clubId}` : null
    }
    case 'streak_risk':
      return '/goals'
    case 'chapter_unlock': {
      const clubId = data.club_id
      return typeof clubId === 'string' ? `/clubs/${clubId}` : null
    }
    case 'member_finished': {
      const bookId = data.book_id
      return typeof bookId === 'string' ? `/book/${bookId}` : null
    }
    case 'shared_highlight': {
      const bookId = data.book_id
      return typeof bookId === 'string' ? `/reader/${bookId}` : null
    }
    case 'weekly_digest':
      return '/goals'
    case 'level_up':
      return '/badges'
    case 'year_in_reading':
      return '/year-in-reading'
    default:
      return null
  }
}

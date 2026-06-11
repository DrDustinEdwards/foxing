// Reading streaks + badge awarding.
//
// SQL SCHEMA (apply via Supabase migrations before these helpers do anything
// useful; reading_streaks and badges/user_badges already exist per the
// profile.tsx queries we shipped earlier, added here for completeness):
//
//   create table reading_streaks (
//     user_id uuid primary key references profiles(id) on delete cascade,
//     current_streak integer not null default 0,
//     longest_streak integer not null default 0,
//     last_read_date date,
//     streak_freeze_credits integer not null default 0,
//     total_books_finished integer not null default 0,
//     total_highlights integer not null default 0,
//     total_words_looked_up integer not null default 0,
//     updated_at timestamptz not null  -- live column has NO default;
//                                      -- every writer must set it
//   );
//
//   -- badges expected slugs: first_book, ten_books, hundred_books,
//   --   first_highlight, hundred_highlights, first_club, club_founder,
//   --   first_discussion, week_streak, month_streak, year_streak,
//   --   speed_reader
//
//   create table reading_goals (
//     id uuid primary key default gen_random_uuid(),
//     user_id uuid not null references profiles(id) on delete cascade,
//     year integer not null,
//     type text not null check (type in ('books_year','pages_day','minutes_day')),
//     target integer not null,
//     created_at timestamptz not null default now(),
//     unique (user_id, year, type)
//   );

import { supabase } from './supabase'

const DAY_MS = 86_400_000

function dateOnlyUtc(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input
  return d.toISOString().slice(0, 10)
}

function daysBetweenUtc(later: string, earlier: string): number {
  const a = new Date(later + 'T00:00:00Z').getTime()
  const b = new Date(earlier + 'T00:00:00Z').getTime()
  return Math.round((a - b) / DAY_MS)
}

// Call after a reading session ends. Idempotent within a calendar day:
// a second call same-day is a no-op for streak length, but tallies refresh.
export async function updateStreak(userId: string): Promise<void> {
  const today = dateOnlyUtc(new Date())

  const [streakRes, finishedRes, highlightsRes, vocabRes] = await Promise.all([
    supabase
      .from('reading_streaks')
      .select('current_streak, longest_streak, last_read_date, streak_freeze_credits')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_books')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'finished'),
    supabase
      .from('highlights')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('vocabulary')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ])

  const existing = streakRes.data as
    | {
        current_streak: number | null
        longest_streak: number | null
        last_read_date: string | null
        streak_freeze_credits: number | null
      }
    | null

  let currentStreak = existing?.current_streak ?? 0
  let longestStreak = existing?.longest_streak ?? 0
  let freezeCredits = existing?.streak_freeze_credits ?? 0
  const lastRead = existing?.last_read_date ?? null

  if (!lastRead) {
    currentStreak = 1
  } else {
    const gap = daysBetweenUtc(today, lastRead)
    if (gap <= 0) {
      // already counted today (or clock skew), no change to length
    } else if (gap === 1) {
      currentStreak += 1
    } else if (freezeCredits > 0) {
      freezeCredits -= 1
      currentStreak += 1
    } else {
      currentStreak = 1
    }
  }
  if (currentStreak > longestStreak) longestStreak = currentStreak

  // updated_at exists on the live table as NOT NULL with no default, so
  // the upsert must supply it explicitly. Omitting it (as a prior fix did,
  // believing the column didn't exist) violates the constraint and the row
  // never lands.
  const { error } = await supabase
    .from('reading_streaks')
    .upsert(
      {
        user_id: userId,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_read_date: today,
        streak_freeze_credits: freezeCredits,
        total_books_finished: finishedRes.count ?? 0,
        total_highlights: highlightsRes.count ?? 0,
        total_words_looked_up: vocabRes.count ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
  if (error) {
    throw new Error(`reading_streaks upsert failed: ${error.message}`)
  }

  // First-streak notification prompt. The moment a user lands on a 1-day
  // streak we ask once for push permission so the daily-reminder + streak-
  // risk notifications can land. Tracked via AsyncStorage so a user who
  // declined doesn't get re-prompted every login.
  if (currentStreak === 1) {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
      const key = `foxing.notif-prompt-asked.${userId}`
      const asked = await AsyncStorage.getItem(key)
      if (asked !== 'true') {
        await AsyncStorage.setItem(key, 'true')
        const { ensureNotificationPermission } = await import('./local-notifications')
        await ensureNotificationPermission().catch(() => false)
      }
    } catch {
      /* notifications module unavailable, silent */
    }
  }

  // Streak length changes can unlock week/month/year badges, re-check.
  await checkAndAwardBadges(userId)
}

// In-app streak-at-risk warning. Call on app foreground (or from a daily
// scheduled job), *not* from updateStreak directly, since the user has
// just read by the time updateStreak runs.
//
// Conditions per spec:
//   - local time after 8pm
//   - current_streak > 0
//   - user has NOT read today (last_read_date != today)
//
// Idempotent within a single risk window via AsyncStorage so we don't
// double-fire when the user backgrounds + foregrounds the app.
export async function checkStreakRisk(userId: string): Promise<void> {
  const now = new Date()
  if (now.getHours() < 20) return
  const today = dateOnlyUtc(now)
  // Per-day dedupe key, re-allow next day automatically.
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage')
    const key = `streak_risk_sent:${userId}:${today}`
    const already = await AsyncStorage.getItem(key)
    if (already === '1') return
    const { data } = await supabase
      .from('reading_streaks')
      .select('current_streak, last_read_date')
      .eq('user_id', userId)
      .maybeSingle()
    const row = data as { current_streak: number | null; last_read_date: string | null } | null
    const streak = row?.current_streak ?? 0
    if (streak <= 0) return
    if (row?.last_read_date === today) return
    const mod = await import('./notifications')
    await mod.createNotification(
      userId,
      'streak_risk',
      `Don't break your ${streak}-day streak!`,
      'Open a book for just 5 minutes to keep it going.',
      { current_streak: streak },
    )
    await AsyncStorage.setItem(key, '1')
  } catch (e) {
    console.warn('[streaks] checkStreakRisk failed:', e instanceof Error ? e.message : e)
  }
}

// Idempotent, awards only badges the user qualifies for but hasn't earned.
// Safe to call frequently; spec asks for this after finishes, highlights,
// club join/create, and discussion posts.
export async function checkAndAwardBadges(userId: string): Promise<void> {
  const [
    streakRes,
    finishedRes,
    highlightsRes,
    clubsRes,
    foundedRes,
    postsRes,
    speedRes,
    badgesRes,
    earnedRes,
  ] = await Promise.all([
    supabase
      .from('reading_streaks')
      .select('longest_streak')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_books')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'finished'),
    supabase
      .from('highlights')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('club_members')
      .select('club_id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('clubs')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userId),
    supabase
      .from('club_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    // speed_reader: any session with avg_wpm > 300.
    supabase
      .from('reading_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('avg_wpm', 300),
    supabase.from('badges').select('id, slug'),
    supabase.from('user_badges').select('badge_id').eq('user_id', userId),
  ])

  const finished = finishedRes.count ?? 0
  const highlights = highlightsRes.count ?? 0
  const clubsJoined = clubsRes.count ?? 0
  const clubsFounded = foundedRes.count ?? 0
  const posts = postsRes.count ?? 0
  const longestStreak = (streakRes.data as { longest_streak: number | null } | null)?.longest_streak ?? 0
  const speedQualifies = (speedRes.count ?? 0) > 0

  const eligibleSlugs = new Set<string>()
  if (finished >= 1) eligibleSlugs.add('first_book')
  if (finished >= 10) eligibleSlugs.add('ten_books')
  if (finished >= 100) eligibleSlugs.add('hundred_books')
  if (highlights >= 1) eligibleSlugs.add('first_highlight')
  if (highlights >= 100) eligibleSlugs.add('hundred_highlights')
  if (clubsJoined >= 1) eligibleSlugs.add('first_club')
  if (clubsFounded >= 1) eligibleSlugs.add('club_founder')
  if (posts >= 1) eligibleSlugs.add('first_discussion')
  if (longestStreak >= 7) eligibleSlugs.add('week_streak')
  if (longestStreak >= 30) eligibleSlugs.add('month_streak')
  if (longestStreak >= 365) eligibleSlugs.add('year_streak')
  if (speedQualifies) eligibleSlugs.add('speed_reader')

  const slugToId = new Map<string, string>()
  for (const b of (badgesRes.data ?? []) as Array<{ id: string; slug: string }>) {
    slugToId.set(b.slug, b.id)
  }
  const alreadyEarned = new Set<string>(
    ((earnedRes.data ?? []) as Array<{ badge_id: string }>).map((r) => r.badge_id),
  )

  const toAward: Array<{ user_id: string; badge_id: string }> = []
  for (const slug of eligibleSlugs) {
    const badgeId = slugToId.get(slug)
    if (badgeId && !alreadyEarned.has(badgeId)) {
      toAward.push({ user_id: userId, badge_id: badgeId })
    }
  }
  if (toAward.length === 0) return

  const { data: inserted, error } = await supabase
    .from('user_badges')
    .insert(toAward)
    .select('badge_id')
  if (error) {
    console.warn('[streaks] award failed:', error.message)
    return
  }
  // Best-effort notification: don't fail the badge award if the notifications
  // schema isn't ready. Dynamic import keeps this file from hard-depending on
  // the notifications module.
  if (inserted && inserted.length > 0) {
    // Tactile cue, the user did something worth a buzz.
    try {
      const { haptic } = await import('./haptics')
      haptic.medium()
    } catch { /* haptics unavailable */ }
    try {
      const mod = await import('./notifications')
      const idToSlug = new Map<string, string>()
      for (const b of (badgesRes.data ?? []) as Array<{ id: string; slug: string }>) {
        idToSlug.set(b.id, b.slug)
      }
      for (const row of inserted as Array<{ badge_id: string }>) {
        const slug = idToSlug.get(row.badge_id) ?? 'badge'
        await mod.createNotification(userId, 'badge_earned', 'New badge earned', `You unlocked "${slug.replace(/_/g, ' ')}".`, { badge_id: row.badge_id })
      }
    } catch {
      // notifications module not present yet, that's fine
    }
  }
}

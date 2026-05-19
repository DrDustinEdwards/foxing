import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// XP awarded per badge slug. Keep in sync with badges seeded in the DB.
const XP_BY_BADGE: Record<string, number> = {
  first_book: 50,
  ten_books: 100,
  hundred_books: 500,
  first_highlight: 25,
  hundred_highlights: 100,
  week_streak: 75,
  month_streak: 200,
  year_streak: 1000,
  first_club: 50,
  club_founder: 100,
  first_discussion: 50,
  speed_reader: 150,
  night_owl: 100,
  genre_explorer: 150,
}

type Tier = {
  level: 'bookworm' | 'reader' | 'avid_reader' | 'bibliophile' | 'scholar'
  threshold: number
}

const TIERS: Tier[] = [
  { level: 'bookworm', threshold: 0 },
  { level: 'reader', threshold: 100 },
  { level: 'avid_reader', threshold: 300 },
  { level: 'bibliophile', threshold: 600 },
  { level: 'scholar', threshold: 1000 },
]

export function levelForXp(xp: number): Tier {
  let current = TIERS[0]
  for (const t of TIERS) {
    if (xp >= t.threshold) current = t
  }
  return current
}

export function nextTierForXp(xp: number): Tier | null {
  for (const t of TIERS) {
    if (xp < t.threshold) return t
  }
  return null
}

export const LEVEL_LABEL: Record<Tier['level'], string> = {
  bookworm: 'Bookworm',
  reader: 'Reader',
  avid_reader: 'Avid Reader',
  bibliophile: 'Bibliophile',
  scholar: 'Scholar',
}

async function alreadyHas(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  badgeId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('user_badges')
    .select('user_id')
    .eq('user_id', userId)
    .eq('badge_id', badgeId)
    .maybeSingle()
  return Boolean(data)
}

async function award(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  badgeId: string,
  slug: string,
): Promise<boolean> {
  const has = await alreadyHas(admin, userId, badgeId)
  if (has) return false
  const { error } = await admin
    .from('user_badges')
    .insert({ user_id: userId, badge_id: badgeId })
  if (error) return false
  const xp = XP_BY_BADGE[slug] ?? 0
  if (xp > 0) {
    await admin.rpc('increment_xp', { user_id: userId, amount: xp })
  }
  return true
}

async function distinctFinishedGenres(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<number> {
  const { data } = await admin
    .from('user_books')
    .select('books:book_id(themes)')
    .eq('user_id', userId)
    .eq('status', 'finished')
  const rows = (data as { books: { themes: string[] | null } | null }[] | null) ?? []
  const seen = new Set<string>()
  for (const r of rows) {
    if (!r.books?.themes) continue
    for (const t of r.books.themes) seen.add(t)
  }
  return seen.size
}

async function countFinishedBooks(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<number> {
  const { count } = await admin
    .from('user_books')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'finished')
  return count ?? 0
}

async function countHighlights(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<number> {
  const { count } = await admin
    .from('highlights')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  return count ?? 0
}

async function countClubMemberships(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<number> {
  const { count } = await admin
    .from('club_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', userId)
  return count ?? 0
}

async function countCreatedClubs(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<number> {
  const { count } = await admin
    .from('clubs')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', userId)
  return count ?? 0
}

async function countDiscussionPosts(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<number> {
  const { count } = await admin
    .from('discussion_posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', userId)
  return count ?? 0
}

async function hasFastSession(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('reading_sessions')
    .select('id')
    .eq('user_id', userId)
    .gt('avg_wpm', 300)
    .limit(1)
    .maybeSingle()
  return Boolean(data)
}

async function countLateNightSessions(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<number> {
  const { data } = await admin
    .from('reading_sessions')
    .select('started_at')
    .eq('user_id', userId)
  const rows = (data as { started_at: string }[] | null) ?? []
  let n = 0
  for (const r of rows) {
    const hour = new Date(r.started_at).getUTCHours()
    if (hour >= 0 && hour < 4) n++
  }
  return n
}

async function fetchStreak(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<number> {
  const { data } = await admin
    .from('reading_streaks')
    .select('current_streak')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as { current_streak: number | null } | null)?.current_streak ?? 0
}

export async function checkAndAwardBadges(
  userId: string,
): Promise<{ awarded: string[] }> {
  if (!userId) return { awarded: [] }
  const admin = createAdminClient()
  const { data: catalog } = await admin
    .from('badges')
    .select('id, slug')
  const rows = (catalog as { id: string; slug: string }[] | null) ?? []
  const bySlug = new Map<string, string>()
  for (const b of rows) bySlug.set(b.slug, b.id)

  const awarded: string[] = []
  async function tryAward(slug: string, condition: () => Promise<boolean>) {
    const id = bySlug.get(slug)
    if (!id) return
    const has = await alreadyHas(admin, userId, id)
    if (has) return
    let met = false
    try {
      met = await condition()
    } catch {
      met = false
    }
    if (!met) return
    const ok = await award(admin, userId, id, slug)
    if (ok) awarded.push(slug)
  }

  const finishedCount = await countFinishedBooks(admin, userId)
  await tryAward('first_book', async () => finishedCount >= 1)
  await tryAward('ten_books', async () => finishedCount >= 10)
  await tryAward('hundred_books', async () => finishedCount >= 100)

  const highlightCount = await countHighlights(admin, userId)
  await tryAward('first_highlight', async () => highlightCount >= 1)
  await tryAward('hundred_highlights', async () => highlightCount >= 100)

  const streak = await fetchStreak(admin, userId)
  await tryAward('week_streak', async () => streak >= 7)
  await tryAward('month_streak', async () => streak >= 30)
  await tryAward('year_streak', async () => streak >= 365)

  await tryAward(
    'first_club',
    async () => (await countClubMemberships(admin, userId)) >= 1,
  )
  await tryAward(
    'club_founder',
    async () => (await countCreatedClubs(admin, userId)) >= 1,
  )
  await tryAward(
    'first_discussion',
    async () => (await countDiscussionPosts(admin, userId)) >= 1,
  )
  await tryAward('speed_reader', () => hasFastSession(admin, userId))
  await tryAward(
    'night_owl',
    async () => (await countLateNightSessions(admin, userId)) >= 5,
  )
  await tryAward(
    'genre_explorer',
    async () => (await distinctFinishedGenres(admin, userId)) >= 5,
  )

  await updateReadingLevel(userId)
  return { awarded }
}

export interface BadgeRow {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  category: string | null
}

export interface EarnedBadge extends BadgeRow {
  earned_at: string
}

export async function fetchUserBadges(
  userId: string,
): Promise<EarnedBadge[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_badges')
    .select(
      'earned_at, badges:badge_id(id, slug, name, description, icon, category)',
    )
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })
  const rows =
    (data as { earned_at: string; badges: BadgeRow | null }[] | null) ?? []
  return rows
    .filter((r) => r.badges)
    .map((r) => ({ ...(r.badges as BadgeRow), earned_at: r.earned_at }))
}

export async function fetchAllBadges(): Promise<BadgeRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('badges')
    .select('id, slug, name, description, icon, category')
    .order('category', { ascending: true })
  return (data as BadgeRow[] | null) ?? []
}

export async function updateReadingLevel(userId: string): Promise<void> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('xp_points, reading_level')
    .eq('id', userId)
    .maybeSingle()
  const row = data as { xp_points: number | null; reading_level: string | null } | null
  if (!row) return
  const xp = row.xp_points ?? 0
  const next = levelForXp(xp).level
  if (row.reading_level !== next) {
    await admin
      .from('profiles')
      .update({ reading_level: next })
      .eq('id', userId)
  }
}

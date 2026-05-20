import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type {
  Giveaway,
  GiveawayKind,
  GiveawayWithMeta,
} from '@/lib/giveaways-types'

export type {
  Giveaway,
  GiveawayKind,
  GiveawayWithMeta,
} from '@/lib/giveaways-types'

const COLS =
  'id, author_user_id, title, description, book_id, kind, prize_count, deadline, winner_picked_at, created_at' as const
const FULL_COLS =
  `${COLS}, book:book_id(id, slug, title, author, cover_url), author:author_user_id(username, display_name)` as const

async function fetchEntryStats(
  ids: string[],
  viewerId: string | null,
): Promise<{
  counts: Map<string, number>
  mine: Set<string>
}> {
  const admin = createAdminClient()
  const { data: countRows } = await admin
    .from('giveaway_entries')
    .select('giveaway_id')
    .in('giveaway_id', ids)
  const counts = new Map<string, number>()
  for (const r of (countRows as { giveaway_id: string }[] | null) ?? []) {
    counts.set(r.giveaway_id, (counts.get(r.giveaway_id) ?? 0) + 1)
  }
  const mine = new Set<string>()
  if (viewerId) {
    const { data: myRows } = await admin
      .from('giveaway_entries')
      .select('giveaway_id')
      .eq('user_id', viewerId)
      .in('giveaway_id', ids)
    for (const r of (myRows as { giveaway_id: string }[] | null) ?? []) {
      mine.add(r.giveaway_id)
    }
  }
  return { counts, mine }
}

export async function fetchActiveGiveaways(
  viewerId: string | null,
  kind?: GiveawayKind,
): Promise<GiveawayWithMeta[]> {
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()
  let query = admin
    .from('giveaways')
    .select(FULL_COLS)
    .gt('deadline', nowIso)
    .is('winner_picked_at', null)
    .order('deadline', { ascending: true })
  if (kind) query = query.eq('kind', kind)
  const { data } = await query
  const rows =
    (data as unknown as Array<
      Giveaway & {
        book: GiveawayWithMeta['book']
        author: GiveawayWithMeta['author']
      }
    > | null) ?? []
  if (rows.length === 0) return []
  const { counts, mine } = await fetchEntryStats(
    rows.map((r) => r.id),
    viewerId,
  )
  return rows.map((r) => ({
    ...r,
    entry_count: counts.get(r.id) ?? 0,
    viewer_entered: mine.has(r.id),
  }))
}

export async function fetchGiveawayById(
  id: string,
  viewerId: string | null,
): Promise<GiveawayWithMeta | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('giveaways')
    .select(FULL_COLS)
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const row = data as unknown as Giveaway & {
    book: GiveawayWithMeta['book']
    author: GiveawayWithMeta['author']
  }
  const { counts, mine } = await fetchEntryStats([id], viewerId)
  return {
    ...row,
    entry_count: counts.get(id) ?? 0,
    viewer_entered: mine.has(id),
  }
}

export async function fetchEndedGiveawaysForAdmin(): Promise<GiveawayWithMeta[]> {
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()
  const { data } = await admin
    .from('giveaways')
    .select(FULL_COLS)
    .lte('deadline', nowIso)
    .is('winner_picked_at', null)
    .order('deadline', { ascending: false })
  const rows =
    (data as unknown as Array<
      Giveaway & {
        book: GiveawayWithMeta['book']
        author: GiveawayWithMeta['author']
      }
    > | null) ?? []
  if (rows.length === 0) return []
  const { counts } = await fetchEntryStats(
    rows.map((r) => r.id),
    null,
  )
  return rows.map((r) => ({
    ...r,
    entry_count: counts.get(r.id) ?? 0,
    viewer_entered: false,
  }))
}

export async function fetchGiveawaysByAuthor(
  authorUserId: string,
): Promise<Giveaway[]> {
  const sb = createClient()
  const { data } = await sb
    .from('giveaways')
    .select(COLS)
    .eq('author_user_id', authorUserId)
    .order('created_at', { ascending: false })
  return (data as Giveaway[] | null) ?? []
}

export async function fetchAllActiveGiveawaySlugs(): Promise<string[]> {
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()
  const { data } = await admin
    .from('giveaways')
    .select('id')
    .gt('deadline', nowIso)
    .limit(500)
  return ((data as { id: string }[] | null) ?? []).map((r) => r.id)
}

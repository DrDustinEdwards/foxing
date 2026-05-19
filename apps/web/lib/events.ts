import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export interface PublicEvent {
  id: string
  title: string
  body: string | null
  event_date: string
  event_end_date: string | null
  event_location: string | null
  event_address: string | null
  event_city: string | null
  event_state: string | null
  event_zip: string | null
  expires_at: string
  club: {
    id: string
    slug: string | null
    name: string
    club_type: 'reading' | 'bookstore' | null
    is_verified: boolean | null
    bookstore_city: string | null
    bookstore_state: string | null
  } | null
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  } | null
}

const EVENT_COLS =
  'id, title, body, event_date, event_end_date, event_location, event_address, event_city, event_state, event_zip, expires_at, club:club_id(id, slug, name, club_type, is_verified, bookstore_city, bookstore_state), book:book_id(id, slug, title, author, cover_url)' as const

interface EventFilter {
  state?: string
  city?: string
  authorSlug?: string
  limit?: number
}

export async function fetchUpcomingEvents(
  filter: EventFilter = {},
): Promise<PublicEvent[]> {
  const admin = createAdminClient()
  let query = admin
    .from('club_announcements')
    .select(EVENT_COLS)
    .eq('is_removed', false)
    .not('event_date', 'is', null)
    .gt('event_date', new Date().toISOString())
    .gt('expires_at', new Date().toISOString())
    .order('event_date', { ascending: true })

  if (filter.state) {
    query = query.ilike('event_state', filter.state)
  }
  if (filter.city) {
    query = query.ilike('event_city', filter.city)
  }
  if (filter.limit) {
    query = query.limit(filter.limit)
  }

  if (filter.authorSlug) {
    const { data: books } = await admin
      .from('books')
      .select('id')
      .eq('author_slug', filter.authorSlug)
    const bookIds = ((books as { id: string }[] | null) ?? []).map((b) => b.id)
    if (bookIds.length === 0) return []
    query = query.in('book_id', bookIds)
  }

  const { data } = await query
  const rows = ((data as unknown as PublicEvent[] | null) ?? []).filter(
    (r) => r.club && r.club.id,
  )
  return rows.filter(
    (r) => r.club && (r.club as { id: string }).id !== undefined,
  )
}

export async function fetchEventStates(): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('club_announcements')
    .select('event_state')
    .not('event_state', 'is', null)
    .gt('event_date', new Date().toISOString())
    .gt('expires_at', new Date().toISOString())
    .eq('is_removed', false)
  const set = new Set<string>()
  for (const row of (data as { event_state: string | null }[] | null) ?? []) {
    if (row.event_state) set.add(row.event_state.toUpperCase())
  }
  return Array.from(set).sort()
}

export async function fetchEventCitiesForState(
  state: string,
): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('club_announcements')
    .select('event_city')
    .ilike('event_state', state)
    .not('event_city', 'is', null)
    .gt('event_date', new Date().toISOString())
    .gt('expires_at', new Date().toISOString())
    .eq('is_removed', false)
  const set = new Set<string>()
  for (const row of (data as { event_city: string | null }[] | null) ?? []) {
    if (row.event_city) set.add(row.event_city)
  }
  return Array.from(set).sort()
}

export function formatEventDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

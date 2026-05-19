import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface ClubAnnouncement {
  id: string
  club_id: string
  created_by: string
  title: string
  body: string | null
  event_date: string | null
  event_end_date: string | null
  event_location: string | null
  event_address: string | null
  event_city: string | null
  event_state: string | null
  event_zip: string | null
  book_id: string | null
  author_id: string | null
  expires_at: string
  is_pinned: boolean | null
  is_removed: boolean | null
  created_at: string
  updated_at: string
  created_by_profile: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  } | null
}

const ANNOUNCEMENT_COLS =
  'id, club_id, created_by, title, body, event_date, event_end_date, event_location, event_address, event_city, event_state, event_zip, book_id, author_id, expires_at, is_pinned, is_removed, created_at, updated_at, created_by_profile:created_by(username, display_name, avatar_url), book:book_id(id, slug, title, author, cover_url)' as const

function hasEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

export async function fetchAnnouncementsForClub(
  clubId: string,
): Promise<ClubAnnouncement[]> {
  if (!hasEnv()) return []
  const sb = createClient()
  const { data } = await sb
    .from('club_announcements')
    .select(ANNOUNCEMENT_COLS)
    .eq('club_id', clubId)
    .eq('is_removed', false)
    .gt('expires_at', new Date().toISOString())
  const rows = ((data as unknown as ClubAnnouncement[] | null) ?? []).filter(
    (r) => r.title,
  )
  // Pinned first; events ASC by date; announcements DESC by created_at.
  return rows.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    if (a.event_date && b.event_date) {
      return a.event_date.localeCompare(b.event_date)
    }
    if (a.event_date) return -1
    if (b.event_date) return 1
    return b.created_at.localeCompare(a.created_at)
  })
}

import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type RsvpStatus = 'going' | 'maybe' | 'not_going'
export type MeetingType = 'in_person' | 'virtual' | 'hybrid'

export interface ClubMeeting {
  id: string
  club_id: string
  created_by: string
  title: string
  description: string | null
  book_id: string | null
  meeting_date: string
  end_date: string | null
  location_name: string | null
  location_address: string | null
  location_url: string | null
  meeting_type: MeetingType
  is_recurring: boolean
  recurrence_rule: string | null
  rsvp_limit: number | null
  is_cancelled: boolean
  created_at: string
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  } | null
  rsvp_counts: { going: number; maybe: number; not_going: number }
  user_rsvp: RsvpStatus | null
}

const MEETING_COLS =
  'id, club_id, created_by, title, description, book_id, meeting_date, end_date, location_name, location_address, location_url, meeting_type, is_recurring, recurrence_rule, rsvp_limit, is_cancelled, created_at, book:book_id(id, slug, title, author, cover_url)' as const

function hasEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

export async function fetchUpcomingMeetings(
  clubId: string,
  userId: string | null,
): Promise<ClubMeeting[]> {
  if (!hasEnv()) return []
  const sb = createClient()
  const { data } = await sb
    .from('club_meetings')
    .select(MEETING_COLS)
    .eq('club_id', clubId)
    .eq('is_cancelled', false)
    .gte('meeting_date', new Date().toISOString())
    .order('meeting_date', { ascending: true })
  const rows = ((data as unknown as Array<
    Omit<ClubMeeting, 'rsvp_counts' | 'user_rsvp'>
  > | null) ?? []).filter((r) => r.id)
  if (rows.length === 0) return []

  const meetingIds = rows.map((m) => m.id)
  const { data: rsvps } = await sb
    .from('club_meeting_rsvps')
    .select('meeting_id, user_id, status')
    .in('meeting_id', meetingIds)
  const rsvpRows =
    (rsvps as { meeting_id: string; user_id: string; status: RsvpStatus }[] | null) ??
    []

  const counts = new Map<
    string,
    { going: number; maybe: number; not_going: number }
  >()
  const userByMeeting = new Map<string, RsvpStatus>()
  for (const r of rsvpRows) {
    const c = counts.get(r.meeting_id) ?? { going: 0, maybe: 0, not_going: 0 }
    c[r.status] = (c[r.status] ?? 0) + 1
    counts.set(r.meeting_id, c)
    if (userId && r.user_id === userId) {
      userByMeeting.set(r.meeting_id, r.status)
    }
  }

  return rows.map((m) => ({
    ...m,
    rsvp_counts: counts.get(m.id) ?? { going: 0, maybe: 0, not_going: 0 },
    user_rsvp: userByMeeting.get(m.id) ?? null,
  }))
}

export function formatMeetingDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

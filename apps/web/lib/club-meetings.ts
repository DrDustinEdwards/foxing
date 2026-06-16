import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type {
  RsvpStatus,
  MeetingType,
  ClubMeeting,
} from '@/lib/club-meetings-types'

export {
  type RsvpStatus,
  type MeetingType,
  type ClubMeeting,
} from '@/lib/club-meetings-types'

const MEETING_COLS =
  'id, club_id, created_by, title, description, book_id, meeting_date, end_date, location_name, location_address, location_url, meeting_type, is_recurring, recurrence_rule, rsvp_limit, is_cancelled, created_at, book:book_id(id, slug, title, author, cover_url)' as const

function hasEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

type RawMeeting = Omit<ClubMeeting, 'rsvp_counts' | 'user_rsvp'>

// Upcoming (future, ascending) and past (last 20, descending). Cancelled
// meetings are kept in their date bucket so the UI can render the cancelled
// state -- callers decide how to display them. RSVP counts + the viewer's own
// status are attached in a single rsvps round-trip across both lists.
export async function fetchClubMeetings(
  clubId: string,
  userId: string | null,
): Promise<{ upcoming: ClubMeeting[]; past: ClubMeeting[] }> {
  if (!hasEnv()) return { upcoming: [], past: [] }
  const sb = await createClient()
  const nowIso = new Date().toISOString()
  const [{ data: upData }, { data: pastData }] = await Promise.all([
    sb
      .from('club_meetings')
      .select(MEETING_COLS)
      .eq('club_id', clubId)
      .gte('meeting_date', nowIso)
      .order('meeting_date', { ascending: true }),
    sb
      .from('club_meetings')
      .select(MEETING_COLS)
      .eq('club_id', clubId)
      .lt('meeting_date', nowIso)
      .order('meeting_date', { ascending: false })
      .limit(20),
  ])
  const upRows = ((upData as unknown as RawMeeting[] | null) ?? []).filter(
    (r) => r.id,
  )
  const pastRows = ((pastData as unknown as RawMeeting[] | null) ?? []).filter(
    (r) => r.id,
  )
  const all = [...upRows, ...pastRows]
  if (all.length === 0) return { upcoming: [], past: [] }

  const { data: rsvps } = await sb
    .from('club_meeting_rsvps')
    .select('meeting_id, user_id, status')
    .in(
      'meeting_id',
      all.map((m) => m.id),
    )
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

  const decorate = (m: RawMeeting): ClubMeeting => ({
    ...m,
    rsvp_counts: counts.get(m.id) ?? { going: 0, maybe: 0, not_going: 0 },
    user_rsvp: userByMeeting.get(m.id) ?? null,
  })

  return { upcoming: upRows.map(decorate), past: pastRows.map(decorate) }
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

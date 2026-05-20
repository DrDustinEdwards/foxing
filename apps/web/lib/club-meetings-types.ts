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

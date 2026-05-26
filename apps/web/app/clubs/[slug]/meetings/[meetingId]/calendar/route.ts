import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface MeetingWithClub {
  id: string
  title: string
  description: string | null
  meeting_date: string
  end_date: string | null
  location_name: string | null
  location_address: string | null
  location_url: string | null
  is_cancelled: boolean
  clubs: { slug: string | null; visibility: string } | null
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function formatICalUTC(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

function escapeICalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function foldLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  parts.push(line.slice(0, 75))
  for (let i = 75; i < line.length; i += 74) {
    parts.push(' ' + line.slice(i, i + 74))
  }
  return parts.join('\r\n')
}

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ slug: string; meetingId: string }> }
) {
  const params = await props.params;
  const admin = createAdminClient()
  const { data } = await admin
    .from('club_meetings')
    .select(
      'id, title, description, meeting_date, end_date, location_name, location_address, location_url, is_cancelled, clubs:club_id(slug, visibility)',
    )
    .eq('id', params.meetingId)
    .maybeSingle()

  const row = data as unknown as MeetingWithClub | null
  if (!row || row.is_cancelled || !row.clubs) {
    return new Response('Meeting not found', { status: 404 })
  }
  if (row.clubs.visibility !== 'public') {
    return new Response('Meeting not found', { status: 404 })
  }
  if (row.clubs.slug && row.clubs.slug !== params.slug) {
    return new Response('Meeting not found', { status: 404 })
  }

  const start = new Date(row.meeting_date)
  const end = row.end_date
    ? new Date(row.end_date)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const now = new Date()

  const locationParts = [row.location_name, row.location_address].filter(
    Boolean,
  ) as string[]

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Foxing//Foxing Club Meetings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:meeting-${row.id}@foxing.app`,
    `DTSTAMP:${formatICalUTC(now)}`,
    `DTSTART:${formatICalUTC(start)}`,
    `DTEND:${formatICalUTC(end)}`,
    `SUMMARY:${escapeICalText(row.title)}`,
    `URL:https://foxing.app/clubs/${params.slug}`,
  ]
  if (locationParts.length > 0) {
    lines.push(`LOCATION:${escapeICalText(locationParts.join(', '))}`)
  }
  if (row.location_url) {
    lines.push(`URL:${escapeICalText(row.location_url)}`)
  }
  if (row.description) {
    lines.push(
      `DESCRIPTION:${escapeICalText(row.description.slice(0, 500))}`,
    )
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')

  const ics = lines.map(foldLine).join('\r\n') + '\r\n'

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="foxing-meeting-${row.id}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  })
}

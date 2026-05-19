import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface AnnouncementWithClub {
  id: string
  title: string
  body: string | null
  event_date: string | null
  event_end_date: string | null
  event_location: string | null
  event_address: string | null
  event_city: string | null
  event_state: string | null
  event_zip: string | null
  is_removed: boolean | null
  expires_at: string
  clubs: { name: string; visibility: string } | null
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

// RFC 5545 escape for TEXT values: backslash, semicolon, comma, newline.
function escapeICalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Lines longer than 75 octets must be folded per RFC 5545 §3.1.
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
  { params }: { params: { announcement_id: string } },
) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('club_announcements')
    .select(
      'id, title, body, event_date, event_end_date, event_location, event_address, event_city, event_state, event_zip, is_removed, expires_at, clubs:club_id(name, visibility)',
    )
    .eq('id', params.announcement_id)
    .maybeSingle()

  const row = data as unknown as AnnouncementWithClub | null
  if (!row || !row.event_date || row.is_removed || !row.clubs) {
    return new Response('Event not found', { status: 404 })
  }
  if (row.clubs.visibility !== 'public') {
    return new Response('Event not found', { status: 404 })
  }

  const start = new Date(row.event_date)
  const end = row.event_end_date
    ? new Date(row.event_end_date)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const now = new Date()

  const locationParts = [
    row.event_location,
    row.event_address,
    [row.event_city, row.event_state].filter(Boolean).join(', '),
    row.event_zip,
  ].filter(Boolean) as string[]

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Foxing//Foxing Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${row.id}@foxing.app`,
    `DTSTAMP:${formatICalUTC(now)}`,
    `DTSTART:${formatICalUTC(start)}`,
    `DTEND:${formatICalUTC(end)}`,
    `SUMMARY:${escapeICalText(row.title)}`,
    `ORGANIZER;CN=${escapeICalText(row.clubs.name)}:mailto:hello@foxing.app`,
  ]
  if (locationParts.length > 0) {
    lines.push(`LOCATION:${escapeICalText(locationParts.join(', '))}`)
  }
  if (row.body) {
    lines.push(`DESCRIPTION:${escapeICalText(row.body.slice(0, 500))}`)
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')

  const ics = lines.map(foldLine).join('\r\n') + '\r\n'

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="foxing-event-${row.id}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  })
}

import { NextResponse, type NextRequest } from 'next/server'
import { bearerFromHeaders, verifySession } from '@/lib/discord-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertActiveClubMember } from '@/lib/club-membership'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest, props: { params: Promise<{ sprintId: string }> }) {
  const params = await props.params;
  const token = bearerFromHeaders(request.headers)
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: sprint } = await admin
    .from('discord_sprints')
    .select('id, club_id, starts_at, ends_at')
    .eq('id', params.sprintId)
    .maybeSingle()
  if (!sprint) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const sprintClubId = (sprint as { club_id: string }).club_id
  const denied = await assertActiveClubMember(admin, sprintClubId, session.userId)
  if (denied) return denied

  const { data: participants } = await admin
    .from('discord_sprint_participants')
    .select('user_id, pages_read')
    .eq('sprint_id', params.sprintId)
  const rows =
    (participants as { user_id: string; pages_read: number | null }[] | null) ??
    []
  const pages = rows.reduce((sum, r) => sum + (r.pages_read ?? 0), 0)

  const row = sprint as {
    id: string
    club_id: string
    starts_at: string
    ends_at: string
  }

  return NextResponse.json({
    id: row.id,
    club_id: row.club_id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    pages_logged: pages,
    participant_count: rows.length,
  })
}

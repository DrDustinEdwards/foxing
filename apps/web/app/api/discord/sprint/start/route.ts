import { NextResponse, type NextRequest } from 'next/server'
import { bearerFromHeaders, verifySession } from '@/lib/discord-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Body {
  club_id?: string
  duration_minutes?: number
}

const ALLOWED = new Set([10, 20, 30])

export async function POST(request: NextRequest) {
  const token = bearerFromHeaders(request.headers)
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const clubId = body.club_id?.trim()
  const minutes = Number(body.duration_minutes ?? 0)
  if (!clubId || !ALLOWED.has(minutes)) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: memberRow } = await admin
    .from('club_members')
    .select('status')
    .eq('club_id', clubId)
    .eq('user_id', session.userId)
    .maybeSingle()
  if (
    !memberRow ||
    (memberRow as { status: string | null }).status !== 'active'
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const now = new Date()
  const ends = new Date(now.getTime() + minutes * 60 * 1000)
  const { data: inserted, error } = await admin
    .from('discord_sprints')
    .insert({
      club_id: clubId,
      created_by: session.userId,
      starts_at: now.toISOString(),
      ends_at: ends.toISOString(),
      duration_minutes: minutes,
    })
    .select('id, club_id, starts_at, ends_at')
    .single()
  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? 'create_failed' },
      { status: 500 },
    )
  }
  await admin
    .from('discord_sprint_participants')
    .insert({ sprint_id: inserted.id, user_id: session.userId, pages_read: 0 })

  return NextResponse.json({
    sprint: {
      id: inserted.id,
      club_id: inserted.club_id,
      starts_at: inserted.starts_at,
      ends_at: inserted.ends_at,
      pages_logged: 0,
      participant_count: 1,
    },
  })
}

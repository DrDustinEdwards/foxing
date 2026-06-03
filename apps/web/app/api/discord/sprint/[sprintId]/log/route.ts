import { NextResponse, type NextRequest } from 'next/server'
import { bearerFromHeaders, verifySession } from '@/lib/discord-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Body {
  pages_read?: number
}

export async function POST(request: NextRequest, props: { params: Promise<{ sprintId: string }> }) {
  const params = await props.params;
  const token = bearerFromHeaders(request.headers)
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const pages = Math.max(0, Math.floor(Number(body.pages_read ?? 0)))
  if (!Number.isFinite(pages)) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: sprintRow } = await admin
    .from('discord_sprints')
    .select('club_id')
    .eq('id', params.sprintId)
    .maybeSingle()
  const clubId = (sprintRow as { club_id: string } | null)?.club_id
  if (!clubId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
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

  const { error } = await admin
    .from('discord_sprint_participants')
    .upsert(
      {
        sprint_id: params.sprintId,
        user_id: session.userId,
        pages_read: pages,
      },
      { onConflict: 'sprint_id,user_id' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

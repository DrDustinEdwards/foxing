import { NextResponse, type NextRequest } from 'next/server'
import { bearerFromHeaders, verifySession } from '@/lib/discord-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertActiveClubMember } from '@/lib/club-membership'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Body {
  poll_id?: string
  option_id?: string
}

export async function POST(request: NextRequest, props: { params: Promise<{ clubId: string }> }) {
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
  if (!body.poll_id || !body.option_id) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const admin = createAdminClient()
  const denied = await assertActiveClubMember(admin, params.clubId, session.userId)
  if (denied) return denied
  const { data: poll } = await admin
    .from('club_polls')
    .select('id, club_id, closed_at')
    .eq('id', body.poll_id)
    .maybeSingle()
  const pollRow = poll as
    | { id: string; club_id: string; closed_at: string | null }
    | null
  if (!pollRow || pollRow.club_id !== params.clubId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (pollRow.closed_at) {
    return NextResponse.json({ error: 'closed' }, { status: 400 })
  }

  const { data: optionRows } = await admin
    .from('club_poll_options')
    .select('id')
    .eq('poll_id', body.poll_id)
  const optionIds = (
    (optionRows as { id: string }[] | null) ?? []
  ).map((r) => r.id)
  if (!optionIds.includes(body.option_id)) {
    return NextResponse.json({ error: 'invalid_option' }, { status: 400 })
  }

  await admin
    .from('club_poll_votes')
    .delete()
    .eq('user_id', session.userId)
    .in('option_id', optionIds)

  const { error } = await admin.from('club_poll_votes').insert({
    poll_id: body.poll_id,
    user_id: session.userId,
    option_id: body.option_id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

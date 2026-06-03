import { NextResponse, type NextRequest } from 'next/server'
import { bearerFromHeaders, verifySession } from '@/lib/discord-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Body {
  chapter_name?: string
  emoji?: string
  note?: string | null
}

const VALID_EMOJIS = new Set([
  '😭',
  '😂',
  '😱',
  '😤',
  '🥺',
  '🤯',
  '❤️',
  '🙃',
])

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
  const chapter = (body.chapter_name ?? '').trim().slice(0, 120)
  const emoji = body.emoji ?? ''
  if (!chapter || !VALID_EMOJIS.has(emoji)) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: memberRow } = await admin
    .from('club_members')
    .select('status')
    .eq('club_id', params.clubId)
    .eq('user_id', session.userId)
    .maybeSingle()
  if (
    !memberRow ||
    (memberRow as { status: string | null }).status !== 'active'
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const { data: club } = await admin
    .from('clubs')
    .select('current_book_id')
    .eq('id', params.clubId)
    .maybeSingle()
  const bookId = (club as { current_book_id: string | null } | null)
    ?.current_book_id
  if (!bookId) {
    return NextResponse.json({ error: 'no_current_book' }, { status: 400 })
  }
  const { error } = await admin.from('chapter_reactions').insert({
    user_id: session.userId,
    book_id: bookId,
    chapter_name: chapter,
    emoji,
    note: body.note?.slice(0, 280) ?? null,
    privacy: 'public',
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

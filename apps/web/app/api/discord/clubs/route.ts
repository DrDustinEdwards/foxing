import { NextResponse, type NextRequest } from 'next/server'
import { bearerFromHeaders, verifySession } from '@/lib/discord-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const token = bearerFromHeaders(request.headers)
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const session = await verifySession(token)
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('club_members')
    .select(
      'club:club_id(id, slug, name, member_count, current_book:current_book_id(id, title, author))',
    )
    .eq('user_id', session.userId)
    .eq('status', 'active')
    .limit(10)
  const rows =
    (data as unknown as Array<{
      club: {
        id: string
        slug: string | null
        name: string
        member_count: number | null
        current_book: { id: string; title: string; author: string } | null
      } | null
    }> | null) ?? []
  type ClubRow = NonNullable<(typeof rows)[number]['club']>
  const clubs = rows
    .map((row) => row.club)
    .filter((c): c is ClubRow => c !== null)
  return NextResponse.json({ clubs })
}

import { NextResponse } from 'next/server'
import { getAuthedUserId } from '@/lib/nav-user'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const viewerId = await getAuthedUserId()
  if (!viewerId) {
    return NextResponse.json(
      { viewerId: null, liked: false },
      { headers: PRIVATE_HEADERS },
    )
  }
  const admin = createAdminClient()
  const { data } = await admin
    .from('highlight_likes')
    .select('post_id')
    .eq('user_id', viewerId)
    .eq('post_id', id)
    .maybeSingle()
  return NextResponse.json(
    { viewerId, liked: Boolean(data) },
    { headers: PRIVATE_HEADERS },
  )
}

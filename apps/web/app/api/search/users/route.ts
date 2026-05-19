import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/nav-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const userId = await getAuthedUserId()
  if (!userId) {
    return NextResponse.json({ error: 'auth' }, { status: 401 })
  }
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  const limit = Math.min(
    Math.max(parseInt(request.nextUrl.searchParams.get('limit') ?? '8', 10) || 8, 1),
    20,
  )
  if (q.length < 2) return NextResponse.json([])
  const admin = createAdminClient()
  const escaped = q.replace(/%/g, '').replace(/_/g, '')
  const { data } = await admin
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('is_public', true)
    .neq('id', userId)
    .or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`)
    .limit(limit)
  return NextResponse.json((data as unknown[] | null) ?? [])
}

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get('username') ?? '').trim().toLowerCase()
  if (raw.length < 3 || raw.length > 30) {
    return NextResponse.json({ available: false, reason: 'length' })
  }
  if (!USERNAME_RE.test(raw)) {
    return NextResponse.json({ available: false, reason: 'format' })
  }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('username', raw)
    .limit(1)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ available: false, reason: 'error' }, { status: 500 })
  }
  return NextResponse.json({ available: !data })
}

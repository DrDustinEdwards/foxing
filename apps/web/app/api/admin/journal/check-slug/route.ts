import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUserId } from '@/lib/nav-user'

export async function GET(request: NextRequest) {
  try {
    await requireAdminUserId()
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const slug = request.nextUrl.searchParams.get('slug')?.trim() ?? ''
  const exclude = request.nextUrl.searchParams.get('exclude')?.trim() ?? ''
  if (!slug) {
    return NextResponse.json({ available: true })
  }

  const admin = createAdminClient()
  const base = admin.from('journal_posts').select('id').eq('slug', slug)
  const query = exclude ? base.neq('id', exclude) : base
  const { data, error } = await query.limit(1).maybeSingle()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ available: !data })
}

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUserId } from '@/lib/nav-user'

export async function GET(request: NextRequest) {
  try {
    await requireAdminUserId()
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) {
    return NextResponse.json({ results: [] })
  }

  const escaped = q.replace(/[%_\\]/g, '\\$&')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('journal_posts')
    .select('id, slug, title')
    .ilike('title', `%${escaped}%`)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(10)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({
    results: (data as Array<{ id: string; slug: string; title: string }>) ?? [],
  })
}

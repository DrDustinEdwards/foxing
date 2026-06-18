import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  const limit = Math.min(
    Math.max(parseInt(request.nextUrl.searchParams.get('limit') ?? '8', 10) || 8, 1),
    20,
  )
  if (q.length < 2) return NextResponse.json([])
  const admin = createAdminClient()
  const escaped = q.replace(/%/g, '').replace(/_/g, '')
  const { data } = await admin
    .from('books')
    .select('id, slug, title, author, cover_url')
    .or(`title.ilike.%${escaped}%,author.ilike.%${escaped}%`)
    .order('title', { ascending: true })
    .limit(limit)
  return NextResponse.json((data as unknown[] | null) ?? [])
}

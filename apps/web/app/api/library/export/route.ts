import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(_request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new NextResponse('Unauthenticated', { status: 401 })
  }
  const { data } = await supabase
    .from('user_books')
    .select(
      'status, rating, review, started_at, finished_at, created_at, books:book_id(title, author, gutenberg_id, source)',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  const rows = ((data as unknown as Array<{
    status: string
    rating: number | null
    review: string | null
    started_at: string | null
    finished_at: string | null
    created_at: string
    books: {
      title: string
      author: string
      gutenberg_id: number | null
      source: string | null
    } | null
  }> | null) ?? []).filter((r) => r.books !== null)

  const header = [
    'title',
    'author',
    'status',
    'rating',
    'review',
    'started_at',
    'finished_at',
    'added_at',
    'gutenberg_id',
    'source',
  ]
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.books!.title),
        csvEscape(r.books!.author),
        csvEscape(r.status),
        csvEscape(r.rating ?? ''),
        csvEscape(r.review ?? ''),
        csvEscape(r.started_at ?? ''),
        csvEscape(r.finished_at ?? ''),
        csvEscape(r.created_at),
        csvEscape(r.books!.gutenberg_id ?? ''),
        csvEscape(r.books!.source ?? ''),
      ].join(','),
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="foxing-library-${today}.csv"`,
    },
  })
}

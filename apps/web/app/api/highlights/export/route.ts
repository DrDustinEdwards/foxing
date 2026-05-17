import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthenticated', { status: 401 })

  const { data } = await supabase
    .from('highlights')
    .select(
      'text, note, chapter, created_at, books:book_id(title, author)',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const rows = ((data as unknown as Array<{
    text: string
    note: string | null
    chapter: string | null
    created_at: string
    books: { title: string; author: string } | null
  }> | null) ?? []).filter((r) => r.books !== null)

  const lines: string[] = []
  let currentBook: string | null = null
  for (const r of rows) {
    const bookKey = `${r.books!.title}, ${r.books!.author}`
    if (bookKey !== currentBook) {
      if (lines.length > 0) lines.push('')
      lines.push(bookKey)
      lines.push('-'.repeat(Math.min(bookKey.length, 60)))
      currentBook = bookKey
    }
    lines.push('')
    lines.push(r.text)
    if (r.note) {
      lines.push('')
      lines.push(`Note: ${r.note}`)
    }
    if (r.chapter) lines.push(`Chapter: ${r.chapter}`)
    lines.push(`Saved: ${r.created_at.slice(0, 10)}`)
  }

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'content-disposition': `attachment; filename="foxing-highlights-${today}.txt"`,
    },
  })
}

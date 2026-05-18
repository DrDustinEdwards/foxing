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

interface Row {
  word: string
  definition: string | null
  ai_context: string | null
  context_sentence: string | null
  book_title: string | null
  mastered: boolean | null
  looked_up_at: string | null
}

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get('format') === 'anki' ? 'anki' : 'csv'
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return new NextResponse('Unauthenticated', { status: 401 })

  const { data } = await sb
    .from('vocabulary')
    .select(
      'word, definition, ai_context, context_sentence, book_title, mastered, looked_up_at, books:book_id(title)',
    )
    .eq('user_id', user.id)
    .order('looked_up_at', { ascending: false })
    .limit(5000)
  const rows = ((data ?? []) as unknown as Array<
    Row & { books: { title: string } | null }
  >).map((r) => ({
    word: r.word,
    definition: r.definition ?? r.ai_context ?? '',
    context: r.context_sentence ?? '',
    book: r.books?.title ?? r.book_title ?? '',
    mastered: r.mastered ? 'yes' : 'no',
    looked_up_at: r.looked_up_at ?? '',
  }))

  const today = new Date().toISOString().slice(0, 10)

  if (format === 'anki') {
    // Anki accepts a plain tab-separated file. Columns: front, back, tags.
    // Front: word. Back: definition + optional context. Tags: book name.
    const lines: string[] = []
    for (const r of rows) {
      const front = r.word
      const back = r.context
        ? `${r.definition}\n\n${r.context}`
        : r.definition
      const tag = r.book.replace(/\s+/g, '_').slice(0, 40)
      lines.push(
        `${tabEscape(front)}\t${tabEscape(back)}\t${tag || 'foxing'}`,
      )
    }
    return new NextResponse(lines.join('\n'), {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': `attachment; filename="foxing-vocab-${today}.txt"`,
      },
    })
  }

  const header = [
    'word',
    'definition',
    'context',
    'book',
    'mastered',
    'looked_up_at',
  ]
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.word),
        csvEscape(r.definition),
        csvEscape(r.context),
        csvEscape(r.book),
        csvEscape(r.mastered),
        csvEscape(r.looked_up_at),
      ].join(','),
    )
  }
  return new NextResponse(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="foxing-vocab-${today}.csv"`,
    },
  })
}

function tabEscape(s: string): string {
  // Anki tab-separated files: replace tabs and newlines so each row stays one line.
  return s.replace(/\t/g, ' ').replace(/\r?\n/g, ' / ')
}

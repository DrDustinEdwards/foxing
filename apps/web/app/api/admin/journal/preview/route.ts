import { NextResponse, type NextRequest } from 'next/server'
import { requireAdminUserId } from '@/lib/nav-user'
import { renderJournalMarkdown } from '@/lib/journal-markdown'

export async function POST(request: NextRequest) {
  try {
    await requireAdminUserId()
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let payload: { content?: unknown }
  try {
    payload = (await request.json()) as { content?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const content = typeof payload.content === 'string' ? payload.content : ''
  const html = renderJournalMarkdown(content)
  return NextResponse.json({ html })
}

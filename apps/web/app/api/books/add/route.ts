import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DAILY_LIMIT = 5

interface Body {
  openLibraryKey?: string
  isbn?: string
  title?: string
  author?: string
  cover_url?: string
  publication_year?: number
  publisher?: string
}

interface OpenLibraryWork {
  title?: string
  description?: string | { value?: string }
  covers?: number[]
  first_publish_date?: string
}

async function fetchOpenLibraryWork(
  key: string,
): Promise<OpenLibraryWork | null> {
  const clean = key.replace(/^\/?works\//, '')
  try {
    const res = await fetch(`https://openlibrary.org/works/${clean}.json`, {
      headers: { 'User-Agent': 'Foxing/1.0 (https://foxing.app)' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return (await res.json()) as OpenLibraryWork
  } catch {
    return null
  }
}

function workDescription(work: OpenLibraryWork): string | null {
  if (!work.description) return null
  if (typeof work.description === 'string') return work.description
  return work.description.value ?? null
}

export async function POST(request: NextRequest) {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const title = body.title?.trim()
  const author = body.author?.trim()
  if (!title || !author) {
    return NextResponse.json(
      { error: 'title_and_author_required' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  if (body.isbn) {
    const isbn = body.isbn.replace(/[^0-9Xx]/g, '')
    const { data: existing } = await admin
      .from('books')
      .select('id')
      .or(`isbn.eq.${isbn},isbn13.eq.${isbn}`)
      .maybeSingle()
    const row = existing as { id: string } | null
    if (row) return NextResponse.json({ id: row.id, existing: true })
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: addedToday } = await admin
    .from('books')
    .select('id', { count: 'exact', head: true })
    .eq('added_by', user.id)
    .gt('created_at', since)
  if ((addedToday ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: 'rate_limited', limit: DAILY_LIMIT },
      { status: 429 },
    )
  }

  let description: string | null = null
  let cover_url = body.cover_url ?? null
  let publication_year = body.publication_year ?? null

  if (body.openLibraryKey) {
    const work = await fetchOpenLibraryWork(body.openLibraryKey)
    if (work) {
      description = workDescription(work)
      if (!cover_url && work.covers?.[0]) {
        cover_url = `https://covers.openlibrary.org/b/id/${work.covers[0]}-L.jpg`
      }
      if (!publication_year && work.first_publish_date) {
        const yearMatch = work.first_publish_date.match(/\d{4}/)
        if (yearMatch) publication_year = Number(yearMatch[0])
      }
    }
  }

  const isbnClean = body.isbn?.replace(/[^0-9Xx]/g, '') ?? null
  const isbn13 = isbnClean && isbnClean.length === 13 ? isbnClean : null
  const isbn10 = isbnClean && isbnClean.length === 10 ? isbnClean : null

  const { data: inserted, error } = await admin
    .from('books')
    .insert({
      title,
      author,
      description,
      cover_url,
      source: 'community',
      source_type: 'community',
      epub_url: null,
      isbn: isbn10 ?? isbnClean,
      isbn13,
      publication_year,
      publisher: body.publisher ?? null,
      added_by: user.id,
    })
    .select('id')
    .maybeSingle()

  if (error || !inserted) {
    return NextResponse.json(
      { error: 'insert_failed', detail: error?.message ?? 'unknown' },
      { status: 500 },
    )
  }

  return NextResponse.json({ id: (inserted as { id: string }).id, existing: false })
}

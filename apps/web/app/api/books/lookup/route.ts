import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface BookHit {
  id: string
  slug: string | null
  title: string
  author: string
  cover_url: string | null
}

export async function GET(request: NextRequest) {
  const isbnRaw = request.nextUrl.searchParams.get('isbn') ?? ''
  const isbn = isbnRaw.replace(/[^0-9Xx]/g, '')
  if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) {
    return NextResponse.json(
      { found: false, error: 'invalid_isbn' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const { data: direct } = await admin
    .from('books')
    .select('id, slug, title, author, cover_url')
    .or(`isbn.eq.${isbn},isbn13.eq.${isbn}`)
    .limit(1)
    .maybeSingle()

  if (direct) {
    return NextResponse.json({ found: true, book: direct as BookHit })
  }

  const google = await fetchGoogleBooks(isbn)
  if (!google) return NextResponse.json({ found: false })

  const { data: byTitle } = await admin
    .from('books')
    .select('id, slug, title, author, cover_url')
    .ilike('title', google.title)
    .ilike('author', `%${google.author}%`)
    .limit(1)
    .maybeSingle()

  if (byTitle) {
    return NextResponse.json({ found: true, book: byTitle as BookHit })
  }

  return NextResponse.json({
    found: false,
    external: { title: google.title, author: google.author, isbn },
  })
}

interface GoogleVolume {
  volumeInfo?: { title?: string; authors?: string[] }
}

async function fetchGoogleBooks(
  isbn: string,
): Promise<{ title: string; author: string } | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
      { next: { revalidate: 86400 } },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { items?: GoogleVolume[] }
    const info = data.items?.[0]?.volumeInfo
    if (!info?.title || !info.authors?.[0]) return null
    return { title: info.title, author: info.authors[0] }
  } catch {
    return null
  }
}

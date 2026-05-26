import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface DbResult {
  source: 'db'
  id: string
  title: string
  author: string
  cover_url: string | null
  isbn: string | null
  publication_year: number | null
}

interface OpenLibraryResult {
  source: 'open_library'
  key: string
  title: string
  author: string
  cover_url: string | null
  isbn: string | null
  publication_year: number | null
}

interface OpenLibraryDoc {
  key?: string
  title?: string
  author_name?: string[]
  isbn?: string[]
  cover_i?: number
  first_publish_year?: number
}

type Result = DbResult | OpenLibraryResult

function escapeForOr(input: string): string {
  return input.replace(/[%_]/g, '\\$&')
}

async function searchOpenLibrary(
  query: string,
  type: 'isbn' | 'title',
): Promise<OpenLibraryResult[]> {
  const params = new URLSearchParams({
    q: type === 'isbn' ? `isbn:${query}` : query,
    fields: 'key,title,author_name,isbn,cover_i,first_publish_year',
    limit: '12',
  })
  const url = `https://openlibrary.org/search.json?${params.toString()}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Foxing/1.0 (https://foxing.app)',
      },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const json = (await res.json()) as { docs?: OpenLibraryDoc[] }
    return (json.docs ?? [])
      .filter((doc) => doc.key && doc.title && doc.author_name?.[0])
      .map((doc) => ({
        source: 'open_library' as const,
        key: doc.key!.replace(/^\/works\//, ''),
        title: doc.title!,
        author: doc.author_name![0]!,
        cover_url: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : null,
        isbn: doc.isbn?.[0] ?? null,
        publication_year: doc.first_publish_year ?? null,
      }))
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  const type = request.nextUrl.searchParams.get('type') === 'isbn' ? 'isbn' : 'title'
  if (q.length < 2) {
    return NextResponse.json({ results: [] satisfies Result[] })
  }

  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const like = `%${escapeForOr(q)}%`
  const filter =
    type === 'isbn'
      ? `isbn.ilike.${like},isbn13.ilike.${like}`
      : `title.ilike.${like},author.ilike.${like}`

  const { data: dbBooks } = await sb
    .from('books')
    .select('id, title, author, cover_url, isbn, publication_year')
    .or(filter)
    .limit(12)

  const dbResults: DbResult[] = (
    (dbBooks as Array<{
      id: string
      title: string
      author: string
      cover_url: string | null
      isbn: string | null
      publication_year: number | null
    }> | null) ?? []
  ).map((b) => ({
    source: 'db',
    id: b.id,
    title: b.title,
    author: b.author,
    cover_url: b.cover_url,
    isbn: b.isbn,
    publication_year: b.publication_year,
  }))

  const seenIsbns = new Set(
    dbResults.map((r) => r.isbn).filter((v): v is string => Boolean(v)),
  )
  const seenTitleAuthor = new Set(
    dbResults.map((r) => `${r.title.toLowerCase()}::${r.author.toLowerCase()}`),
  )

  const olResults = (await searchOpenLibrary(q, type)).filter((r) => {
    if (r.isbn && seenIsbns.has(r.isbn)) return false
    if (seenTitleAuthor.has(`${r.title.toLowerCase()}::${r.author.toLowerCase()}`))
      return false
    return true
  })

  const results: Result[] = [...dbResults, ...olResults]
  return NextResponse.json({ results })
}

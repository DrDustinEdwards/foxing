import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function primaryAuthor(author: string): string {
  const trimmed = author.slice(0, 30)
  const lastSpace = trimmed.lastIndexOf(' ')
  return lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed
}

async function fetchCoverFromGoogleBooks(
  title: string,
  author: string,
  isbn?: string | null,
): Promise<string | null> {
  if (isbn && !isbn.startsWith('B') && isbn !== 'Y' && isbn.length >= 10) {
    const isbnUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`
    try {
      const res = await fetch(isbnUrl, { signal: AbortSignal.timeout(5000) })
      const data = await res.json()
      const imageUrl = data?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
      if (imageUrl) return imageUrl.replace('http://', 'https://').replace('&zoom=1', '&zoom=3')
    } catch { /* fall through */ }
  }

  const query = encodeURIComponent(`intitle:${title} inauthor:${primaryAuthor(author)}`)
  const searchUrl = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`
  try {
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    const imageUrl = data?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
    if (imageUrl) return imageUrl.replace('http://', 'https://').replace('&zoom=1', '&zoom=3')
  } catch { /* fall through */ }

  return null
}

async function downloadAndStore(
  imageUrl: string,
  slug: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : 'jpg'
    const path = `covers/${slug}.${ext}`

    const { error } = await supabase.storage
      .from('covers')
      .upload(path, buffer, { contentType, upsert: true })

    if (error) return null

    const { data: { publicUrl } } = supabase.storage
      .from('covers')
      .getPublicUrl(path)

    return publicUrl
  } catch {
    return null
  }
}

serve(async (req) => {
  const { book_id } = await req.json()
  if (!book_id) {
    return new Response(JSON.stringify({ error: 'book_id required' }), { status: 400 })
  }

  const { data: book, error } = await supabase
    .from('books')
    .select('id, title, author, slug, isbn, isbn13, cover_url')
    .eq('id', book_id)
    .maybeSingle()

  if (error || !book) {
    return new Response(JSON.stringify({ error: 'book not found' }), { status: 404 })
  }

  if (book.cover_url) {
    return new Response(JSON.stringify({ skipped: true, reason: 'already has cover' }), { status: 200 })
  }

  const isbn = book.isbn13 ?? book.isbn
  const imageUrl = await fetchCoverFromGoogleBooks(book.title, book.author, isbn)

  if (!imageUrl) {
    return new Response(JSON.stringify({ ok: false, reason: 'no cover found' }), { status: 200 })
  }

  const slug = book.slug ?? book.id
  const publicUrl = await downloadAndStore(imageUrl, slug)

  if (!publicUrl) {
    return new Response(JSON.stringify({ ok: false, reason: 'failed to store image' }), { status: 200 })
  }

  await supabase
    .from('books')
    .update({ cover_url: publicUrl })
    .eq('id', book.id)

  return new Response(
    JSON.stringify({ ok: true, cover_url: publicUrl }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})

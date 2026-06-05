import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://f852925ce701e6c56f6feae83f0eb2d3.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
    secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
  },
})

function primaryAuthor(author: string): string {
  const trimmed = author.slice(0, 30)
  const lastSpace = trimmed.lastIndexOf(' ')
  return lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed
}

async function fetchCoverFromGoogleBooks(
  title: string,
  author: string,
  isbn?: string | null,
): Promise<{ imageUrl: string | null; debug: Record<string, unknown> }> {
  const debug: Record<string, unknown> = {}

  if (isbn && !isbn.startsWith('B') && isbn !== 'Y' && isbn.length >= 10) {
    const isbnUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`
    try {
      const res = await fetch(isbnUrl, { signal: AbortSignal.timeout(5000) })
      const text = await res.text()
      let data: any = null
      try { data = JSON.parse(text) } catch {}
      debug.isbn = { status: res.status, totalItems: data?.totalItems, hasImageLinks: !!data?.items?.[0]?.volumeInfo?.imageLinks, bodyHead: text.slice(0, 200) }
      const imageUrl = data?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
      if (imageUrl) return { imageUrl: imageUrl.replace('http://', 'https://').replace('&zoom=1', '&zoom=3'), debug }
    } catch (e) { debug.isbn = { error: String(e) } }
  }

  const query = encodeURIComponent(`intitle:${title} inauthor:${primaryAuthor(author)}`)
  const searchUrl = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`
  try {
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) })
    const text = await res.text()
    let data: any = null
    try { data = JSON.parse(text) } catch {}
    debug.search = { status: res.status, totalItems: data?.totalItems, hasImageLinks: !!data?.items?.[0]?.volumeInfo?.imageLinks, bodyHead: text.slice(0, 200) }
    const imageUrl = data?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
    if (imageUrl) return { imageUrl: imageUrl.replace('http://', 'https://').replace('&zoom=1', '&zoom=3'), debug }
  } catch (e) { debug.search = { error: String(e) } }

  return { imageUrl: null, debug }
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
    const key = `${slug}.${ext}`

    await r2.send(new PutObjectCommand({
      Bucket: 'foxing-covers',
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: contentType,
    }))

    return `https://pub-d196a43c0eb646b492c40d4f5e588943.r2.dev/${key}`
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
  const { imageUrl, debug } = await fetchCoverFromGoogleBooks(book.title, book.author, isbn)

  if (!imageUrl) {
    return new Response(JSON.stringify({ ok: false, reason: 'no cover found', debug }), { status: 200 })
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

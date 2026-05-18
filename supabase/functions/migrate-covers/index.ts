// migrate-covers
// One-shot batch migration: downloads cover images server-side (bypasses
// hotlink protection) and re-uploads them to the public 'covers' Supabase
// Storage bucket, then updates books.cover_url to the new public URL.
//
// If the primary cover_url returns the 43-byte Open Library "no cover"
// stub, falls through to Google Books (by ISBN13) then iTunes (by
// title + author) before giving up.
//
// Usage:
//   POST /functions/v1/migrate-covers?batch=100&offset=0
//   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY or CRON_SECRET>
//
// Returns: { processed, migrated, failed, remaining, nextOffset, errors }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

// Open Library returns a 43-byte placeholder when no cover is on file.
// Anything below this threshold is treated as a stub.
const MIN_REAL_COVER_BYTES = 256

interface BookRow {
  id: string
  slug: string
  title: string | null
  author: string | null
  isbn13: string | null
  cover_url: string | null
}

interface FetchedImage {
  buffer: ArrayBuffer
  contentType: string | null
  sourceUrl: string
}

function isServiceRoleJWT(token: string): boolean {
  try {
    const [, payloadB64] = token.split('.')
    if (!payloadB64) return false
    const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
    const padLen = (4 - (padded.length % 4)) % 4
    const decoded = atob(padded + '='.repeat(padLen))
    const payload = JSON.parse(decoded) as { role?: string }
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

function extOf(contentType: string | null, url: string): string {
  if (contentType?.includes('png')) return 'png'
  if (contentType?.includes('webp')) return 'webp'
  if (contentType?.includes('gif')) return 'gif'
  const lower = url.toLowerCase()
  if (lower.includes('.png')) return 'png'
  if (lower.includes('.webp')) return 'webp'
  if (lower.includes('.gif')) return 'gif'
  return 'jpg'
}

async function fetchImage(url: string): Promise<FetchedImage | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Foxing/1.0 (foxing.app; book cover migration)',
        Accept: 'image/*,*/*;q=0.8',
      },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    if (buffer.byteLength < MIN_REAL_COVER_BYTES) return null
    return {
      buffer,
      contentType: res.headers.get('content-type'),
      sourceUrl: url,
    }
  } catch {
    return null
  }
}

async function lookupGoogleBooks(isbn13: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}&fields=items(volumeInfo(imageLinks))`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      items?: Array<{
        volumeInfo?: {
          imageLinks?: {
            thumbnail?: string
            small?: string
            medium?: string
            large?: string
            extraLarge?: string
          }
        }
      }>
    }
    const links = data.items?.[0]?.volumeInfo?.imageLinks
    const url =
      links?.extraLarge ??
      links?.large ??
      links?.medium ??
      links?.small ??
      links?.thumbnail
    if (!url) return null
    return url
      .replace('zoom=1', 'zoom=3')
      .replace('&edge=curl', '')
      .replace('http://', 'https://')
  } catch {
    return null
  }
}

async function lookupItunes(
  title: string,
  author: string,
): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${title} ${author}`.trim())
    const res = await fetch(
      `https://itunes.apple.com/search?term=${query}&media=ebook&limit=5`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      results?: Array<{ trackName?: string; artworkUrl100?: string }>
    }
    const firstWord = title.toLowerCase().split(/\s+/)[0] ?? ''
    const match = data.results?.find((r) =>
      r.trackName?.toLowerCase().includes(firstWord),
    )
    if (!match?.artworkUrl100) return null
    return match.artworkUrl100.replace('100x100bb', '600x900bb')
  } catch {
    return null
  }
}

async function resolveCover(book: BookRow): Promise<FetchedImage | null> {
  if (book.cover_url) {
    const primary = await fetchImage(book.cover_url)
    if (primary) return primary
  }
  if (book.isbn13) {
    const gb = await lookupGoogleBooks(book.isbn13)
    if (gb) {
      const img = await fetchImage(gb)
      if (img) return img
    }
  }
  if (book.title && book.author) {
    const it = await lookupItunes(book.title, book.author)
    if (it) {
      const img = await fetchImage(it)
      if (img) return img
    }
  }
  return null
}

serve(async (req: Request) => {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  const valid =
    token.length > 0 &&
    (token === SUPABASE_SERVICE_ROLE_KEY ||
      (CRON_SECRET && token === CRON_SECRET) ||
      isServiceRoleJWT(token))
  if (!valid) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(req.url)
  const batch = Math.min(
    Math.max(parseInt(url.searchParams.get('batch') ?? '50', 10) || 50, 1),
    200,
  )
  const offset = Math.max(
    parseInt(url.searchParams.get('offset') ?? '0', 10) || 0,
    0,
  )

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { count: totalRemaining } = await supabase
    .from('books')
    .select('id', { count: 'exact', head: true })
    .not('cover_url', 'is', null)
    .not('cover_url', 'ilike', '%supabase%')

  const { data: rows, error: fetchErr } = await supabase
    .from('books')
    .select('id, slug, title, author, isbn13, cover_url')
    .not('cover_url', 'is', null)
    .not('cover_url', 'ilike', '%supabase%')
    .order('id', { ascending: true })
    .range(offset, offset + batch - 1)

  if (fetchErr) {
    return new Response(
      JSON.stringify({ error: 'fetch_failed', detail: fetchErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const books: BookRow[] = rows ?? []
  let migrated = 0
  let failed = 0
  const errors: Array<{ slug: string; reason: string }> = []

  for (const book of books) {
    if (!book.slug) {
      failed++
      errors.push({ slug: book.id, reason: 'missing_slug' })
      continue
    }

    try {
      const image = await resolveCover(book)
      if (!image) {
        failed++
        errors.push({ slug: book.slug, reason: 'no_real_cover_found' })
        continue
      }

      const ext = extOf(image.contentType, image.sourceUrl)
      const fileName = `${book.slug}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('covers')
        .upload(fileName, image.buffer, {
          contentType: image.contentType ?? 'image/jpeg',
          upsert: true,
          cacheControl: '31536000',
        })

      if (uploadErr) {
        failed++
        errors.push({ slug: book.slug, reason: `upload: ${uploadErr.message}` })
        continue
      }

      const { data: pub } = supabase.storage.from('covers').getPublicUrl(fileName)
      const newUrl = pub.publicUrl

      const { error: updateErr } = await supabase
        .from('books')
        .update({ cover_url: newUrl })
        .eq('id', book.id)

      if (updateErr) {
        failed++
        errors.push({ slug: book.slug, reason: `update: ${updateErr.message}` })
        continue
      }

      migrated++
    } catch (err) {
      failed++
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ slug: book.slug, reason: message.slice(0, 120) })
    }
  }

  const processed = books.length
  const remainingAfter = Math.max((totalRemaining ?? 0) - migrated, 0)

  return new Response(
    JSON.stringify({
      processed,
      migrated,
      failed,
      remaining: remainingAfter,
      nextOffset: offset + processed,
      errors: errors.slice(0, 25),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})

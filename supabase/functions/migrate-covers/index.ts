// migrate-covers
// One-shot batch migration: downloads cover images server-side (bypasses
// hotlink protection) and re-uploads them to the public 'covers' Supabase
// Storage bucket, then updates books.cover_url to the new public URL.
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

interface BookRow {
  id: string
  slug: string
  cover_url: string | null
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
    .select('id, slug, cover_url')
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
    if (!book.cover_url || !book.slug) {
      failed++
      errors.push({ slug: book.slug ?? book.id, reason: 'missing_cover_or_slug' })
      continue
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10000)
      const imgRes = await fetch(book.cover_url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Foxing/1.0 (foxing.app; book cover migration)',
          Accept: 'image/*,*/*;q=0.8',
        },
      })
      clearTimeout(timer)

      if (!imgRes.ok) {
        failed++
        errors.push({ slug: book.slug, reason: `http_${imgRes.status}` })
        continue
      }

      const contentType = imgRes.headers.get('content-type')
      const buffer = await imgRes.arrayBuffer()

      if (buffer.byteLength < 256) {
        failed++
        errors.push({ slug: book.slug, reason: 'too_small' })
        continue
      }

      const ext = extOf(contentType, book.cover_url)
      const fileName = `${book.slug}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('covers')
        .upload(fileName, buffer, {
          contentType: contentType ?? 'image/jpeg',
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

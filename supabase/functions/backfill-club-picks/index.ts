// backfill-club-picks
// Called by the external_book_clubs insert trigger (or manually from the
// admin UI). Looks up the club's BookNotification.com page, scrapes its
// pick history, downloads covers (OL -> Google Books -> iTunes), and
// inserts published picks. Idempotent: existing picks are skipped.
//
// Auth: Bearer SUPABASE_SERVICE_ROLE_KEY or CRON_SECRET
// Body: { club_slug: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const BOOKNOTIFICATION_URLS: Record<string, string> = {
  oprah: 'https://www.booknotification.com/book-clubs/oprahs-book-club/',
  reese: 'https://www.booknotification.com/book-clubs/reeses-book-club/',
  jenna:
    'https://www.booknotification.com/book-clubs/read-with-jenna-book-club/',
  gma: 'https://www.booknotification.com/book-clubs/good-morning-america-book-club/',
  belletrist:
    'https://www.booknotification.com/book-clubs/belletrist-book-club/',
  service95:
    'https://www.booknotification.com/book-clubs/service95-book-club/',
  'barnes-noble':
    'https://www.booknotification.com/book-clubs/barnes-noble-book-club/',
  'good-housekeeping':
    'https://www.booknotification.com/book-clubs/good-housekeeping-book-club/',
  'jack-carr':
    'https://www.booknotification.com/book-clubs/jack-carr-book-club/',
  'late-show':
    'https://www.booknotification.com/book-clubs/the-late-show-book-club/',
  'library-science':
    'https://www.booknotification.com/book-clubs/library-science-book-club/',
  'natalie-portman':
    'https://www.booknotification.com/book-clubs/natalie-portmans-book-club/',
  'katie-couric':
    'https://www.booknotification.com/book-clubs/katie-couric-book-club/',
  'anthony-jeselnik':
    'https://www.booknotification.com/book-clubs/jeselnik-book-club/',
  'richard-judy':
    'https://www.booknotification.com/book-clubs/richard-judy-book-club/',
  audacious:
    'https://www.booknotification.com/book-clubs/the-audacious-book-club/',
  'sunnie-reads':
    'https://www.booknotification.com/book-clubs/sunnie-reads-book-club/',
  tearoom: 'https://www.booknotification.com/book-clubs/teatime-book-club/',
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

function parseDateLabel(
  label: string,
): { month: number; year: number } | null {
  const months: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  }
  const full = label.match(/(\w+)\s+(20\d{2}|19\d{2})/i)
  const short = label.match(/(\w+)\s+'(\d{2})/i)
  const match = full ?? short
  if (!match) return null
  const month = months[match[1].toLowerCase()]
  if (!month) return null
  const yearStr = match[2]
  const year =
    yearStr.length === 2
      ? parseInt(yearStr, 10) >= 90
        ? 1900 + parseInt(yearStr, 10)
        : 2000 + parseInt(yearStr, 10)
      : parseInt(yearStr, 10)
  return { month, year }
}

function extractAsin(url: string): string | null {
  return url.match(/(?:dp|ASIN|product)\/([A-Z0-9]{10})/)?.[1] ?? null
}

async function lookupBookCover(
  isbn13: string | null,
  title: string,
  author: string,
): Promise<string | null> {
  if (isbn13) {
    try {
      const res = await fetch(
        `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`,
        { signal: AbortSignal.timeout(5000) },
      )
      if (
        res.ok &&
        parseInt(res.headers.get('content-length') ?? '0', 10) > 200
      ) {
        return `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`
      }
    } catch {
      // next
    }
  }

  if (isbn13) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}&fields=items(volumeInfo(imageLinks))`,
        { signal: AbortSignal.timeout(5000) },
      )
      if (res.ok) {
        const data = (await res.json()) as {
          items?: Array<{
            volumeInfo?: {
              imageLinks?: Record<string, string>
            }
          }>
        }
        const links = data.items?.[0]?.volumeInfo?.imageLinks
        const url =
          links?.extraLarge ??
          links?.large ??
          links?.medium ??
          links?.thumbnail
        if (url) {
          return url
            .replace('zoom=1', 'zoom=3')
            .replace('&edge=curl', '')
            .replace('http://', 'https://')
        }
      }
    } catch {
      // next
    }
  }

  try {
    const q = encodeURIComponent(`${title} ${author}`.trim())
    const res = await fetch(
      `https://itunes.apple.com/search?term=${q}&media=ebook&limit=5`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (res.ok) {
      const data = (await res.json()) as {
        results?: Array<{ trackName?: string; artworkUrl100?: string }>
      }
      const firstWord = title.toLowerCase().split(/\s+/)[0] ?? ''
      const match = data.results?.find((r) =>
        r.trackName?.toLowerCase().includes(firstWord),
      )
      if (match?.artworkUrl100) {
        return match.artworkUrl100.replace('100x100bb', '600x900bb')
      }
    }
  } catch {
    // give up
  }
  return null
}

// deno-lint-ignore no-explicit-any
async function storeCoverInSupabase(
  supabase: any,
  coverUrl: string,
  bookSlug: string,
): Promise<string | null> {
  try {
    const res = await fetch(coverUrl, {
      headers: { 'User-Agent': 'Foxing/1.0 (foxing.app)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) return null
    const buffer = await res.arrayBuffer()
    if (buffer.byteLength < 256) return null
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : 'jpg'
    const fileName = `${bookSlug}.${ext}`
    const { error } = await supabase.storage
      .from('covers')
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
        cacheControl: '31536000',
      })
    if (error) return null
    const { data } = supabase.storage.from('covers').getPublicUrl(fileName)
    return data.publicUrl
  } catch {
    return null
  }
}

async function findBookNotificationUrl(
  clubName: string,
): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `What is the exact booknotification.com URL for the "${clubName}" book club page?
Return ONLY the URL, nothing else. If unknown return: none`,
          },
        ],
      }),
    })
    const data = (await res.json()) as {
      content?: Array<{ text?: string }>
    }
    const url = data.content?.[0]?.text?.trim()
    if (
      url &&
      url.startsWith('https://www.booknotification.com') &&
      url !== 'none'
    ) {
      return url
    }
  } catch {
    // give up
  }
  return null
}

serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const valid =
    token.length > 0 &&
    (token === SUPABASE_SERVICE_ROLE_KEY ||
      (CRON_SECRET && token === CRON_SECRET) ||
      isServiceRoleJWT(token))
  if (!valid) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const body = await req.json().catch(() => ({}))
  const clubSlug = body.club_slug as string | undefined
  if (!clubSlug) {
    return new Response(
      JSON.stringify({ error: 'club_slug required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { data: club } = await supabase
    .from('external_book_clubs')
    .select('id, name, slug')
    .eq('slug', clubSlug)
    .single()

  if (!club) {
    return new Response(
      JSON.stringify({ error: `Club not found: ${clubSlug}` }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let bnUrl = BOOKNOTIFICATION_URLS[clubSlug] ?? ''
  if (!bnUrl) {
    bnUrl = (await findBookNotificationUrl(club.name)) ?? ''
  }
  if (!bnUrl) {
    return new Response(
      JSON.stringify({
        club: clubSlug,
        message: 'No BookNotification page found. Add picks manually via admin.',
        inserted: 0,
        skipped: 0,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const pageRes = await fetch(bnUrl, {
    headers: { 'User-Agent': 'Foxing/1.0 (foxing.app; data research)' },
  })
  if (!pageRes.ok) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch ${bnUrl}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const html = await pageRes.text()
  const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
  const textRegex = /<[^>]+>/g

  const rows = html.match(rowRegex) ?? []
  let inserted = 0
  let skipped = 0

  for (const row of rows) {
    const cells: string[] = []
    let m: RegExpExecArray | null
    cellRegex.lastIndex = 0
    while ((m = cellRegex.exec(row)) !== null) cells.push(m[1])
    if (cells.length < 3) continue

    const dateCell = cells[1]?.replace(textRegex, '').trim()
    const authorCell = cells[2]?.replace(textRegex, '').trim()
    const titleCell = cells[3] ?? ''
    const titleText = titleCell.replace(textRegex, '').trim()
    const amazonLink = titleCell.match(/href="([^"]+)"/i)?.[1] ?? ''

    if (!dateCell || !authorCell || !titleText) continue
    const parsed = parseDateLabel(dateCell)
    if (!parsed) continue

    const { month, year } = parsed
    const asin = extractAsin(amazonLink)
    const isbn13 = asin && /^\d{10}$/.test(asin) ? '978' + asin : null

    const { data: existing } = await supabase
      .from('external_book_club_picks')
      .select('id')
      .eq('club_id', club.id)
      .eq('pick_month', month)
      .eq('pick_year', year)
      .limit(1)
    if (existing && existing.length > 0) {
      skipped++
      continue
    }

    let bookId: string | null = null
    const { data: existingBook } = await supabase
      .from('books')
      .select('id')
      .ilike('title', titleText)
      .limit(1)

    if (existingBook && existingBook.length > 0) {
      bookId = existingBook[0].id
    } else {
      const titleSlug = titleText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 60)
      const authorLast = (authorCell.split(' ').pop() ?? 'unknown')
        .toLowerCase()
        .replace(/[^a-z]/g, '') || 'unknown'
      const bookSlug = `${titleSlug}-${authorLast}`

      const rawCoverUrl = await lookupBookCover(isbn13, titleText, authorCell)
      const coverUrl = rawCoverUrl
        ? await storeCoverInSupabase(supabase, rawCoverUrl, bookSlug)
        : null

      const { data: newBook } = await supabase
        .from('books')
        .insert({
          title: titleText,
          author: authorCell,
          author_slug: authorCell
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-'),
          slug: bookSlug,
          source: 'community',
          source_type: 'community',
          isbn: asin ?? null,
          isbn13,
          amazon_url: asin ? `https://www.amazon.com/dp/${asin}` : null,
          cover_url: coverUrl,
        })
        .select('id')
        .single()
      if (newBook) bookId = newBook.id
    }

    if (!bookId) continue

    await supabase.from('external_book_club_picks').insert({
      club_id: club.id,
      book_id: bookId,
      pick_month: month,
      pick_year: year,
      picked_at: new Date(year, month - 1, 1).toISOString(),
      is_published: true,
      is_auto_discovered: true,
      auto_source: 'booknotification',
      auto_confidence: 'high',
    })
    inserted++

    await new Promise((r) => setTimeout(r, 200))
  }

  if (inserted > 0) {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true)
    if (admins && admins.length > 0) {
      await supabase.from('notifications').insert(
        admins.map((a: { id: string }) => ({
          user_id: a.id,
          type: 'admin_backfill_complete',
          title: `${club.name} backfilled: ${inserted} historical picks added`,
          body: 'Historical picks from BookNotification have been seeded automatically.',
          data: { action: 'view_club', slug: clubSlug },
        })),
      )
    }
  }

  return new Response(
    JSON.stringify({ club: clubSlug, inserted, skipped }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})

// celebrity-pick-finder
// Triggered monthly by Vercel Cron (vercel.json: 0 9 2 * * and 0 9 12 * *)
// via /api/cron/celebrity-picks, which forwards with Bearer SUPABASE_CRON_SECRET.
// Must be deployed --no-verify-jwt (it self-checks CRON_SECRET below).
// Scrapes Book Riot, Tertulia, Reese's
// Book Club RSS, and BookNotification.com club pages. Falls back to Claude
// web search for any of the Big 4 (Oprah, Reese, Jenna, GMA) still missing.
// Every pick is auto-published (is_published = true). Admins get a
// notification listing what landed.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  createClient,
  SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!

type Confidence = 'high' | 'medium' | 'low'

interface PickResult {
  club_name: string
  book_title: string
  author: string
  curator_quote?: string
  announcement_url?: string
  source: string
  confidence: Confidence
}

async function callClaude(prompt: string, maxTokens = 1000): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

async function storeBookCover(
  supabase: SupabaseClient,
  imageUrl: string,
  bookSlug: string,
): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Foxing/1.0 (foxing.app)' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    if (buffer.byteLength < 256) return null
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
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

// Open Library returns a 43-byte gray placeholder when no cover is on file.
// Any cover smaller than this is treated as a stub and triggers the fallback.
const OL_STUB_BYTES = 200

// Resolve an ISBN-13 from title + author so the ISBN-keyed cover sources
// (Open Library, Google Books) can be used. Without this, lookupBookCover was
// always called with isbn=null and fell straight to the weak iTunes match.
// Google Books first, Open Library search as a fallback.
async function resolveIsbn13(
  title: string,
  author: string,
): Promise<string | null> {
  const q = encodeURIComponent(`intitle:${title} inauthor:${author}`)
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${q}&fields=items(volumeInfo(industryIdentifiers))&maxResults=5`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (res.ok) {
      const data = (await res.json()) as {
        items?: Array<{
          volumeInfo?: {
            industryIdentifiers?: Array<{ type?: string; identifier?: string }>
          }
        }>
      }
      for (const item of data.items ?? []) {
        const ids = item.volumeInfo?.industryIdentifiers ?? []
        const isbn13 = ids.find((i) => i.type === 'ISBN_13')?.identifier
        if (isbn13 && /^\d{13}$/.test(isbn13)) return isbn13
      }
    }
  } catch {
    // fall through to Open Library
  }
  try {
    const olRes = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&fields=isbn&limit=1`,
      {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'Foxing/1.0 (foxing.app)' },
      },
    )
    if (olRes.ok) {
      const data = (await olRes.json()) as { docs?: Array<{ isbn?: string[] }> }
      const isbn13 = (data.docs?.[0]?.isbn ?? []).find((i) => /^\d{13}$/.test(i))
      if (isbn13) return isbn13
    }
  } catch {
    // give up
  }
  return null
}

async function lookupBookCover(
  isbn13: string | null | undefined,
  title: string,
  author: string,
): Promise<string | null> {
  // Source 1: Open Library by ISBN (best for older / well-indexed titles)
  if (isbn13) {
    try {
      const olUrl = `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`
      const res = await fetch(olUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'Foxing/1.0 (foxing.app)' },
      })
      if (res.ok) {
        const len = parseInt(res.headers.get('content-length') ?? '0', 10)
        if (len > OL_STUB_BYTES) return olUrl
      }
    } catch {
      // fall through
    }
  }

  // Source 2: Google Books (best for new releases)
  if (isbn13) {
    try {
      const gbRes = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}&fields=items(volumeInfo(imageLinks))`,
        { signal: AbortSignal.timeout(5000) },
      )
      if (gbRes.ok) {
        const data = (await gbRes.json()) as {
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
        if (url) {
          return url
            .replace('zoom=1', 'zoom=3')
            .replace('&edge=curl', '')
            .replace('http://', 'https://')
        }
      }
    } catch {
      // fall through
    }
  }

  // Source 3: iTunes / Apple Books (good for new releases and audiobooks)
  try {
    const query = encodeURIComponent(`${title} ${author}`.trim())
    const itRes = await fetch(
      `https://itunes.apple.com/search?term=${query}&media=ebook&limit=5`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (itRes.ok) {
      const data = (await itRes.json()) as {
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
    // fall through
  }

  // Source 4: Google Books by title + author (no ISBN). Last resort so an
  // obscure pick with no resolvable ISBN can still get a cover.
  try {
    const q = encodeURIComponent(`intitle:${title} inauthor:${author}`)
    const gbRes = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${q}&fields=items(volumeInfo(imageLinks))&maxResults=1`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (gbRes.ok) {
      const data = (await gbRes.json()) as {
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
      if (url) {
        return url
          .replace('zoom=1', 'zoom=3')
          .replace('&edge=curl', '')
          .replace('http://', 'https://')
      }
    }
  } catch {
    // fall through
  }

  return null
}

async function fetchAndExtract(
  url: string,
  prompt: string,
): Promise<PickResult[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Foxing/1.0 (foxing.app; book discovery)',
      },
    })
    if (!res.ok) return []
    const html = await res.text()
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 20000)

    const response = await callClaude(`${prompt}\n\nText:\n${text}`, 2000)
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    try {
      return JSON.parse(jsonMatch[0]) as PickResult[]
    } catch {
      return []
    }
  } catch {
    return []
  }
}

// BookNotification.com publishes per-club tables of historical picks at
// /book-clubs/<bnPath>/. The most recent row at the top of the table is the
// current pick. We use it as a deterministic, no-LLM source.
interface BNClub {
  slug: string
  label: string
  match: string
  bnPath: string
}

const BN_CLUBS: BNClub[] = [
  { slug: 'oprah', label: "Oprah's Book Club", match: 'oprah', bnPath: 'oprahs-book-club' },
  { slug: 'reese', label: "Reese's Book Club", match: 'reese', bnPath: 'reeses-book-club' },
  { slug: 'jenna', label: 'Read with Jenna', match: 'jenna', bnPath: 'read-with-jenna-book-club' },
  { slug: 'gma', label: 'GMA Book Club', match: 'morning', bnPath: 'good-morning-america-book-club' },
  { slug: 'belletrist', label: 'Belletrist', match: 'belletrist', bnPath: 'belletrist-book-club' },
  { slug: 'service95', label: 'Service95 Book Club', match: 'service95', bnPath: 'service95-book-club' },
  { slug: 'barnes-noble', label: 'Barnes & Noble Book Club', match: 'barnes', bnPath: 'barnes-noble-book-club' },
  { slug: 'good-housekeeping', label: 'Good Housekeeping Book Club', match: 'housekeeping', bnPath: 'good-housekeeping-book-club' },
  { slug: 'jack-carr', label: 'Jack Carr Book Club', match: 'carr', bnPath: 'jack-carr-book-club' },
  { slug: 'late-show', label: 'Late Show Book Club', match: 'late show', bnPath: 'the-late-show-book-club' },
  { slug: 'library-science', label: 'Library Science', match: 'library science', bnPath: 'library-science-book-club' },
  { slug: 'natalie-portman', label: "Natalie Portman's Book Club", match: 'portman', bnPath: 'natalie-portmans-book-club' },
  { slug: 'katie-couric', label: 'Katie Couric Book Club', match: 'couric', bnPath: 'katie-couric-book-club' },
  { slug: 'anthony-jeselnik', label: 'Jeselnik Book Club', match: 'jeselnik', bnPath: 'jeselnik-book-club' },
  { slug: 'richard-judy', label: 'Richard & Judy Book Club', match: 'richard', bnPath: 'richard-judy-book-club' },
  { slug: 'audacious', label: 'The Audacious Book Club', match: 'audacious', bnPath: 'the-audacious-book-club' },
  { slug: 'sunnie-reads', label: 'Sunnie Reads', match: 'sunnie', bnPath: 'sunnie-reads-book-club' },
  { slug: 'tearoom', label: 'TeaTime Book Club', match: 'teatime', bnPath: 'teatime-book-club' },
]

const BN_MONTH_NAMES: Record<number, string> = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
  7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December',
}

function bnStripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
}

async function scrapeBookNotificationLatest(
  bnPath: string,
  month: number,
  year: number,
): Promise<{ title: string; author: string } | null> {
  try {
    const res = await fetch(
      `https://booknotification.com/book-clubs/${bnPath}/`,
      {
        headers: { 'User-Agent': 'Foxing/1.0 (foxing.app; book discovery)' },
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!res.ok) return null
    const html = await res.text()
    const tableMatch = html.match(/<table id="clublist"[\s\S]*?<\/table>/)
    if (!tableMatch) return null
    const monthLong = BN_MONTH_NAMES[month]
    const yyShort = String(year).slice(-2)
    const rows = [...tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/g)]
    for (const r of rows) {
      const tds = [...r[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1])
      if (tds.length < 4) continue
      const label = bnStripTags(tds[1] ?? '')
      const wantFull = `${monthLong} ${year}`
      const wantTick = `${monthLong} '${yyShort}`
      if (!label.startsWith(wantFull) && !label.startsWith(wantTick)) continue
      const author = bnStripTags(tds[2] ?? '')
      const title = bnStripTags(tds[3] ?? '')
      if (!title || !author) return null
      return { title, author }
    }
    return null
  } catch {
    return null
  }
}

serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Targeted cover backfill: POST { "backfill_book_ids": ["uuid", ...] }
  // re-resolves and stores covers for existing books (e.g. picks that landed
  // with a null cover). Reuses the same ISBN -> cover resolution as the
  // monthly run. No body, or a body without this key, falls through to the
  // normal monthly discovery run.
  let backfillIds: string[] = []
  try {
    const body = await req.json()
    if (Array.isArray(body?.backfill_book_ids)) {
      backfillIds = body.backfill_book_ids.filter(
        (x: unknown): x is string => typeof x === 'string',
      )
    }
  } catch {
    // no/invalid body -> normal monthly run
  }
  if (backfillIds.length > 0) {
    const results: Array<{
      book_id: string
      title: string
      cover_url: string | null
      ok: boolean
    }> = []
    for (const id of backfillIds) {
      const { data: book } = await supabase
        .from('books')
        .select('id, title, author, slug')
        .eq('id', id)
        .maybeSingle()
      if (!book) {
        results.push({ book_id: id, title: '(not found)', cover_url: null, ok: false })
        continue
      }
      const isbn13 = await resolveIsbn13(book.title, book.author)
      const sourceUrl = await lookupBookCover(isbn13, book.title, book.author)
      let coverUrl: string | null = null
      if (sourceUrl) {
        coverUrl = await storeBookCover(supabase, sourceUrl, book.slug)
      }
      if (coverUrl) {
        await supabase.from('books').update({ cover_url: coverUrl }).eq('id', id)
      }
      results.push({
        book_id: id,
        title: book.title,
        cover_url: coverUrl,
        ok: !!coverUrl,
      })
    }
    const ok = results.filter((r) => r.ok).length
    return new Response(
      JSON.stringify({ backfill: results, success_rate: `${ok}/${results.length}` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const now = new Date()
  const monthNum = now.getMonth() + 1
  const year = now.getFullYear()
  const monthName = now.toLocaleString('en-US', { month: 'long' })
  const monthLower = monthName.toLowerCase()

  const EXTRACTION_PROMPT = `Extract every book club pick from this text for ${monthName} ${year}.
Return ONLY a JSON array with no other text, no markdown, no explanation.
Format: [{"club_name":"exact club name","book_title":"exact title","author":"author name","curator_quote":"the curator's actual words about the book (50-200 chars)","announcement_url":"url if mentioned","confidence":"high"}]
Include every club you can find. If you cannot find a pick for a club, omit it.`

  const allResults: PickResult[] = []

  // Book Riot monthly roundup
  const brUrl = `https://bookriot.com/${monthLower}-${year}-book-club-selections/`
  const brResults = await fetchAndExtract(brUrl, EXTRACTION_PROMPT)
  for (const r of brResults) {
    allResults.push({ ...r, source: 'bookriot' })
  }

  // Tertulia monthly roundup
  const terUrl = `https://tertulia.com/editorial-list/what-book-clubs-are-reading-${monthLower}-${year}`
  const terResults = await fetchAndExtract(terUrl, EXTRACTION_PROMPT)
  for (const r of terResults) {
    const firstWord = r.club_name.toLowerCase().split(' ')[0]
    const dup = allResults.find((a) =>
      a.club_name.toLowerCase().includes(firstWord),
    )
    if (!dup) allResults.push({ ...r, source: 'tertulia' })
  }

  // Reese's Book Club RSS
  try {
    const rssRes = await fetch('https://reesesbookclub.com/feed/', {
      headers: { 'User-Agent': 'Foxing/1.0 (foxing.app)' },
    })
    if (rssRes.ok) {
      const xml = await rssRes.text()
      const itemRegex = new RegExp(
        `<item>[\\s\\S]*?${monthName}[\\s\\S]*?Pick[\\s\\S]*?</item>`,
        'i',
      )
      const pickPost = xml.match(itemRegex)?.[0]
      const alreadyFound = allResults.some((r) =>
        r.club_name.toLowerCase().includes('reese'),
      )
      if (pickPost && !alreadyFound) {
        const pickText = pickPost.replace(/<[^>]+>/g, ' ').slice(0, 3000)
        const response = await callClaude(
          `Extract the book title, author, and Reese's quote from this. Return ONLY JSON: {"book_title":"...","author":"...","curator_quote":"..."}\n\n${pickText}`,
          200,
        )
        try {
          const pick = JSON.parse(response.trim())
          if (pick.book_title) {
            allResults.push({
              club_name: "Reese's Book Club",
              book_title: pick.book_title,
              author: pick.author ?? '',
              curator_quote: pick.curator_quote,
              source: 'rss',
              confidence: 'high',
            })
          }
        } catch {
          // continue
        }
      }
    }
  } catch {
    // continue
  }

  // BookNotification.com: deterministic per-club source, no LLM needed.
  for (const club of BN_CLUBS) {
    const found = allResults.some((r) =>
      r.club_name.toLowerCase().includes(club.match),
    )
    if (found) continue
    const hit = await scrapeBookNotificationLatest(club.bnPath, monthNum, year)
    if (hit) {
      allResults.push({
        club_name: club.label,
        book_title: hit.title,
        author: hit.author,
        source: 'booknotification',
        confidence: 'high',
      })
    }
  }

  // Web search fallback for the Big 4
  const big4: Array<{ slug: string; label: string; match: string }> = [
    { slug: 'oprah', label: "Oprah's Book Club", match: 'oprah' },
    { slug: 'reese', label: "Reese's Book Club", match: 'reese' },
    { slug: 'jenna', label: 'Read with Jenna', match: 'jenna' },
    { slug: 'gma', label: 'GMA Book Club', match: 'morning' },
  ]

  for (const club of big4) {
    const found = allResults.some((r) =>
      r.club_name.toLowerCase().includes(club.match),
    )
    if (found) continue

    const searchResponse = await callClaude(
      `What is ${club.label}'s book club pick for ${monthName} ${year}?
Return ONLY JSON: {"book_title":"...","author":"...","curator_quote":"..."}
If you don't know with certainty, return: {"book_title":"","author":""}`,
      150,
    )
    try {
      const pick = JSON.parse(searchResponse.trim())
      if (pick.book_title) {
        allResults.push({
          club_name: club.label,
          book_title: pick.book_title,
          author: pick.author ?? '',
          curator_quote: pick.curator_quote,
          source: 'web_search',
          confidence: 'medium',
        })
      }
    } catch {
      // continue
    }
  }

  // Fetch all clubs from DB so we can match incoming results to club ids
  const { data: clubs } = await supabase
    .from('external_book_clubs')
    .select('id, name, slug')

  if (!clubs) {
    return new Response(JSON.stringify({ error: 'No clubs found' }), {
      status: 500,
    })
  }

  const published: string[] = []
  const skipped: string[] = []

  for (const pick of allResults) {
    if (!pick.book_title || !pick.author) continue

    const pickNameLower = pick.club_name.toLowerCase()
    const club = clubs.find((c) => {
      const nameLower = c.name.toLowerCase()
      const words = pickNameLower.split(' ').filter((w) => w.length > 3)
      return words.some((w) => nameLower.includes(w))
    })
    if (!club) continue

    const { data: existing } = await supabase
      .from('external_book_club_picks')
      .select('id')
      .eq('club_id', club.id)
      .eq('pick_month', monthNum)
      .eq('pick_year', year)
      .limit(1)
    if (existing && existing.length > 0) {
      skipped.push(`${club.name} (already exists)`)
      continue
    }

    // Find or create the underlying book
    let bookId: string | null = null
    const titleSlug = pick.book_title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60)
    const authorLastName = (pick.author.split(' ').pop() ?? 'unknown')
      .toLowerCase()
      .replace(/[^a-z]/g, '')
    const bookSlug = `${titleSlug}-${authorLastName}`

    const { data: existingBook } = await supabase
      .from('books')
      .select('id')
      .ilike('title', pick.book_title.replace(/'/g, "''"))
      .limit(1)

    if (existingBook && existingBook.length > 0) {
      bookId = existingBook[0].id
    } else {
      let coverUrl: string | null = null
      const isbn13 = await resolveIsbn13(pick.book_title, pick.author)
      const sourceUrl = await lookupBookCover(
        isbn13,
        pick.book_title,
        pick.author,
      )
      if (sourceUrl) {
        coverUrl = await storeBookCover(supabase, sourceUrl, bookSlug)
      }

      const { data: newBook } = await supabase
        .from('books')
        .insert({
          title: pick.book_title,
          author: pick.author,
          author_slug: pick.author
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-'),
          slug: bookSlug,
          source: 'community',
          source_type: 'community',
          cover_url: coverUrl,
          description: pick.curator_quote
            ? pick.curator_quote.slice(0, 200)
            : null,
        })
        .select('id')
        .single()
      if (newBook) bookId = newBook.id
    }

    if (!bookId) continue

    const { error } = await supabase.from('external_book_club_picks').insert({
      club_id: club.id,
      book_id: bookId,
      pick_month: monthNum,
      pick_year: year,
      picked_at: new Date().toISOString(),
      is_published: true,
      is_auto_discovered: true,
      auto_source: pick.source,
      auto_confidence: pick.confidence ?? 'medium',
      curator_quote: pick.curator_quote ?? null,
      official_url: pick.announcement_url ?? null,
      notes: `Auto-discovered from ${pick.source}`,
    })

    if (!error) {
      published.push(`${club.name}: "${pick.book_title}" by ${pick.author}`)
    }
  }

  if (published.length > 0) {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true)

    if (admins && admins.length > 0) {
      await supabase.from('notifications').insert(
        admins.map((a) => ({
          user_id: a.id,
          type: 'admin_picks_published',
          title: `${published.length} ${monthName} picks auto-published`,
          body:
            published.slice(0, 3).join(' · ') +
            (published.length > 3 ? ` +${published.length - 3} more` : ''),
          data: { action: 'review_picks', month: monthNum, year },
        })),
      )
    }
  }

  return new Response(
    JSON.stringify({ published, skipped, total: allResults.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})

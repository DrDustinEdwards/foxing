// celebrity-pick-finder
// Runs monthly (pg_cron: 0 9 6 * *). Scrapes Book Riot, Tertulia, and Reese's
// Book Club RSS, then falls back to Claude web search for any of the Big 4
// (Oprah, Reese, Jenna, GMA) still missing. Every pick is auto-published
// (is_published = true). Admins get a notification listing what landed.

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

async function lookupOpenLibraryCover(
  title: string,
  author: string,
): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${q}&limit=1`,
      { headers: { 'User-Agent': 'Foxing/1.0 (foxing.app)' } },
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      docs?: Array<{ cover_i?: number; isbn?: string[] }>
    }
    const doc = data.docs?.[0]
    if (!doc) return null
    if (doc.cover_i) {
      return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
    }
    const isbn = doc.isbn?.[0]
    if (isbn) {
      return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
    }
    return null
  } catch {
    return null
  }
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

serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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
      const openLibCover = await lookupOpenLibraryCover(
        pick.book_title,
        pick.author,
      )
      if (openLibCover) {
        coverUrl = await storeBookCover(supabase, openLibCover, bookSlug)
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
      official_announcement_url: pick.announcement_url ?? null,
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

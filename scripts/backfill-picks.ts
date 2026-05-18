// Backfill historical celebrity picks from BookNotification.com.
//
// Scrapes the public table on each /book-clubs/<slug>/ page, dedupes against
// external_book_club_picks, creates community-source books on demand with
// covers stored in Supabase Storage (OL → Google Books → iTunes waterfall),
// and inserts each pick with is_auto_discovered + auto_source='booknotification'.
//
// Run from repo root:
//   $env:SUPABASE_URL = 'https://ekjpsuewrkvqzbuteurc.supabase.co'
//   $env:SUPABASE_SERVICE_ROLE_KEY = '...'
//   node --experimental-strip-types --no-warnings scripts/backfill-picks.ts
//
// Optional flags:
//   --club <slug>  only run for one club
//   --dry-run      print planned actions without writing
//   --limit <n>    cap the number of new picks per club

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const args = process.argv.slice(2)
const flag = (name: string): string | null => {
  const i = args.indexOf(name)
  return i >= 0 ? (args[i + 1] ?? '') : null
}
const ONLY_CLUB = flag('--club')
const DRY_RUN = args.includes('--dry-run')
const LIMIT = Number(flag('--limit') ?? '0') || 0

interface ClubSource {
  slug: string
  bnPath: string
}

function getEraLabel(clubSlug: string, year: number): string | null {
  if (clubSlug === 'oprah') {
    if (year <= 2011) return 'Original Club'
    if (year <= 2018) return 'Book Club 2.0'
    return 'Apple TV+ Era'
  }
  return null
}

const CLUBS: ClubSource[] = [
  { slug: 'oprah', bnPath: 'oprahs-book-club' },
  { slug: 'reese', bnPath: 'reeses-book-club' },
  { slug: 'jenna', bnPath: 'read-with-jenna-book-club' },
  { slug: 'gma', bnPath: 'good-morning-america-book-club' },
  { slug: 'belletrist', bnPath: 'belletrist-book-club' },
  { slug: 'service95', bnPath: 'service95-book-club' },
  { slug: 'barnes-noble', bnPath: 'barnes-noble-book-club' },
  { slug: 'good-housekeeping', bnPath: 'good-housekeeping-book-club' },
  { slug: 'jack-carr', bnPath: 'jack-carr-book-club' },
  { slug: 'late-show', bnPath: 'the-late-show-book-club' },
  { slug: 'library-science', bnPath: 'library-science-book-club' },
  { slug: 'natalie-portman', bnPath: 'natalie-portmans-book-club' },
  { slug: 'katie-couric', bnPath: 'katie-couric-book-club' },
  { slug: 'anthony-jeselnik', bnPath: 'jeselnik-book-club' },
  { slug: 'richard-judy', bnPath: 'richard-judy-book-club' },
  { slug: 'audacious', bnPath: 'the-audacious-book-club' },
  { slug: 'sunnie-reads', bnPath: 'sunnie-reads-book-club' },
  { slug: 'tearoom', bnPath: 'teatime-book-club' },
]

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9,
  sept: 9, oct: 10, nov: 11, dec: 12,
}

const REST = `${SUPABASE_URL}/rest/v1`
const STORAGE = `${SUPABASE_URL}/storage/v1`
const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
}

interface ScrapedPick {
  month: number
  year: number
  title: string
  author: string
  asin: string | null
}

function parseLabel(raw: string): { month: number; year: number } | null {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  // "April '18 Pick", "May '26 Sunnie Select", "April 2018 Pick", etc.
  // Trailing words after the year are ignored.
  const tickMatch = cleaned.match(/^([A-Za-z]+)\s+'(\d{2})\b/)
  if (tickMatch) {
    const month = MONTHS[tickMatch[1].toLowerCase()]
    if (!month) return null
    const yy = parseInt(tickMatch[2], 10)
    const year = yy < 50 ? 2000 + yy : 1900 + yy
    return { month, year }
  }
  const fullMatch = cleaned.match(/^([A-Za-z]+)\s+(\d{4})\b/)
  if (fullMatch) {
    const month = MONTHS[fullMatch[1].toLowerCase()]
    if (!month) return null
    return { month, year: parseInt(fullMatch[2], 10) }
  }
  return null
}

function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '-')
}

function stripTags(s: string): string {
  return unescapeHtml(s.replace(/<[^>]+>/g, '')).trim()
}

async function scrapeClub(source: ClubSource): Promise<ScrapedPick[]> {
  const url = `https://booknotification.com/book-clubs/${source.bnPath}/`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Foxing/1.0 (foxing.app; historical backfill)' },
  })
  if (!res.ok) {
    console.warn(`  scrape ${source.slug}: HTTP ${res.status}`)
    return []
  }
  const html = await res.text()
  const tableMatch = html.match(/<table id="clublist"[\s\S]*?<\/table>/)
  if (!tableMatch) {
    console.warn(`  scrape ${source.slug}: no clublist table`)
    return []
  }
  const rows = [...tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/g)]
  const picks: ScrapedPick[] = []
  for (const r of rows) {
    const row = r[0]
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1])
    if (tds.length < 4) continue
    const labelText = stripTags(tds[1] ?? '')
    const parsed = parseLabel(labelText)
    if (!parsed) continue

    const authorText = stripTags(tds[2] ?? '')
    const titleText = stripTags(tds[3] ?? '')
    if (!authorText || !titleText) continue

    const isbnMatch = (tds[3] ?? '').match(/data-isbn=['"]([^'"]+)['"]/)
    const asin = isbnMatch ? isbnMatch[1] : null

    picks.push({
      month: parsed.month,
      year: parsed.year,
      title: titleText,
      author: authorText,
      asin,
    })
  }
  return picks
}

interface Club {
  id: string
  slug: string
}

async function listClubs(): Promise<Record<string, Club>> {
  const res = await fetch(`${REST}/external_book_clubs?select=id,slug`, {
    headers: HEADERS,
  })
  const data = (await res.json()) as Club[]
  const map: Record<string, Club> = {}
  for (const c of data) map[c.slug] = c
  return map
}

async function getExistingPickSet(clubId: string): Promise<Set<string>> {
  const res = await fetch(
    `${REST}/external_book_club_picks?club_id=eq.${clubId}&select=pick_month,pick_year`,
    { headers: HEADERS },
  )
  const data = (await res.json()) as Array<{
    pick_month: number | null
    pick_year: number | null
  }>
  const set = new Set<string>()
  for (const p of data) {
    if (p.pick_month != null && p.pick_year != null) {
      set.add(`${p.pick_year}-${p.pick_month}`)
    }
  }
  return set
}

function slugify(s: string, max = 60): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, max)
}

function bookSlugFor(title: string, author: string): string {
  const titlePart = slugify(title)
  const last = author.split(/\s+/).pop() ?? 'unknown'
  const authorPart = last
    .toLowerCase()
    .replace(/[^a-z]/g, '') || 'unknown'
  return `${titlePart}-${authorPart}`
}

async function findBook(title: string, author: string): Promise<string | null> {
  const titleEsc = encodeURIComponent(`*${title.replace(/\*/g, '')}*`)
  const authorEsc = encodeURIComponent(`*${author.replace(/\*/g, '')}*`)
  const url = `${REST}/books?select=id&title=ilike.${titleEsc}&author=ilike.${authorEsc}&limit=1`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return null
  const data = (await res.json()) as Array<{ id: string }>
  return data[0]?.id ?? null
}

interface CoverHit {
  buffer: ArrayBuffer
  contentType: string | null
  sourceUrl: string
}

const MIN_REAL_BYTES = 256

async function fetchImage(url: string): Promise<CoverHit | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Foxing/1.0 (foxing.app; cover backfill)',
        Accept: 'image/*,*/*;q=0.8',
      },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    if (buffer.byteLength < MIN_REAL_BYTES) return null
    return { buffer, contentType: res.headers.get('content-type'), sourceUrl: url }
  } catch {
    return null
  }
}

async function lookupCover(
  isbn: string | null,
  title: string,
  author: string,
): Promise<CoverHit | null> {
  if (isbn) {
    const ol = await fetchImage(
      `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
    )
    if (ol) return ol
  }
  if (isbn) {
    try {
      const r = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&fields=items(volumeInfo(imageLinks))`,
        { signal: AbortSignal.timeout(5000) },
      )
      if (r.ok) {
        const data = (await r.json()) as {
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
          links?.small ??
          links?.thumbnail
        if (url) {
          const upgraded = url
            .replace('zoom=1', 'zoom=3')
            .replace('&edge=curl', '')
            .replace('http://', 'https://')
          const hit = await fetchImage(upgraded)
          if (hit) return hit
        }
      }
    } catch {
      // continue
    }
  }
  try {
    const q = encodeURIComponent(`${title} ${author}`.trim())
    const r = await fetch(
      `https://itunes.apple.com/search?term=${q}&media=ebook&limit=5`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (r.ok) {
      const data = (await r.json()) as {
        results?: Array<{ trackName?: string; artworkUrl100?: string }>
      }
      const firstWord = title.toLowerCase().split(/\s+/)[0] ?? ''
      const match = data.results?.find((m) =>
        m.trackName?.toLowerCase().includes(firstWord),
      )
      if (match?.artworkUrl100) {
        const upgraded = match.artworkUrl100.replace('100x100bb', '600x900bb')
        const hit = await fetchImage(upgraded)
        if (hit) return hit
      }
    }
  } catch {
    // continue
  }
  return null
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

async function storeCover(hit: CoverHit, slug: string): Promise<string | null> {
  const ext = extOf(hit.contentType, hit.sourceUrl)
  const fileName = `${slug}.${ext}`
  const res = await fetch(`${STORAGE}/object/covers/${fileName}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': hit.contentType ?? 'image/jpeg',
      'Cache-Control': 'max-age=31536000',
      'x-upsert': 'true',
    },
    body: hit.buffer,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.warn(`    upload ${fileName}: HTTP ${res.status} ${body.slice(0, 80)}`)
    return null
  }
  return `${SUPABASE_URL}/storage/v1/object/public/covers/${fileName}`
}

async function createBook(
  title: string,
  author: string,
  asin: string | null,
): Promise<string | null> {
  const slug = bookSlugFor(title, author)
  let coverUrl: string | null = null
  const hit = await lookupCover(asin, title, author)
  if (hit) coverUrl = await storeCover(hit, slug)

  const body = [
    {
      title,
      author,
      author_slug: slugify(author),
      slug,
      source: 'community',
      source_type: 'community',
      isbn: asin,
      cover_url: coverUrl,
    },
  ]
  const res = await fetch(`${REST}/books?select=id`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (text.includes('duplicate key') && text.includes('slug')) {
      // race or pre-existing: look up by slug
      const lookup = await fetch(
        `${REST}/books?select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`,
        { headers: HEADERS },
      )
      const data = (await lookup.json()) as Array<{ id: string }>
      return data[0]?.id ?? null
    }
    console.warn(`    createBook "${title}": HTTP ${res.status} ${text.slice(0, 120)}`)
    return null
  }
  const data = (await res.json()) as Array<{ id: string }>
  return data[0]?.id ?? null
}

async function insertPick(
  clubSlug: string,
  clubId: string,
  bookId: string,
  month: number,
  year: number,
): Promise<boolean> {
  const pickedAt = `${year}-${String(month).padStart(2, '0')}-01`
  const body = [
    {
      club_id: clubId,
      book_id: bookId,
      picked_at: pickedAt,
      pick_month: month,
      pick_year: year,
      is_published: true,
      is_auto_discovered: true,
      auto_source: 'booknotification',
      auto_confidence: 'high',
      era_label: getEraLabel(clubSlug, year),
      notes: 'Backfilled from BookNotification.com',
    },
  ]
  const res = await fetch(`${REST}/external_book_club_picks`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.warn(`    insertPick ${month}/${year}: HTTP ${res.status} ${text.slice(0, 120)}`)
    return false
  }
  return true
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

async function processClub(source: ClubSource, club: Club): Promise<void> {
  const picks = await scrapeClub(source)
  if (picks.length === 0) {
    console.log(`${source.slug}: 0 picks scraped`)
    return
  }
  const existing = await getExistingPickSet(club.id)

  let inserted = 0
  let skipped = 0
  let failed = 0
  let count = 0
  for (const pick of picks) {
    const key = `${pick.year}-${pick.month}`
    if (existing.has(key)) {
      skipped++
      continue
    }
    if (LIMIT && count >= LIMIT) break
    count++

    if (DRY_RUN) {
      console.log(
        `  [dry] ${source.slug} ${key}: ${pick.title} by ${pick.author}`,
      )
      inserted++
      existing.add(key)
      continue
    }

    let bookId = await findBook(pick.title, pick.author)
    if (!bookId) {
      bookId = await createBook(pick.title, pick.author, pick.asin)
    }
    if (!bookId) {
      failed++
      continue
    }
    const ok = await insertPick(source.slug, club.id, bookId, pick.month, pick.year)
    if (ok) {
      inserted++
      existing.add(key)
    } else {
      failed++
    }
    await sleep(150)
  }

  console.log(
    `${source.slug}: ${picks.length} picks found, ${inserted} new, ${skipped} skipped${failed ? `, ${failed} failed` : ''}`,
  )
}

async function main(): Promise<void> {
  const clubs = await listClubs()
  const targets = ONLY_CLUB
    ? CLUBS.filter((c) => c.slug === ONLY_CLUB)
    : CLUBS
  if (targets.length === 0) {
    console.error(`No matching club for --club ${ONLY_CLUB}`)
    process.exit(1)
  }

  for (const source of targets) {
    const club = clubs[source.slug]
    if (!club) {
      console.warn(`${source.slug}: no DB row in external_book_clubs, skipping`)
      continue
    }
    try {
      await processClub(source, club)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`${source.slug}: aborted with error: ${msg}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

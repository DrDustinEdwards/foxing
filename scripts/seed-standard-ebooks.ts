// Seeds the books table + epubs/ Storage bucket from Standard Ebooks.
//
// SE put the OPDS catalog behind Patrons authentication and doesn't use
// GitHub Releases for distribution (the org's repos hold ebook source
// files, not compiled EPUBs). Their PUBLIC catalog is the website's
// /ebooks paginated listing — each book entry has Schema.org metadata
// (title, author, cover) and a deterministic download URL pattern, so
// we scrape the catalog HTML instead.
//
// Runs Node-side (not in the app). Needs the Supabase service-role key
// so it can bypass RLS for inserts and uploads. NEVER bundle the
// service-role key into the app — set it only in this script's env.
//
// Usage:
//   # Dry run — list what would be downloaded, no writes:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     npx tsx scripts/seed-standard-ebooks.ts --dry-run
//
//   # Limit to first N books for smoke testing:
//   ... npx tsx scripts/seed-standard-ebooks.ts --limit=5
//
//   # Wipe the books table + epubs/ bucket BEFORE seeding (destructive!):
//   ... npx tsx scripts/seed-standard-ebooks.ts --wipe --confirm
//
//   # Full overnight seed of the entire SE catalog:
//   ... npx tsx scripts/seed-standard-ebooks.ts
//
// Resumable: every run lists existing files in epubs/se/ and skips books
// whose EPUB is already cached. Safe to interrupt and re-run.
//
// Rate limit: SE runs on a single 2GB VPS. Their published etiquette asks
// ≤1 request per 5 seconds, but in practice their proxy starts returning
// 429 around the ~90th sustained download. We sleep CATALOG_SLEEP_MS
// between catalog page fetches and EPUB_SLEEP_MS between EPUB downloads,
// and on a 429 we wait RATE_LIMIT_BACKOFF_MS and retry the failing book
// once before marking it failed.

import { createClient } from '@supabase/supabase-js'
import { Buffer } from 'node:buffer'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CATALOG_BASE = 'https://standardebooks.org'
const PER_PAGE = 48 // max SE accepts per catalog page
const CATALOG_SLEEP_MS = 3000 // 32 catalog pages back-to-back at 2s started 429ing too — 3s is the safe floor
const EPUB_SLEEP_MS = 5000 // SE's published etiquette asks for ≤1 request per 5 seconds; honor that floor
const RATE_LIMIT_BACKOFF_MS = 60000 // wait this long after a 429 before retrying once
const POST_SCRAPE_COOLDOWN_MS = 5 * 60 * 1000 // even a paced 32-page scrape leaves the IP throttled — wait it out before downloads begin
const BUCKET = 'epubs'
const SE_PREFIX = 'se/' // storage path prefix for SE books

const USER_AGENT = 'Foxing/1.0 (catalog seeder; +https://foxing.app)'

// Local catalog cache. Scraping all 32 pages of /ebooks once contributes
// to the 429 wave on resume runs that already have most EPUBs cached, so
// we persist the full catalog to disk on first scrape and reuse it for
// 24 hours. Pass --refresh-catalog to force a re-scrape regardless of age.
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const CATALOG_CACHE_PATH = join(SCRIPT_DIR, 'catalog-cache.json')
const CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface CatalogCache {
  fetchedAt: string // ISO timestamp
  books: SeBook[]
}

interface SeBook {
  authorSlug: string // e.g. mary-shelley
  titleSlug: string // e.g. frankenstein
  title: string // e.g. "Frankenstein; or, the Modern Prometheus"
  author: string // e.g. "Mary Shelley"
  coverUrl: string | null // absolute URL on SE
}

// Combined slug used for both Storage paths and as the canonical
// per-book identifier. Matches SE's own `{author}_{title}.epub`
// download filename.
function combinedSlug(b: Pick<SeBook, 'authorSlug' | 'titleSlug'>): string {
  return `${b.authorSlug}_${b.titleSlug}`
}

function epubDownloadUrl(b: Pick<SeBook, 'authorSlug' | 'titleSlug'>): string {
  // Critical: SE serves an HTML "Your Download Has Started!" interstitial
  // page (8.8 KB, content-type text/html, but HTTP 200) when the bare URL
  // is hit. The actual binary EPUB lives behind the `?source=download`
  // query string. Without it, the seeder silently uploads HTML pages
  // disguised as .epub files. We add the param here for every download.
  return `${CATALOG_BASE}/ebooks/${b.authorSlug}/${b.titleSlug}/downloads/${b.authorSlug}_${b.titleSlug}.epub?source=download`
}

// =====================================================================
// CLI parsing
// =====================================================================

interface Flags {
  dryRun: boolean
  wipe: boolean
  confirm: boolean
  limit: number | null
  startFrom: number | null
  refreshCatalog: boolean
  missing: boolean
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {
    dryRun: false,
    wipe: false,
    confirm: false,
    limit: null,
    startFrom: null,
    refreshCatalog: false,
    missing: false,
  }
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') flags.dryRun = true
    else if (arg === '--wipe') flags.wipe = true
    else if (arg === '--confirm') flags.confirm = true
    else if (arg === '--refresh-catalog') flags.refreshCatalog = true
    else if (arg === '--missing') flags.missing = true
    else if (arg.startsWith('--limit=')) {
      const n = parseInt(arg.slice('--limit='.length), 10)
      if (!Number.isFinite(n) || n < 1) {
        console.error(`[seed] invalid --limit value: ${arg}`)
        process.exit(2)
      }
      flags.limit = n
    } else if (arg.startsWith('--start-from=')) {
      const n = parseInt(arg.slice('--start-from='.length), 10)
      if (!Number.isFinite(n) || n < 1) {
        console.error(`[seed] invalid --start-from value: ${arg}`)
        process.exit(2)
      }
      flags.startFrom = n
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: npx tsx scripts/seed-standard-ebooks.ts [flags]
  --dry-run          Scrape the catalog and log what would happen, no writes.
  --limit=N          Process only the first N entries.
  --start-from=N     Skip directly to entry N (1-indexed). Useful for manual
                     session batching after SE's sustained-download 429 wall —
                     the bucket-existence check still runs, but iteration
                     starts at N so we don't scan thousands of skips.
  --refresh-catalog  Force a fresh catalog scrape (bypass the 24h local cache).
  --missing          Compare cached catalog against bucket contents, print every
                     slug present in the catalog but missing from the bucket,
                     then exit. No downloads, no DB writes. Ignores --limit and
                     --start-from (always reports on the full catalog).
  --wipe             Delete all rows from books and all files from epubs/. Requires --confirm.
  --confirm          Required alongside --wipe to actually perform the destructive step.

Env vars:
  SUPABASE_URL              (required for non-dry-run)
  SUPABASE_SERVICE_ROLE_KEY (required for non-dry-run)`)
      process.exit(0)
    } else {
      console.error(`[seed] unknown arg: ${arg}`)
      process.exit(2)
    }
  }
  return flags
}

// =====================================================================
// Catalog scraping
// =====================================================================

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

function absolutize(href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href
  if (href.startsWith('//')) return `https:${href}`
  if (href.startsWith('/')) return `${CATALOG_BASE}${href}`
  return `${CATALOG_BASE}/${href}`
}

// Each book entry on the catalog page looks like:
//   <li typeof="schema:Book" about="/ebooks/{author}/{title}">
//     ...img src="/images/covers/{slug}-{hash}-cover@2x.jpg"...
//     <span property="schema:name">{Title}</span>...
//     <p class="author"...><span property="schema:name">{Author}</span>...
//   </li>
// The structure is autogenerated and stable. We use regex against the
// per-book <li>...</li> chunks rather than a DOM parser to avoid the
// extra dep — the markup has enough structure for clean matching.
function parseCatalogPage(html: string): SeBook[] {
  const books: SeBook[] = []
  const liRe = /<li typeof="schema:Book" about="\/ebooks\/([^\/]+)\/([^"]+)"[^>]*>([\s\S]*?)<\/li>/g
  let match: RegExpExecArray | null
  while ((match = liRe.exec(html)) !== null) {
    const [, authorSlug, titleSlug, body] = match

    const titleM = body.match(
      /<span property="schema:name">([^<]+)<\/span>/,
    )
    const authorM = body.match(
      /<p class="author"[\s\S]*?<span property="schema:name">([^<]+)<\/span>/,
    )
    const coverM = body.match(
      /<img[^>]+src="([^"]*-cover[^"]*\.jpg)"/,
    )

    if (!titleM || !authorM) continue
    books.push({
      authorSlug,
      titleSlug,
      title: decodeEntities(titleM[1]).trim(),
      author: decodeEntities(authorM[1]).trim(),
      coverUrl: coverM ? absolutize(coverM[1]) : null,
    })
  }
  return books
}

async function fetchCatalogPage(page: number): Promise<string> {
  const url = `${CATALOG_BASE}/ebooks?per-page=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
  })
  if (!res.ok) {
    throw new Error(`catalog page ${page} failed: ${res.status} ${res.statusText}`)
  }
  return await res.text()
}

async function loadCachedCatalog(): Promise<CatalogCache | null> {
  try {
    const raw = await readFile(CATALOG_CACHE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as CatalogCache
    if (
      typeof parsed.fetchedAt !== 'string' ||
      !Array.isArray(parsed.books)
    ) {
      console.warn('[seed] catalog cache is malformed — ignoring')
      return null
    }
    return parsed
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    console.warn(`[seed] catalog cache read failed (${describeError(e)}) — ignoring`)
    return null
  }
}

async function saveCachedCatalog(books: SeBook[]): Promise<void> {
  const payload: CatalogCache = {
    fetchedAt: new Date().toISOString(),
    books,
  }
  await writeFile(CATALOG_CACHE_PATH, JSON.stringify(payload), 'utf8')
  console.log(`[seed] catalog cached to ${CATALOG_CACHE_PATH}`)
}

interface CatalogResult {
  books: SeBook[]
  freshlyScraped: boolean // true if we hit SE this run; signals the post-scrape cooldown
}

async function getCatalog(forceRefresh: boolean): Promise<CatalogResult> {
  if (!forceRefresh) {
    const cached = await loadCachedCatalog()
    if (cached) {
      const ageMs = Date.now() - new Date(cached.fetchedAt).getTime()
      const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(1)
      if (ageMs < CATALOG_CACHE_TTL_MS) {
        console.log(
          `[seed] using cached catalog (${cached.books.length} books, ${ageHours}h old) — pass --refresh-catalog to re-scrape`,
        )
        return { books: cached.books, freshlyScraped: false }
      }
      console.log(
        `[seed] catalog cache is ${ageHours}h old (TTL ${CATALOG_CACHE_TTL_MS / (60 * 60 * 1000)}h) — re-scraping`,
      )
    }
  } else {
    console.log('[seed] --refresh-catalog: bypassing cache')
  }

  const books = await scrapeFullCatalog()
  await saveCachedCatalog(books)
  return { books, freshlyScraped: true }
}

// Sleeps for `totalMs` while logging a countdown every `tickMs`. Used for
// the post-scrape cooldown so it's clear the script is waiting on purpose
// instead of hung.
async function countdownSleep(totalMs: number, tickMs: number, label: string): Promise<void> {
  const startedAt = Date.now()
  const endsAt = startedAt + totalMs
  while (true) {
    const remaining = endsAt - Date.now()
    if (remaining <= 0) break
    const mins = Math.floor(remaining / 60000)
    const secs = Math.floor((remaining % 60000) / 1000)
    const mmss = `${mins}:${secs.toString().padStart(2, '0')}`
    console.log(`[seed] ${label} ${mmss} remaining…`)
    await sleep(Math.min(tickMs, remaining))
  }
}

async function scrapeFullCatalog(): Promise<SeBook[]> {
  const seen = new Set<string>() // dedupe by combined slug
  const all: SeBook[] = []
  let page = 1
  while (true) {
    console.log(`[seed] catalog page ${page}…`)
    const html = await fetchCatalogPage(page)
    const books = parseCatalogPage(html)
    if (books.length === 0) {
      // Empty page — past the end.
      break
    }

    let newOnPage = 0
    for (const b of books) {
      const slug = combinedSlug(b)
      if (seen.has(slug)) continue
      seen.add(slug)
      all.push(b)
      newOnPage++
    }
    console.log(`[seed]   page ${page}: ${books.length} entries, ${newOnPage} new (total: ${all.length})`)

    if (newOnPage === 0) {
      // Page was non-empty but every book was already seen — also past end.
      break
    }
    page++
    await sleep(CATALOG_SLEEP_MS)
  }
  console.log(`[seed] catalog scrape complete: ${all.length} unique books`)
  return all
}

// =====================================================================
// Supabase wipe + upload
// =====================================================================

function makeAdminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(
      '[seed] missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
    )
    process.exit(2)
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type AdminClient = ReturnType<typeof makeAdminClient>

async function wipeAll(supabase: AdminClient) {
  console.log('[seed] WIPE: clearing books table (FKs cascade)…')
  const { error: delErr, count } = await supabase
    .from('books')
    .delete({ count: 'exact' })
    .gte('created_at', '1900-01-01')
  if (delErr) throw delErr
  console.log(
    `[seed] WIPE: deleted ${count ?? 0} books rows (cascaded to user_books, vocabulary, reading_sessions)`,
  )

  console.log(`[seed] WIPE: clearing ${BUCKET}/ bucket…`)
  let totalDeleted = 0
  for (const prefix of ['', SE_PREFIX]) {
    let offset = 0
    while (true) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(prefix, { limit: 1000, offset })
      if (error) throw error
      if (!data || data.length === 0) break

      const fileNames = data
        .filter((f) => f.id !== null)
        .map((f) => `${prefix}${f.name}`)

      if (fileNames.length === 0) break

      const { error: rmErr } = await supabase.storage
        .from(BUCKET)
        .remove(fileNames)
      if (rmErr) throw rmErr
      totalDeleted += fileNames.length

      if (data.length < 1000) break
      offset += data.length
    }
  }
  console.log(`[seed] WIPE: deleted ${totalDeleted} files from ${BUCKET}/`)
}

async function listExistingSlugs(supabase: AdminClient): Promise<Set<string>> {
  // Supabase Storage's list(prefix) returns ONE directory level at a time.
  // Folder entries come back with id: null and don't include their contents.
  // SE translator books are stored as `se/{author_title}/{translator}.epub`
  // (the catalog's titleSlug contains a slash for translated works, and
  // combinedSlug() preserves it). To detect those as cached on resume we
  // recurse one level into each folder entry and join with '/' so the
  // returned slug exactly matches what combinedSlug(book) produces.
  const slugs = new Set<string>()

  async function listLevel(prefix: string, slugPrefix: string): Promise<void> {
    let offset = 0
    while (true) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(prefix, { limit: 1000, offset })
      if (error) throw error
      if (!data || data.length === 0) break
      for (const f of data) {
        if (f.id === null) {
          // Folder — recurse. SE only nests one level (translator slug),
          // but listLevel handles arbitrary depth defensively.
          await listLevel(`${prefix}${f.name}/`, `${slugPrefix}${f.name}/`)
        } else if (f.name.endsWith('.epub')) {
          slugs.add(`${slugPrefix}${f.name.replace(/\.epub$/i, '')}`)
        }
      }
      if (data.length < 1000) break
      offset += data.length
    }
  }

  await listLevel(SE_PREFIX, '')
  return slugs
}

// Typed signal so the retry wrapper can distinguish rate-limit failures
// (worth waiting and retrying) from permanent failures (404, 5xx, malformed
// EPUB) that won't recover.
class RateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
  }
}

async function downloadEpub(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (res.status === 429) {
    throw new RateLimitError(`download failed: 429 Too Many Requests`)
  }
  if (!res.ok) {
    throw new Error(`download failed: ${res.status} ${res.statusText}`)
  }
  const buf = await res.arrayBuffer()

  // Sanity: EPUB files are zip archives, which start with the magic bytes
  // PK\x03\x04 (the "PK" signature for ZIP). If we got something else
  // (e.g. SE's HTML interstitial) we've fetched the wrong URL — fail
  // loudly so we don't pollute the bucket with garbage.
  if (buf.byteLength < 4) {
    throw new Error(`download too small to be EPUB: ${buf.byteLength} bytes`)
  }
  const head = new Uint8Array(buf, 0, 4)
  if (head[0] !== 0x50 || head[1] !== 0x4b || head[2] !== 0x03 || head[3] !== 0x04) {
    const ct = res.headers.get('content-type') || 'unknown'
    throw new Error(
      `not a ZIP/EPUB (first 4 bytes: ${[...head].map((b) => b.toString(16).padStart(2, '0')).join(' ')}, content-type: ${ct}, size: ${buf.byteLength})`,
    )
  }

  return buf
}

async function uploadEpub(
  supabase: AdminClient,
  slug: string,
  data: ArrayBuffer,
): Promise<void> {
  const path = `${SE_PREFIX}${slug}.epub`
  const { error } = await supabase.storage.from(BUCKET).upload(
    path,
    Buffer.from(data),
    {
      contentType: 'application/epub+zip',
      upsert: true,
    },
  )
  if (error) throw error
}

function publicUrlFor(supabase: AdminClient, slug: string): string {
  const path = `${SE_PREFIX}${slug}.epub`
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// ─────────────────────────────────────────────────────────────────────
// Cross-edition dedupe on upsert
// ─────────────────────────────────────────────────────────────────────
// Two-step write so the seeder doesn't recreate the (Gutenberg, SE)
// duplicate pairs the dedupe migration cleaned up:
//   1. Look for an existing row that matches by normalized title +
//      author surname (regardless of source).
//   2. If found → UPDATE that row in place (preserves its UUID +
//      any user_books / highlights / vocabulary FK refs).
//      If not found → INSERT a fresh SE row.
// The previous `upsert(onConflict: epub_url)` only dedupe'd against
// re-runs of the SE seeder itself, which is why the Gutenberg-Frankenstein
// pair survived the first SE pass.

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .split(/[;:]/)[0]
    .replace(/^\s*(the|a|an)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function authorSurname(s: string): string {
  const t = s.toLowerCase().trim()
  if (!t) return ''
  if (t.includes(',')) return t.split(',')[0].trim()
  const parts = t.split(/\s+/)
  return parts[parts.length - 1]
}

interface ExistingBook {
  id: string
  title: string
  author: string
  source: string
}

async function findExistingBook(
  supabase: AdminClient,
  book: SeBook,
): Promise<ExistingBook | null> {
  // Author column is small enough that a prefix match on the surname keeps
  // the row set tiny — then we tighten on the JS side. Postgres `ilike`
  // is case-insensitive and uses an index seek on author when one exists,
  // sequential scan otherwise (still fast at 1.4k rows).
  const surname = authorSurname(book.author)
  if (!surname) return null
  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, source')
    .ilike('author', `%${surname}%`)
  if (error || !data) return null

  const target = normalizeTitle(book.title)
  for (const cand of data) {
    if (
      normalizeTitle(cand.title) === target &&
      authorSurname(cand.author) === surname
    ) {
      return cand as ExistingBook
    }
  }
  return null
}

async function insertBookRow(
  supabase: AdminClient,
  book: SeBook,
  publicUrl: string,
): Promise<void> {
  const existing = await findExistingBook(supabase, book)

  if (existing) {
    // Promote in place. Source flips to standard_ebooks; title/author/
    // cover/epub_url adopt the SE values. We don't touch gutenberg_id
    // (kept as a cross-reference) or subjects (may have curated data).
    const { error } = await supabase
      .from('books')
      .update({
        title: book.title,
        author: book.author,
        cover_url: book.coverUrl,
        source: 'standard_ebooks',
        epub_url: publicUrl,
      })
      .eq('id', existing.id)
    if (error) throw error
    if (existing.source !== 'standard_ebooks') {
      console.log(
        `[seed] · merged ${existing.source} row → SE (kept id ${existing.id.slice(0, 8)}…)`,
      )
    }
    return
  }

  // No match — insert fresh. onConflict: 'epub_url' still guards against
  // re-running the SE seeder by itself.
  const { error } = await supabase.from('books').upsert(
    {
      title: book.title,
      author: book.author,
      cover_url: book.coverUrl,
      source: 'standard_ebooks',
      epub_url: publicUrl,
      language: 'en',
      subjects: [],
      // gutenberg_id stays null for SE books; word_count too.
    },
    { onConflict: 'epub_url' },
  )
  if (error) throw error
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Robust error stringifier. Supabase StorageError objects aren't always
// `instanceof Error` and their default toString() yields "[object Object]",
// which is what was hiding the real cause in earlier runs. Walk likely
// shapes (Error, string, plain object with .message / .error / .error.message)
// and fall through to JSON for everything else.
function describeError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>
    if (typeof o.message === 'string') {
      const status = typeof o.status === 'number' ? ` [${o.status}]` : ''
      return `${o.message}${status}`
    }
    if (typeof o.error === 'string') return o.error
    if (
      o.error && typeof o.error === 'object' &&
      typeof (o.error as Record<string, unknown>).message === 'string'
    ) {
      return (o.error as Record<string, unknown>).message as string
    }
    try {
      return JSON.stringify(e)
    } catch {
      return String(e)
    }
  }
  return String(e)
}

// =====================================================================
// Main
// =====================================================================

async function main() {
  const flags = parseFlags(process.argv)

  if (flags.wipe && !flags.confirm) {
    console.error(
      '[seed] --wipe requires --confirm (this is destructive — deletes all books and EPUBs)',
    )
    process.exit(2)
  }

  const supabase = flags.dryRun ? null : makeAdminClient()

  if (supabase && flags.wipe) {
    await wipeAll(supabase)
  }

  const { books, freshlyScraped } = await getCatalog(flags.refreshCatalog)

  // --missing: report-only diff between the catalog and what's in the
  // bucket. Reports the full catalog regardless of --limit/--start-from,
  // and exits before the post-scrape cooldown so the diff is fast.
  if (flags.missing) {
    if (!supabase) {
      console.error(
        '[seed] --missing requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (cannot inspect bucket)',
      )
      process.exit(2)
    }
    if (flags.limit !== null || flags.startFrom !== null) {
      console.log('[seed] --missing ignores --limit and --start-from; reporting on full catalog')
    }
    const existing = await listExistingSlugs(supabase)
    console.log(
      `[seed] ${existing.size} books cached in ${BUCKET}/${SE_PREFIX}, ${books.length} in catalog`,
    )
    const missingSlugs: string[] = []
    for (const b of books) {
      const slug = combinedSlug(b)
      if (!existing.has(slug)) missingSlugs.push(slug)
    }
    for (const slug of missingSlugs) {
      console.log(slug)
    }
    console.log(`[seed] ${missingSlugs.length} of ${books.length} books missing`)
    return
  }

  const limited = flags.limit !== null ? books.slice(0, flags.limit) : books
  console.log(
    `[seed] processing ${limited.length} books${flags.limit !== null ? ` (--limit=${flags.limit})` : ''}`,
  )

  // Even paced at 3s/page, scraping all 32 catalog pages leaves SE's proxy
  // throttling our IP — the first downloads then 429 immediately. Wait it
  // out before hitting the EPUB endpoint. Skipped when the catalog came
  // from local cache (no fresh requests means no throttle to recover from)
  // and skipped on dry-run (no downloads coming).
  if (freshlyScraped && !flags.dryRun) {
    console.log(
      `[seed] catalog scraped — waiting ${POST_SCRAPE_COOLDOWN_MS / 60000} minutes before downloads to let rate limit reset…`,
    )
    await countdownSleep(POST_SCRAPE_COOLDOWN_MS, 30000, 'cooldown:')
    console.log('[seed] cooldown complete — starting downloads')
  }

  const existing = supabase ? await listExistingSlugs(supabase) : new Set<string>()
  if (supabase) {
    console.log(
      `[seed] ${existing.size} books already cached in ${BUCKET}/${SE_PREFIX}, will skip those`,
    )
    // Sample the first 5 detected slugs so we can eyeball that nested
    // translator paths (e.g. "author_title/translator") are picked up.
    const sample = [...existing].slice(0, 5)
    if (sample.length > 0) {
      console.log(`[seed] sample cached slugs: ${sample.map((s) => `"${s}"`).join(', ')}`)
    }
  }

  let downloaded = 0
  let skipped = 0
  let failed = 0
  let oversize = 0
  let upserted = 0

  // --start-from is 1-indexed for human readability ("start from book 91"),
  // so subtract 1 for the 0-based loop. Skipped entries are not counted in
  // downloaded/skipped/failed — they're just not visited this run.
  const startIndex = flags.startFrom !== null ? Math.max(0, flags.startFrom - 1) : 0
  if (startIndex > 0) {
    console.log(`[seed] --start-from=${flags.startFrom}: skipping first ${startIndex} entries`)
  }

  for (let i = startIndex; i < limited.length; i++) {
    const book = limited[i]
    const slug = combinedSlug(book)
    const idx = `${i + 1}/${limited.length}`

    try {
      // Resume: if EPUB already cached, just upsert the metadata row.
      if (existing.has(slug)) {
        if (supabase) {
          const publicUrl = publicUrlFor(supabase, slug)
          await insertBookRow(supabase, book, publicUrl)
          upserted++
        }
        skipped++
        if (flags.dryRun || (i + 1) % 50 === 0) {
          console.log(`[seed] · skip ${slug} (cached) ${idx}`)
        }
        continue
      }

      if (flags.dryRun) {
        console.log(`[seed] DRY-RUN ${slug}: ${book.title} — ${book.author} ${idx}`)
        continue
      }

      if (!supabase) throw new Error('unreachable')

      await sleep(EPUB_SLEEP_MS)
      let data: ArrayBuffer
      try {
        data = await downloadEpub(epubDownloadUrl(book))
      } catch (e) {
        if (e instanceof RateLimitError) {
          console.warn(
            `[seed] · 429 on ${slug}, backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s then retrying once`,
          )
          await sleep(RATE_LIMIT_BACKOFF_MS)
          data = await downloadEpub(epubDownloadUrl(book))
        } else {
          throw e
        }
      }
      await uploadEpub(supabase, slug, data)

      const publicUrl = publicUrlFor(supabase, slug)
      await insertBookRow(supabase, book, publicUrl)

      downloaded++
      upserted++
      console.log(
        `[seed] ✓ ${book.title} (${(data.byteLength / 1024).toFixed(0)} KB) ${idx}`,
      )
    } catch (e) {
      const msg = describeError(e)
      // Supabase Storage free tier caps individual files at 50 MB. SE's
      // omnibus collected works (e.g. complete Balzac, Shakespeare folios)
      // trip this. It's a permanent failure for this book — there's no
      // retry that helps — so log it distinctly and skip.
      if (/exceeded maximum allowed size/i.test(msg)) {
        oversize++
        console.warn(
          `[seed] ⚠ ${slug} (${book.title}) — too large for Storage tier, skipping permanently`,
        )
      } else {
        failed++
        console.warn(`[seed] ✕ ${slug} (${book.title}) — ${msg}`)
      }
    }
  }

  console.log(
    `[seed] done. downloaded=${downloaded} skipped=${skipped} oversize=${oversize} failed=${failed} books_upserted=${upserted}`,
  )
}

main().catch((err) => {
  console.error('[seed] fatal:', err)
  process.exit(1)
})

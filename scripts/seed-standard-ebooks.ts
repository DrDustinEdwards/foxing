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
// Rate limit: SE runs on a single 2GB VPS; their etiquette asks ≤1
// request per 5 seconds. We sleep CATALOG_SLEEP_MS between catalog page
// fetches and EPUB_SLEEP_MS between EPUB downloads to be polite.

import { createClient } from '@supabase/supabase-js'
import { Buffer } from 'node:buffer'

const CATALOG_BASE = 'https://standardebooks.org'
const PER_PAGE = 48 // max SE accepts per catalog page
const CATALOG_SLEEP_MS = 2000 // small HTML page; 2s is polite
const EPUB_SLEEP_MS = 5000 // EPUB file download; SE's 5s rule
const BUCKET = 'epubs'
const SE_PREFIX = 'se/' // storage path prefix for SE books

const USER_AGENT = 'Foxing/1.0 (catalog seeder; +https://foxing.app)'

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
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { dryRun: false, wipe: false, confirm: false, limit: null }
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') flags.dryRun = true
    else if (arg === '--wipe') flags.wipe = true
    else if (arg === '--confirm') flags.confirm = true
    else if (arg.startsWith('--limit=')) {
      const n = parseInt(arg.slice('--limit='.length), 10)
      if (!Number.isFinite(n) || n < 1) {
        console.error(`[seed] invalid --limit value: ${arg}`)
        process.exit(2)
      }
      flags.limit = n
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: npx tsx scripts/seed-standard-ebooks.ts [flags]
  --dry-run        Scrape the catalog and log what would happen, no writes.
  --limit=N        Process only the first N entries.
  --wipe           Delete all rows from books and all files from epubs/. Requires --confirm.
  --confirm        Required alongside --wipe to actually perform the destructive step.

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
  const slugs = new Set<string>()
  let offset = 0
  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(SE_PREFIX, { limit: 1000, offset })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const f of data) {
      if (f.id !== null && f.name.endsWith('.epub')) {
        slugs.add(f.name.replace(/\.epub$/i, ''))
      }
    }
    if (data.length < 1000) break
    offset += data.length
  }
  return slugs
}

async function downloadEpub(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
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

async function insertBookRow(
  supabase: AdminClient,
  book: SeBook,
  publicUrl: string,
): Promise<void> {
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

  const books = await scrapeFullCatalog()
  const limited = flags.limit !== null ? books.slice(0, flags.limit) : books
  console.log(
    `[seed] processing ${limited.length} books${flags.limit !== null ? ` (--limit=${flags.limit})` : ''}`,
  )

  const existing = supabase ? await listExistingSlugs(supabase) : new Set<string>()
  if (supabase) {
    console.log(
      `[seed] ${existing.size} books already cached in ${BUCKET}/${SE_PREFIX}, will skip those`,
    )
  }

  let downloaded = 0
  let skipped = 0
  let failed = 0
  let upserted = 0

  for (let i = 0; i < limited.length; i++) {
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
      const data = await downloadEpub(epubDownloadUrl(book))
      await uploadEpub(supabase, slug, data)

      const publicUrl = publicUrlFor(supabase, slug)
      await insertBookRow(supabase, book, publicUrl)

      downloaded++
      upserted++
      console.log(
        `[seed] ✓ ${book.title} (${(data.byteLength / 1024).toFixed(0)} KB) ${idx}`,
      )
    } catch (e) {
      failed++
      console.warn(`[seed] ✕ ${slug} (${book.title}) — ${describeError(e)}`)
    }
  }

  console.log(
    `[seed] done. downloaded=${downloaded} skipped=${skipped} failed=${failed} books_upserted=${upserted}`,
  )
}

main().catch((err) => {
  console.error('[seed] fatal:', err)
  process.exit(1)
})

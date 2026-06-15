import 'server-only'

/**
 * Catalog enrichment resolver (publication_year + genre). Pure logic: no DB,
 * no env. Ported UNCHANGED from the approved dry-run resolver so the API route
 * resolves identically to what was reviewed.
 *
 * Strategy: Open Library first (author-validated, title-tiered, earliest credible
 * year across matched works), Google Books as a fallback when OL has no match.
 * Generic Standard-Ebooks collection titles ("Short Fiction", "Poetry") require
 * an exact title match so anthologies don't slip in.
 */

const NOW_YEAR = new Date().getUTCFullYear()

/** Controlled genre vocabulary (15, fixed). subjects -> one or two of these. */
export const GENRES = [
  'fantasy',
  'science-fiction',
  'mystery',
  'horror',
  'romance',
  'adventure',
  'historical-fiction',
  'literary-fiction',
  'poetry',
  'drama',
  'children',
  'humor',
  'philosophy',
  'biography',
  'short-stories',
] as const

// Priority-ordered; word-boundary matches limit noise. First two hits win.
// literary-fiction is the fallback only (never a competitor).
const GENRE_RULES: Array<[string, RegExp[]]> = [
  ['science-fiction', [/\bscience fiction\b/, /\bdystopia/, /\bsci-?fi\b/]],
  ['fantasy', [/\bfantasy\b/, /\bfairy tale/]],
  ['horror', [/\bhorror\b/, /\bghost stories\b/, /\bgothic\b/, /\bvampire/]],
  ['mystery', [/\bdetective\b/, /\bmystery\b/, /\bmysteries\b/, /\bcrime\b/]],
  ['adventure', [/\badventure\b/, /\bsea stories\b/, /\bpirate/, /\bwestern stories\b/]],
  ['historical-fiction', [/\bhistorical fiction\b/]],
  ['romance', [/\bromance\b/, /\blove stories\b/]],
  ['humor', [/\bhumor\b/, /\bhumour\b/, /\bsatire\b/]],
  ['drama', [/\bdrama\b/, /\bplays\b/, /\btraged/, /\btheater\b/, /\btheatre\b/]],
  ['poetry', [/\bpoetry\b/, /\bpoems\b/]],
  ['children', [/\bjuvenile\b/, /\bchildren's\b/, /\bchildrens\b/]],
  ['biography', [/\bbiography\b/, /\bbiographies\b/, /\bautobiograph/, /\bmemoir/]],
  ['philosophy', [/\bphilosophy\b/, /\bethics\b/]],
  ['short-stories', [/\bshort stories\b/]],
]
const FALLBACK_FICTION = 'literary-fiction'

export function mapGenres(subjects: unknown[]): string[] {
  const hay = (subjects ?? []).map((s) => String(s).toLowerCase())
  const hit: string[] = []
  for (const [genre, patterns] of GENRE_RULES) {
    if (hay.some((s) => patterns.some((re) => re.test(s)))) hit.push(genre)
    if (hit.length === 2) break
  }
  if (hit.length === 0 && hay.some((s) => /\bfiction\b|\bnovel/.test(s))) {
    hit.push(FALLBACK_FICTION)
  }
  return hit
}

// ── name matching ──────────────────────────────────────────────────────────

function normalize(s: unknown): string {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(s: unknown): string[] {
  return normalize(s).split(' ').filter(Boolean)
}

// Authors match if they share any normalized token of length >= 4 (catches
// "Liam O'Flaherty" vs "Liam Ó Flaithearta" via "liam"; rejects MacDonald vs
// Asimov). Conservative: a miss falls through to the fallback source / unresolved.
export function authorMatches(queryAuthor: string, candidateAuthors: unknown): boolean {
  const q = new Set(tokens(queryAuthor).filter((t) => t.length >= 4))
  if (q.size === 0) return false
  const cands = Array.isArray(candidateAuthors) ? candidateAuthors : []
  return cands.some((a) => tokens(a).some((t) => t.length >= 4 && q.has(t)))
}

// Title match tiers: 2 = exact normalized equality, 1 = one contains the other.
function titleMatchTier(queryTitle: string, candidateTitle: unknown): number {
  const q = normalize(queryTitle)
  const c = normalize(candidateTitle)
  if (!q || !c) return 0
  if (q === c) return 2
  if (c.includes(q) || q.includes(c)) return 1
  return 0
}

const GENERIC_TITLES = new Set([
  'short fiction',
  'poetry',
  'short stories',
  'collected poetry',
  'collected poems',
  'essays',
  'plays',
])
export function isGenericTitle(title: string): boolean {
  return GENERIC_TITLES.has(normalize(title))
}

function plausibleYear(y: unknown): y is number {
  return typeof y === 'number' && Number.isFinite(y) && y >= 1 && y <= NOW_YEAR
}

interface Lookup {
  source: 'openlibrary' | 'googlebooks'
  year: number | null
  subjects: string[]
  matched: string
  titleTier: number
}

// ── Open Library ────────────────────────────────────────────────────────────

export async function lookupOpenLibrary(
  title: string,
  author: string,
  minTier = 1,
): Promise<Lookup | null> {
  const url =
    'https://openlibrary.org/search.json?fields=title,author_name,first_publish_year,subject&limit=10&' +
    `title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'FoxingCatalogEnrichment/1.0 (hello@foxing.app)' },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { docs?: Array<Record<string, unknown>> }
  const docs = Array.isArray(data.docs) ? data.docs : []

  const eligible = docs
    .map((d) => ({
      doc: d,
      authorOk: authorMatches(author, d.author_name),
      tier: titleMatchTier(title, d.title),
    }))
    .filter((s) => s.authorOk && s.tier >= minTier)
  if (eligible.length === 0) return null

  const years = eligible
    .map((s) => s.doc.first_publish_year)
    .filter(plausibleYear)
  const year = years.length ? Math.min(...years) : null

  const bestTier = Math.max(...eligible.map((s) => s.tier))
  const best = eligible.filter((s) => s.tier === bestTier)
  const subjects: string[] = []
  for (const s of best) {
    if (Array.isArray(s.doc.subject)) subjects.push(...(s.doc.subject as string[]))
  }
  const top = best[0].doc
  return {
    source: 'openlibrary',
    year,
    subjects,
    matched: `${String(top.title)} / ${((top.author_name as string[]) ?? [])[0] ?? '?'}`,
    titleTier: bestTier,
  }
}

// ── Google Books (fallback; needs API key) ──────────────────────────────────

export async function lookupGoogleBooks(
  title: string,
  author: string,
  apiKey: string | null,
  minTier = 1,
): Promise<Lookup | null> {
  if (!apiKey) return null
  const q = `intitle:${title}+inauthor:${author}`
  const url =
    'https://www.googleapis.com/books/v1/volumes?maxResults=5&country=US&' +
    `q=${encodeURIComponent(q)}&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as {
    items?: Array<{ volumeInfo?: Record<string, unknown> }>
  }
  const items = Array.isArray(data.items) ? data.items : []

  const matched = items
    .map((it) => it.volumeInfo ?? {})
    .filter(
      (v) =>
        authorMatches(author, v.authors) &&
        titleMatchTier(title, v.title) >= minTier,
    )
  if (matched.length === 0) return null

  const years = matched
    .map((v) => {
      const m = /(\d{4})/.exec(String(v.publishedDate ?? ''))
      return m ? Number(m[1]) : null
    })
    .filter(plausibleYear)
  const year = years.length ? Math.min(...years) : null

  const subjects: string[] = []
  for (const v of matched) {
    if (Array.isArray(v.categories)) subjects.push(...(v.categories as string[]))
  }
  return {
    source: 'googlebooks',
    year,
    subjects,
    matched: `${String(matched[0].title)} / ${((matched[0].authors as string[]) ?? [])[0] ?? '?'}`,
    titleTier: 1,
  }
}

// ── combined resolve ────────────────────────────────────────────────────────

export interface ResolveInput {
  title: string
  author: string
}

export interface ResolveResult {
  year: number | null
  genres: string[]
  source: 'openlibrary' | 'googlebooks' | null
  matched: string
  confidence: 'high' | 'medium' | 'low' | 'none'
  flags: string[]
}

/** Resolve one book to { year, genres, source, matched, confidence, flags }. */
export async function resolveBook(
  book: ResolveInput,
  opts: { googleKey?: string | null } = {},
): Promise<ResolveResult> {
  const { googleKey = null } = opts
  const flags: string[] = []
  const generic = isGenericTitle(book.title)
  if (generic) flags.push('generic-title')
  const minTier = generic ? 2 : 1

  let r: Lookup | null = null
  try {
    r = await lookupOpenLibrary(book.title, book.author, minTier)
  } catch {
    r = null
  }
  if ((!r || r.year == null) && googleKey) {
    try {
      const g = await lookupGoogleBooks(book.title, book.author, googleKey, minTier)
      if (g) {
        r = r
          ? { ...r, year: r.year ?? g.year, subjects: [...r.subjects, ...g.subjects] }
          : g
      }
    } catch {
      // ignore; stays unresolved
    }
  }

  if (!r) {
    return { year: null, genres: [], source: null, matched: '(none)', confidence: 'none', flags }
  }

  if (r.year != null && r.year < 1000) flags.push('pre-1000-manual')
  if (r.titleTier === 1) flags.push('partial-title')

  const genres = mapGenres(r.subjects)
  const confidence: ResolveResult['confidence'] =
    r.source === 'openlibrary' && r.titleTier === 2 && r.year != null
      ? 'high'
      : r.year != null
        ? 'medium'
        : 'low'

  return { year: r.year, genres, source: r.source, matched: r.matched, confidence, flags }
}

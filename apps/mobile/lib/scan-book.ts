// Barcode scanner data layer.
//
// The Foxing catalog is public-domain editions with ZERO ISBNs, so a scanned
// EAN-13 is never matched against books.isbn directly. Instead: resolve the
// ISBN to title+author via Google Books, then fuzzy-match title+author against
// the catalog (the same shape as the web Goodreads import matcher).
import { supabase } from './supabase'

export interface ScannedBook {
  id: string
  slug: string | null
  title: string
  author: string
  cover_url: string | null
  epub_url: string | null
  source_type: string | null
}

export interface ResolvedMeta {
  title: string
  author: string | null
}

export interface ScanResult {
  // Catalog match, if any.
  match: ScannedBook | null
  // What Google Books said the ISBN is, even when the catalog has no match.
  resolved: ResolvedMeta | null
}

export type LibraryStatus = 'want_to_read' | 'reading' | 'finished'

const GOOGLE_BOOKS = 'https://www.googleapis.com/books/v1/volumes'
const BOOK_COLS = 'id, slug, title, author, cover_url, epub_url, source_type'

function cleanIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase()
}

// Google Books volume lookup by ISBN. The public endpoint resolves ISBNs
// without an API key (the keyed catalog-enrichment path lives server-side).
async function googleBooksMeta(isbn: string): Promise<ResolvedMeta | null> {
  try {
    const res = await fetch(`${GOOGLE_BOOKS}?q=isbn:${isbn}&maxResults=1`)
    if (!res.ok) return null
    const json = (await res.json()) as {
      items?: Array<{ volumeInfo?: { title?: string; authors?: string[] } }>
    }
    const info = json.items?.[0]?.volumeInfo
    if (!info?.title) return null
    return { title: info.title, author: info.authors?.[0] ?? null }
  } catch {
    return null
  }
}

// Case-insensitive title match with an author-overlap check, mirroring the
// Goodreads import matcher. When Google gives an author, an overlap is required
// so common titles don't false-match; title-only matches are allowed when no
// author is known.
async function matchCatalog(meta: ResolvedMeta): Promise<ScannedBook | null> {
  const title = meta.title.trim()
  if (!title) return null

  let { data } = await supabase
    .from('books')
    .select(BOOK_COLS)
    .ilike('title', title)
    .limit(10)
  let rows = (data as ScannedBook[] | null) ?? []
  if (rows.length === 0) {
    const resp = await supabase
      .from('books')
      .select(BOOK_COLS)
      .ilike('title', `%${title}%`)
      .limit(10)
    rows = (resp.data as ScannedBook[] | null) ?? []
  }
  if (rows.length === 0) return null

  const author = (meta.author ?? '').trim().toLowerCase()
  if (!author) return rows[0]
  const withAuthor = rows.find((b) => {
    const a = (b.author ?? '').toLowerCase()
    return a.includes(author) || author.includes(a)
  })
  return withAuthor ?? null
}

export async function resolveScannedIsbn(
  isbnRaw: string,
): Promise<{ ok: true; result: ScanResult } | { ok: false; error: string }> {
  const isbn = cleanIsbn(isbnRaw)
  if (isbn.length !== 10 && isbn.length !== 13) {
    return { ok: false, error: 'ISBN must be 10 or 13 digits.' }
  }
  const meta = await googleBooksMeta(isbn)
  if (!meta) return { ok: true, result: { match: null, resolved: null } }
  const match = await matchCatalog(meta)
  return { ok: true, result: { match, resolved: meta } }
}

// ── Club context ───────────────────────────────────────────────────────────

export interface ClubRel {
  club_id: string
  name: string
  role: 'admin' | 'moderator' | 'member'
  reading: boolean
  hasThread: boolean
}

export function isClubMod(role: ClubRel['role']): boolean {
  return role === 'admin' || role === 'moderator'
}

// For the viewer's active clubs, how each relates to the scanned book.
export async function loadClubContext(
  bookId: string,
  userId: string,
): Promise<ClubRel[]> {
  const { data: memberships } = await supabase
    .from('club_members')
    .select('club_id, role, status')
    .eq('user_id', userId)
  const mems = (
    (memberships as
      | Array<{ club_id: string; role: string; status: string | null }>
      | null) ?? []
  ).filter((m) => m.status === 'active' || m.status === null)
  if (mems.length === 0) return []
  const clubIds = mems.map((m) => m.club_id)

  const [clubsRes, currentBooksRes, threadsRes] = await Promise.all([
    supabase.from('clubs').select('id, name, current_book_id').in('id', clubIds),
    supabase
      .from('club_books')
      .select('club_id')
      .eq('book_id', bookId)
      .eq('is_current', true)
      .in('club_id', clubIds),
    supabase
      .from('club_threads')
      .select('club_id')
      .eq('book_id', bookId)
      .in('club_id', clubIds),
  ])

  const clubs =
    (clubsRes.data as
      | Array<{ id: string; name: string; current_book_id: string | null }>
      | null) ?? []
  const currentClubs = new Set(
    ((currentBooksRes.data as Array<{ club_id: string }> | null) ?? []).map(
      (r) => r.club_id,
    ),
  )
  const threadClubs = new Set(
    ((threadsRes.data as Array<{ club_id: string }> | null) ?? []).map(
      (r) => r.club_id,
    ),
  )
  const roleByClub = new Map(
    mems.map((m) => [m.club_id, m.role as ClubRel['role']]),
  )

  return clubs.map((c) => ({
    club_id: c.id,
    name: c.name,
    role: roleByClub.get(c.id) ?? 'member',
    reading: c.current_book_id === bookId || currentClubs.has(c.id),
    hasThread: threadClubs.has(c.id),
  }))
}

// ── Destination writes ───────────────────────────────────────────────────────

// Set the scanned book as a club's current read: update clubs.current_book_id
// and flip club_books.is_current (RLS: club mods only).
export async function setClubCurrentRead(
  clubId: string,
  bookId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error: clubErr } = await supabase
    .from('clubs')
    .update({ current_book_id: bookId })
    .eq('id', clubId)
  if (clubErr) return { ok: false, error: clubErr.message }
  await supabase
    .from('club_books')
    .update({ is_current: false })
    .eq('club_id', clubId)
    .neq('book_id', bookId)
  const { data: existing } = await supabase
    .from('club_books')
    .select('id')
    .eq('club_id', clubId)
    .eq('book_id', bookId)
    .maybeSingle()
  if (existing) {
    await supabase
      .from('club_books')
      .update({ is_current: true })
      .eq('id', (existing as { id: string }).id)
  } else {
    const { error: insErr } = await supabase
      .from('club_books')
      .insert({ club_id: clubId, book_id: bookId, is_current: true })
    if (insErr) return { ok: false, error: insErr.message }
  }
  return { ok: true }
}

// Start a book-scoped club thread (RLS: members; author_id must be the caller).
export async function startClubBookThread(
  clubId: string,
  bookId: string,
  title: string,
): Promise<{ ok: boolean; threadId?: string; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in required.' }
  const { data, error } = await supabase
    .from('club_threads')
    .insert({
      club_id: clubId,
      book_id: bookId,
      author_id: user.id,
      title: title.slice(0, 200),
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, threadId: (data as { id: string }).id }
}

// Add the scanned book to the viewer's library (idempotent upsert).
export async function addScannedToLibrary(
  bookId: string,
  status: LibraryStatus,
): Promise<{ ok: boolean; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in required.' }
  const row: Record<string, unknown> = {
    user_id: user.id,
    book_id: bookId,
    status,
  }
  const now = new Date().toISOString()
  if (status === 'reading') row.started_at = now
  if (status === 'finished') row.finished_at = now
  const { error } = await supabase
    .from('user_books')
    .upsert(row, { onConflict: 'user_id,book_id' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

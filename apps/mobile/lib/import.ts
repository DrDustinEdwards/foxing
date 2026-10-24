// Goodreads and StoryGraph CSV imports, and the catalog matcher the barcode scanner shares. Each row is matched against the Foxing catalog
// through /search and lands as an offline user_book write (status, finish date, the
// reader's review as private notes), so a long import survives a dropped connection.
import type * as W from '@foxing/types'
import { api, syncNow } from '@/lib/api'
import { enqueue } from '@/lib/sync-queue'

export type ImportSource = 'Goodreads' | 'StoryGraph'

export interface ImportResult {
  imported: number
  skipped: number
}

interface ImportRow {
  title: string
  author: string
  status: W.ShelfStatus
  finishedAt: number | null
  notes: string
}

// Tolerant RFC 4180 parser: quoted fields with embedded commas, line breaks and "".
// Review columns routinely hold all three, so a naive split breaks.
function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') inQuotes = false
      else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      row.push(field)
      out.push(row)
      row = []
      field = ''
      if (ch === '\r' && text[i + 1] === '\n') i++
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    out.push(row)
  }
  return out
}

// "Last, First & Other" to "First Last": the catalog stores one display author.
function normalizeAuthor(raw: string): string {
  const first = raw.split(/\s*[&;]\s*/)[0]?.trim() ?? ''
  const [last, rest] = first.split(',').map((s) => s.trim())
  return first.includes(',') && last && rest ? `${rest} ${last}` : first
}

function toStatus(shelf: string): W.ShelfStatus {
  const s = shelf.toLowerCase().trim()
  if (['read', 'finished', 'completed'].includes(s)) return 'finished'
  if (['currently-reading', 'currently reading', 'reading'].includes(s)) return 'reading'
  if (['did-not-finish', 'did not finish', 'dnf', 'abandoned'].includes(s)) return 'abandoned'
  if (s === 'paused') return 'paused'
  return 'want'
}

function toTime(date: string): number | null {
  const t = date ? Date.parse(date.replace(/\//g, '-')) : Number.NaN
  return Number.isFinite(t) ? t : null
}

/** The two exports name their columns differently; this reads either. */
function readRows(text: string, source: ImportSource): ImportRow[] {
  const [header, ...rows] = parseCsv(text)
  if (!header) return []
  const names = header.map((h) => h.trim().toLowerCase())
  const col = (...options: string[]) => options.map((o) => names.indexOf(o)).find((i) => i >= 0) ?? -1
  const goodreads = source === 'Goodreads'
  const title = col('title')
  const author = goodreads ? col('author') : col('authors')
  const shelf = goodreads ? col('exclusive shelf') : col('read status', 'shelves')
  const date = goodreads ? col('date read') : col('last date read', 'date read')
  const review = goodreads ? col('my review') : col('review')
  const cell = (cols: string[], i: number) => (i >= 0 ? (cols[i] ?? '').trim() : '')
  return rows
    .filter((cols) => cell(cols, title))
    .map((cols) => {
      const status = toStatus(cell(cols, shelf).split(/[|,]/)[0] ?? '')
      return {
        title: cell(cols, title),
        author: normalizeAuthor(cell(cols, author)),
        status,
        finishedAt: status === 'finished' ? toTime(cell(cols, date)) : null,
        notes: cell(cols, review),
      }
    })
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** The catalog book with this title (series suffixes aside) and a shared author surname. */
export async function findCatalogBook(rawTitle: string, author: string | null): Promise<W.BookCard | null> {
  // Goodreads titles carry the series in brackets: "Dune (Dune, #1)".
  const title = norm(rawTitle.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, ''))
  const surname = norm(author ?? '').split(' ').pop() ?? ''
  const page = await api.get<W.SearchPage>(`/search?q=${encodeURIComponent(`${title} ${surname}`.trim())}`)
  return (
    page.books.find((b) => norm(b.title).startsWith(title) && (!surname || norm(b.author).includes(surname))) ??
    null
  )
}

export async function importCsv(
  text: string,
  source: ImportSource,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const rows = readRows(text, source)
  let imported = 0
  for (const [i, row] of rows.entries()) {
    const bookId = (await findCatalogBook(row.title, row.author).catch(() => null))?.id
    if (bookId) {
      await enqueue({
        resource: 'user_book',
        verb: 'update',
        payload: {
          bookId,
          status: row.status,
          ...(row.finishedAt ? { finishedAt: row.finishedAt } : {}),
          ...(row.notes ? { personalNotes: row.notes.slice(0, 2000) } : {}),
        },
      })
      imported++
    }
    onProgress?.(i + 1, rows.length)
  }
  // One push for the whole import rather than one per book.
  void syncNow()
  return { imported, skipped: rows.length - imported }
}

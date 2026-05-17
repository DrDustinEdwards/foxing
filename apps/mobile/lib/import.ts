// CSV importers for shelf services. Each importer takes a picked CSV file
// URI plus the signed-in user's id, parses the CSV, fuzz-matches each row
// against the books table by title+author, and upserts a user_books row for
// every match. Returns { imported, skipped } so the caller can show a result.
//
// Goodreads importer lives inline in app/settings/index.tsx (predates this
// module). New importers go here and follow the same return shape.

import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '@/lib/supabase'

export interface ImportResult {
  imported: number
  skipped: number
}

interface NormalizedRow {
  title: string
  author: string
  rating: number
  dateRead: string
  shelves: string[]
  notes: string
}

// Tolerant RFC 4180-ish CSV parser. Handles quoted fields with embedded
// commas, escaped double-quotes (""), and \r\n line endings. Kept here so
// each importer has a single canonical parser.
export function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let inQuotes = false
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i += 2
        continue
      }
      if (ch === '"') {
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (ch === '\n' || ch === '\r') {
      row.push(field)
      field = ''
      out.push(row)
      row = []
      if (ch === '\r' && text[i + 1] === '\n') i += 2
      else i += 1
      continue
    }
    field += ch
    i += 1
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    out.push(row)
  }
  return out
}

// Postgrest ilike treats _ and % as wildcards. Escape user-supplied search
// terms so a title with these chars matches literally.
export function escapeIlike(s: string): string {
  return s.replace(/([%_\\])/g, '\\$1')
}

// "Last, First" → "First Last". Handles "Last, First & Other, First" by
// taking the first author only, our books table is single-author. Falls
// through for already-normal "First Last" input and "Mononym" inputs.
export function normalizeAuthor(raw: string): string {
  const first = raw.split(/\s*&\s*|\s*;\s*/)[0]?.trim() ?? ''
  if (!first) return ''
  if (first.includes(',')) {
    const [last, rest] = first.split(',').map((s) => s.trim())
    if (last && rest) return `${rest} ${last}`
  }
  return first
}

function mapShelfToStatus(shelf: string): 'reading' | 'want_to_read' | 'finished' | 'abandoned' {
  const s = shelf.toLowerCase().trim()
  if (s === 'read' || s === 'finished' || s === 'completed') return 'finished'
  if (s === 'currently-reading' || s === 'reading' || s === 'currently reading') return 'reading'
  if (s === 'abandoned' || s === 'did-not-finish' || s === 'dnf' || s === 'did not finish') return 'abandoned'
  return 'want_to_read'
}

// Match-and-upsert loop shared by Calibre + StoryGraph importers. The match
// strategy is ilike-on-title-and-author, same as the Goodreads importer
// already in settings. We also forward any optional notes/tags via separate
// best-effort calls so they don't block the basic shelf assignment.
async function processRows(userId: string, rows: NormalizedRow[]): Promise<ImportResult> {
  let imported = 0
  let skipped = 0
  for (const r of rows) {
    if (!r.title) {
      skipped += 1
      continue
    }
    let q = supabase
      .from('books')
      .select('id')
      .ilike('title', `%${escapeIlike(r.title)}%`)
      .limit(1)
    if (r.author) q = q.ilike('author', `%${escapeIlike(r.author)}%`)
    const { data: match } = await q
    const bookId = ((match ?? [])[0] as { id?: string } | undefined)?.id
    if (!bookId) {
      skipped += 1
      continue
    }
    // Default to 'finished' when a date_read is present, otherwise treat
    // the import as a want-to-read entry (Calibre rarely tracks status
    // explicitly). Shelves can override when StoryGraph supplies them.
    const status = r.shelves.length > 0
      ? mapShelfToStatus(r.shelves[0])
      : (r.dateRead ? 'finished' : 'want_to_read')
    const finishedIso = r.dateRead ? new Date(r.dateRead).toISOString() : null
    const { error } = await supabase.from('user_books').upsert(
      {
        user_id: userId,
        book_id: bookId,
        status,
        rating: r.rating > 0 ? r.rating : null,
        finished_at: status === 'finished' ? finishedIso : null,
        started_at: status === 'reading' ? (finishedIso ?? new Date().toISOString()) : null,
      },
      { onConflict: 'user_id,book_id' },
    )
    if (error) {
      console.warn('[import] upsert failed:', error.message)
      skipped += 1
      continue
    }
    imported += 1
    // Best-effort: review/notes column. user_books has a `review` column;
    // we land Calibre `comments` there if no public review exists yet.
    if (r.notes && r.notes.trim()) {
      try {
        await supabase
          .from('user_books')
          .update({ review: r.notes.trim().slice(0, 2000) })
          .eq('user_id', userId)
          .eq('book_id', bookId)
          .is('review', null)
      } catch { /* column shape may differ, silent */ }
    }
    // Best-effort: tags / shelves. Optional table user_book_tags, if it
    // doesn't exist the insert fails and we just skip the tags side-effect.
    if (r.shelves.length > 0) {
      try {
        const rows = r.shelves.slice(0, 8).map((tag) => ({
          user_id: userId,
          book_id: bookId,
          tag: tag.toLowerCase().trim(),
        }))
        await supabase.from('user_book_tags').upsert(rows, {
          onConflict: 'user_id,book_id,tag',
          ignoreDuplicates: true,
        })
      } catch { /* table optional */ }
    }
  }
  return { imported, skipped }
}

// ── StoryGraph ───────────────────────────────────────────────────────────
// Standard StoryGraph export: Title, Authors, My Rating, Date Read, Shelves,
// Review. Rating is already 0..5 (half-star granularity). Shelves are
// pipe- or comma-separated free text.
export async function importFromStoryGraph(fileUri: string, userId: string): Promise<ImportResult> {
  const csv = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.UTF8,
  })
  const rows = parseCsv(csv)
  if (rows.length < 2) return { imported: 0, skipped: 0 }
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = (name: string) => header.indexOf(name)
  const titleIdx = col('title')
  const authorsIdx = col('authors')
  const ratingIdx = col('star rating') >= 0 ? col('star rating') : col('my rating')
  const dateIdx = col('last date read') >= 0 ? col('last date read') : col('date read')
  const shelvesIdx = col('read status') >= 0 ? col('read status') : col('shelves')
  const reviewIdx = col('review')

  const normalized: NormalizedRow[] = []
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r]
    if (cols.length === 0) continue
    const title = (titleIdx >= 0 ? cols[titleIdx] ?? '' : '').trim()
    if (!title) continue
    const authorsRaw = (authorsIdx >= 0 ? cols[authorsIdx] ?? '' : '').trim()
    const ratingRaw = ratingIdx >= 0 ? cols[ratingIdx] ?? '' : ''
    const ratingNum = parseFloat(ratingRaw)
    const rating = Number.isFinite(ratingNum)
      ? Math.max(0, Math.min(5, Math.round(ratingNum)))
      : 0
    const dateRead = (dateIdx >= 0 ? cols[dateIdx] ?? '' : '').trim()
    const shelvesRaw = (shelvesIdx >= 0 ? cols[shelvesIdx] ?? '' : '').trim()
    const shelves = shelvesRaw
      ? shelvesRaw.split(/[|,]/).map((s) => s.trim()).filter(Boolean)
      : []
    const notes = (reviewIdx >= 0 ? cols[reviewIdx] ?? '' : '').trim()
    normalized.push({
      title,
      author: normalizeAuthor(authorsRaw),
      rating,
      dateRead,
      shelves,
      notes,
    })
  }
  return processRows(userId, normalized)
}

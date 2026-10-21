

export function csvEscape(v: unknown): string {
  if (v == null) return ''
  const s = String(v).replace(/"/g, '""').replace(/\r?\n/g, ' ')
  return s.includes(',') || s.includes('"') ? `"${s}"` : s
}

interface GoodreadsRow {
  title: string
  author: string
  rating: number
  dateRead: string
  shelf: string
  review: string
}

// Tolerant CSV parser, handles quoted fields with embedded commas + escaped
// double-quotes (RFC 4180-ish). Goodreads exports are well-formed but the
// review column frequently contains commas + line breaks, so a naive split
// won't work.
function parseCsv(text: string): string[][] {
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
      // Consume \r\n as one line break.
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

export function parseGoodreadsCsv(text: string): GoodreadsRow[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const idx = (name: string) => header.indexOf(name)
  const titleIdx = idx('title')
  const authorIdx = idx('author')
  const ratingIdx = idx('my rating')
  const dateReadIdx = idx('date read')
  const shelfIdx = idx('exclusive shelf')
  const reviewIdx = idx('my review')
  const out: GoodreadsRow[] = []
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r]
    if (cols.length === 0) continue
    const title = (titleIdx >= 0 ? cols[titleIdx] ?? '' : '').trim()
    if (!title) continue
    const ratingRaw = ratingIdx >= 0 ? cols[ratingIdx] ?? '' : ''
    const rating = parseInt(ratingRaw, 10)
    out.push({
      title,
      author: (authorIdx >= 0 ? cols[authorIdx] ?? '' : '').trim(),
      rating: Number.isFinite(rating) ? rating : 0,
      dateRead: (dateReadIdx >= 0 ? cols[dateReadIdx] ?? '' : '').trim(),
      shelf: (shelfIdx >= 0 ? cols[shelfIdx] ?? '' : '').trim(),
      review: (reviewIdx >= 0 ? cols[reviewIdx] ?? '' : '').trim(),
    })
  }
  return out
}

export function mapShelf(shelf: string): 'reading' | 'want_to_read' | 'finished' {
  const s = (shelf || '').toLowerCase()
  if (s === 'read') return 'finished'
  if (s === 'currently-reading') return 'reading'
  return 'want_to_read'
}

// Postgrest ilike treats _ and % as wildcards, escape user-supplied search
// terms so a Goodreads title with these chars matches literally.
export function escapeIlike(s: string): string {
  return s.replace(/([%_])/g, '\\$1')
}

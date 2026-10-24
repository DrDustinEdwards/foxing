// Annotation exporters, text / csv / markdown. Pure functions: take a list
// of highlights + book metadata, return a string ready to hand to Share.

export interface ExportableHighlight {
  text: string
  note: string | null
  color: string | null
  chapter: string | null
}

export function exportAsText(
  highlights: ExportableHighlight[],
  bookTitle: string,
  author: string,
): string {
  const lines: string[] = []
  lines.push(`${bookTitle}${author ? `, ${author}` : ''}`)
  lines.push('')
  for (const h of highlights) {
    if (h.chapter) lines.push(`Chapter: ${h.chapter}`)
    lines.push(`"${h.text.trim()}"`)
    if (h.note && h.note.trim()) lines.push(h.note.trim())
    lines.push('')
  }
  return lines.join('\n').trimEnd() + '\n'
}

export function exportAsCsv(
  highlights: ExportableHighlight[],
  bookTitle: string,
  author: string,
): string {
  const header = ['Chapter', 'Highlight', 'Note', 'Color']
  const rows = highlights.map((h) => [
    h.chapter ?? '',
    h.text ?? '',
    h.note ?? '',
    h.color ?? '',
  ])
  const titleRow = [`# ${bookTitle}${author ? `, ${author}` : ''}`]
  return [csvRow(titleRow), csvRow(header), ...rows.map(csvRow)].join('\n') + '\n'
}

export function exportAsMarkdown(
  highlights: ExportableHighlight[],
  bookTitle: string,
  author: string,
): string {
  const lines: string[] = []
  lines.push(`# ${bookTitle}, Highlights`)
  if (author) lines.push(`*${author}*`)
  lines.push('')

  // Group by chapter while preserving the highlight list's original order.
  let currentChapter: string | null = null
  for (const h of highlights) {
    const chapter = h.chapter ?? 'Unsorted'
    if (chapter !== currentChapter) {
      currentChapter = chapter
      lines.push(`## ${chapter}`)
      lines.push('')
    }
    // Indent the quoted text, `>` paragraphs preserve line breaks correctly.
    const quoted = h.text
      .trim()
      .split('\n')
      .map((l) => `> ${l}`)
      .join('\n')
    lines.push(quoted)
    if (h.note && h.note.trim()) {
      lines.push('')
      lines.push(h.note.trim())
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }
  // Drop the trailing divider so the output ends on content.
  while (lines.length > 0 && (lines[lines.length - 1] === '' || lines[lines.length - 1] === '---')) {
    lines.pop()
  }
  return lines.join('\n') + '\n'
}

// CSV per RFC 4180: quote any field that contains a comma, quote, or newline,
// and double any embedded quote.
function csvRow(cells: string[]): string {
  return cells.map(csvEscape).join(',')
}

function csvEscape(v: string): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

import 'server-only'

/**
 * Minimal server-side markdown renderer used by the public journal pages.
 * Supports headings (with anchor ids), paragraphs, bold, italic, inline
 * code, links, blockquotes, ordered/unordered lists, and horizontal rules.
 * Output HTML is intentionally simple so the .journal-prose styles in
 * globals.css can own all spacing and typography.
 */

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function headingId(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

function inlineFormat(s: string): string {
  let v = escape(s)
  v = v.replace(/`([^`]+)`/g, '<code>$1</code>')
  v = v.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  v = v.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  v = v.replace(/_([^_]+)_/g, '<em>$1</em>')
  v = v.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, label: string, href: string) => {
      const safeHref = href.replace(/"/g, '&quot;')
      const isExternal = /^https?:\/\//.test(href)
      const rel = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${safeHref}"${rel}>${label}</a>`
    },
  )
  return v
}

export function renderJournalMarkdown(src: string): string {
  if (!src || !src.trim()) return ''

  const lines = src.split('\n')
  const out: string[] = []
  let inUl = false
  let inOl = false
  let inQuote = false
  let paragraph: string[] = []

  function flushParagraph() {
    if (paragraph.length === 0) return
    out.push(`<p>${inlineFormat(paragraph.join(' '))}</p>`)
    paragraph = []
  }

  function closeBlocks() {
    flushParagraph()
    if (inUl) {
      out.push('</ul>')
      inUl = false
    }
    if (inOl) {
      out.push('</ol>')
      inOl = false
    }
    if (inQuote) {
      out.push('</blockquote>')
      inQuote = false
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    if (line === '') {
      closeBlocks()
      continue
    }

    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
      closeBlocks()
      out.push('<hr />')
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      closeBlocks()
      const level = heading[1].length
      const text = heading[2]
      const id = headingId(text)
      out.push(`<h${level} id="${id}">${inlineFormat(text)}</h${level}>`)
      continue
    }

    const ol = /^\d+\.\s+(.*)$/.exec(line)
    if (ol) {
      flushParagraph()
      if (inUl) {
        out.push('</ul>')
        inUl = false
      }
      if (inQuote) {
        out.push('</blockquote>')
        inQuote = false
      }
      if (!inOl) {
        out.push('<ol>')
        inOl = true
      }
      out.push(`<li>${inlineFormat(ol[1])}</li>`)
      continue
    }

    const ul = /^[-*]\s+(.*)$/.exec(line)
    if (ul) {
      flushParagraph()
      if (inOl) {
        out.push('</ol>')
        inOl = false
      }
      if (inQuote) {
        out.push('</blockquote>')
        inQuote = false
      }
      if (!inUl) {
        out.push('<ul>')
        inUl = true
      }
      out.push(`<li>${inlineFormat(ul[1])}</li>`)
      continue
    }

    if (inUl) {
      out.push('</ul>')
      inUl = false
    }
    if (inOl) {
      out.push('</ol>')
      inOl = false
    }

    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) {
      flushParagraph()
      if (!inQuote) {
        out.push('<blockquote>')
        inQuote = true
      }
      out.push(`<p>${inlineFormat(quote[1])}</p>`)
      continue
    }

    if (inQuote) {
      out.push('</blockquote>')
      inQuote = false
    }

    paragraph.push(line)
  }
  closeBlocks()
  return out.join('\n')
}

export function extractH2Headings(
  src: string,
): Array<{ id: string; text: string }> {
  const headings: Array<{ id: string; text: string }> = []
  for (const rawLine of src.split('\n')) {
    const m = /^##\s+(.*)$/.exec(rawLine.trimEnd())
    if (m) {
      const text = m[1].trim()
      headings.push({ id: headingId(text), text })
    }
  }
  return headings
}

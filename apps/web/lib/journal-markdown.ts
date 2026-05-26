import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Server-side markdown renderer for journal posts. Supports standard
 * markdown plus the editor's shortcodes (::youtube, ::bookmark,
 * ::postlink, :::tip/warning/note/danger, :::pullquote, :::toggle).
 *
 * Block-level shortcodes are extracted up front, replaced with
 * single-line placeholders, then the markdown loop runs as before.
 * After the loop the placeholders are swapped back for rendered HTML
 * so paragraph/list logic never sees the shortcode source.
 *
 * Inline shortcodes (::postlink) are substituted in the final HTML.
 */

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;')
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
      const safeHref = escapeAttr(href)
      const isExternal = /^https?:\/\//.test(href)
      const rel = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${safeHref}"${rel}>${label}</a>`
    },
  )
  return v
}

function renderInlineImage(line: string): string | null {
  const m = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line)
  if (!m) return null
  const alt = escape(m[1])
  const src = escapeAttr(m[2])
  return `<img src="${src}" alt="${alt}" loading="lazy" />`
}

async function fetchBookmarkTitle(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Foxing/1.0 (+https://foxing.app)',
      },
      next: { revalidate: 86400 },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const ctype = res.headers.get('content-type') ?? ''
    if (!/text\/html|application\/xhtml/.test(ctype)) return null
    const text = await res.text()
    const m =
      /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text) ??
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i.exec(
        text,
      )
    return m ? m[1].replace(/\s+/g, ' ').trim() : null
  } catch {
    return null
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

async function renderBookmark(url: string): Promise<string> {
  const title = await fetchBookmarkTitle(url)
  const href = escapeAttr(url)
  const domain = escape(domainOf(url))
  const label = escape(title ?? url)
  return (
    `<a href="${href}" target="_blank" rel="noopener noreferrer" class="journal-bookmark">` +
    `<span class="journal-bookmark-domain">${domain}</span>` +
    `<span class="journal-bookmark-title">${label}</span>` +
    `</a>`
  )
}

function renderYouTube(videoId: string): string {
  const safe = escapeAttr(videoId)
  return (
    `<div class="journal-embed-youtube">` +
    `<iframe ` +
    `src="https://www.youtube-nocookie.com/embed/${safe}" ` +
    `title="YouTube video" ` +
    `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
    `allowfullscreen loading="lazy"></iframe>` +
    `</div>`
  )
}

function renderCallout(kind: string, body: string): string {
  const inner = body
    .split(/\n{2,}/)
    .map((para) => `<p>${inlineFormat(para.replace(/\n/g, ' '))}</p>`)
    .join('')
  return `<div class="journal-callout journal-callout-${kind}">${inner}</div>`
}

function renderPullquote(body: string): string {
  return `<blockquote class="journal-pullquote">${inlineFormat(body.replace(/\n/g, ' '))}</blockquote>`
}

function renderToggle(header: string, body: string): string {
  const inner = body
    .split(/\n{2,}/)
    .map((para) => `<p>${inlineFormat(para.replace(/\n/g, ' '))}</p>`)
    .join('')
  return (
    `<details class="journal-toggle">` +
    `<summary class="journal-toggle-summary">${inlineFormat(header)}</summary>` +
    `<div class="journal-toggle-body">${inner}</div>` +
    `</details>`
  )
}

async function lookupPostlinkTitles(
  slugs: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (slugs.length === 0) return map
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return map
  }
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('journal_posts')
      .select('slug, title')
      .eq('is_published', true)
      .in('slug', slugs)
    for (const row of (data as { slug: string; title: string }[] | null) ??
      []) {
      map.set(row.slug, row.title)
    }
  } catch {
    // Fall through; missing entries render as broken-link <code>.
  }
  return map
}

interface PreparedBlocks {
  source: string
  blocks: string[]
}

async function extractBlockShortcodes(src: string): Promise<PreparedBlocks> {
  const blocks: string[] = []
  let work = src

  // :::tip / :::warning / :::note / :::danger
  work = await replaceAsync(
    work,
    /^:::(tip|warning|note|danger)\s*\n([\s\S]*?)\n:::\s*$/gm,
    async (_m, kind: string, body: string) => {
      const html = renderCallout(kind, body.trim())
      blocks.push(html)
      return placeholder(blocks.length - 1)
    },
  )

  // :::pullquote
  work = await replaceAsync(
    work,
    /^:::pullquote\s*\n([\s\S]*?)\n:::\s*$/gm,
    async (_m, body: string) => {
      const html = renderPullquote(body.trim())
      blocks.push(html)
      return placeholder(blocks.length - 1)
    },
  )

  // :::toggle Header  OR  :::toggle[Header]
  work = await replaceAsync(
    work,
    /^:::toggle(?:\[([^\]]+)\]|\s+([^\n]+))\s*\n([\s\S]*?)\n:::\s*$/gm,
    async (_m, bracket: string | undefined, spaced: string | undefined, body: string) => {
      const header = (bracket ?? spaced ?? '').trim()
      const html = renderToggle(header, body.trim())
      blocks.push(html)
      return placeholder(blocks.length - 1)
    },
  )

  // ::youtube[id]
  work = await replaceAsync(
    work,
    /^::youtube\[([A-Za-z0-9_-]{6,})\]\s*$/gm,
    async (_m, id: string) => {
      const html = renderYouTube(id)
      blocks.push(html)
      return placeholder(blocks.length - 1)
    },
  )

  // ::bookmark[url]
  work = await replaceAsync(
    work,
    /^::bookmark\[([^\]]+)\]\s*$/gm,
    async (_m, url: string) => {
      const html = await renderBookmark(url.trim())
      blocks.push(html)
      return placeholder(blocks.length - 1)
    },
  )

  return { source: work, blocks }
}

function placeholder(i: number): string {
  return `JOURNALBLOCK${i}END`
}

async function replaceAsync(
  src: string,
  pattern: RegExp,
  replacer: (...args: string[]) => Promise<string>,
): Promise<string> {
  const matches: Array<{
    start: number
    end: number
    args: string[]
  }> = []
  let m: RegExpExecArray | null
  pattern.lastIndex = 0
  while ((m = pattern.exec(src)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      args: m.slice(0) as string[],
    })
  }
  if (matches.length === 0) return src
  const parts: string[] = []
  let cursor = 0
  for (const match of matches) {
    parts.push(src.slice(cursor, match.start))
    parts.push(await replacer(...match.args))
    cursor = match.end
  }
  parts.push(src.slice(cursor))
  return parts.join('')
}

async function applyInlinePostlinks(html: string): Promise<string> {
  const slugs = new Set<string>()
  const re = /::postlink\[([a-z0-9-]+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    slugs.add(m[1])
  }
  if (slugs.size === 0) return html
  const titles = await lookupPostlinkTitles(Array.from(slugs))
  return html.replace(/::postlink\[([a-z0-9-]+)\]/g, (raw, slug: string) => {
    const title = titles.get(slug)
    if (!title) {
      return `<code>${escape(raw)}</code>`
    }
    return `<a href="/journal/${escapeAttr(slug)}" class="journal-postlink">${escape(title)}</a>`
  })
}

export async function renderJournalMarkdown(src: string): Promise<string> {
  if (!src || !src.trim()) return ''

  const prepared = await extractBlockShortcodes(src)
  const lines = prepared.source.split('\n')
  const out: string[] = []
  let inUl = false
  let inOl = false
  let inQuote = false
  let inFence = false
  let fenceBuf: string[] = []
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

    if (inFence) {
      if (/^```\s*$/.test(line)) {
        out.push(`<pre><code>${escape(fenceBuf.join('\n'))}</code></pre>`)
        fenceBuf = []
        inFence = false
      } else {
        fenceBuf.push(rawLine)
      }
      continue
    }

    if (/^```/.test(line)) {
      closeBlocks()
      inFence = true
      continue
    }

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

    const image = renderInlineImage(line)
    if (image) {
      closeBlocks()
      out.push(image)
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
  if (inFence) {
    out.push(`<pre><code>${escape(fenceBuf.join('\n'))}</code></pre>`)
  }

  let html = out.join('\n')
  // The placeholders were on their own lines, so the markdown loop
  // wrapped each in a paragraph. Strip the paragraph wrapper before
  // substituting back the block-level shortcode HTML.
  html = html.replace(
    /<p>JOURNALBLOCK(\d+)END<\/p>/g,
    (_m, n: string) => prepared.blocks[Number(n)] ?? '',
  )
  html = html.replace(
    /JOURNALBLOCK(\d+)END/g,
    (_m, n: string) => prepared.blocks[Number(n)] ?? '',
  )
  html = await applyInlinePostlinks(html)
  return html
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

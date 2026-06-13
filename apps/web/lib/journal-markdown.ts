import 'server-only'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { marked, type Tokens, type Token } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Server-side markdown renderer for journal posts.
 *
 * Standard markdown + GFM (tables, strikethrough) via `marked`, plus the
 * editor shortcodes: ::youtube, ::bookmark, ::postlink,
 * :::tip/warning/note/danger, :::pullquote, :::toggle, :::faq.
 *
 * Block shortcodes are extracted to placeholders before markdown runs and
 * stitched back after. Author-derived HTML is sanitized; the trusted
 * shortcode HTML is injected post-sanitize. Inline ::postlink is resolved
 * last against published posts.
 */

// ---- escaping ----------------------------------------------------------
function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Allowlist URL schemes for shortcode-supplied links (bookmarks). Markdown
// links/images are covered by the sanitizer; this guards the trusted
// bookmark path which bypasses it.
function safeHref(href: string): string | null {
  const t = href.trim()
  if (/^[/#?]/.test(t)) return t
  if (/^https?:\/\//i.test(t)) return t
  if (/^mailto:/i.test(t)) return t
  return null
}

// ---- heading ids (unchanged from prior impl so anchors stay stable) ----
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

// ---- marked config -----------------------------------------------------
type LinkRendererThis = { parser: { parseInline: (tokens: Token[]) => string } }
let configured = false
function configureMarked(): void {
  if (configured) return
  configured = true
  marked.use({
    async: false,
    gfm: true,
    breaks: false,
    renderer: {
      code({ text }: Tokens.Code): string {
        // Plain escaped code; this is a literature journal, no highlighting.
        return `<pre><code>${escape(text)}</code></pre>`
      },
      link({ href, title, tokens }: Tokens.Link): string {
        const self = this as unknown as LinkRendererThis
        const text = self.parser.parseInline(tokens)
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : ''
        const isExternal =
          /^https?:\/\//i.test(href) && !/(^|\.)foxing\.app($|\/|:)/i.test(href)
        const rel = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
        return `<a href="${escapeAttr(href)}"${titleAttr}${rel}>${text}</a>`
      },
    },
  })
}

// ---- sanitize (author body only) --------------------------------------
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote',
    'strong', 'em', 'b', 'i', 'del', 's', 'sup', 'sub',
    'code', 'pre', 'span',
    'a', 'img',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'loading', 'width', 'height'],
    th: ['colspan', 'rowspan', 'align', 'scope'],
    td: ['colspan', 'rowspan', 'align'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
}
function sanitizeBody(dirty: string): string {
  return sanitizeHtml(dirty, SANITIZE_OPTIONS)
}

// Render a chunk of author markdown to sanitized HTML (used for the main
// body and for callout/toggle/faq/pullquote inner content).
function renderInner(md: string): string {
  return sanitizeBody(marked.parse(md, { async: false }) as string)
}

// ---- block shortcode renderers ----------------------------------------
function renderCallout(kind: string, body: string): string {
  const known = ['tip', 'warning', 'note', 'danger']
  const k = known.includes(kind) ? kind : 'note'
  return `<div class="journal-callout journal-callout-${k}">${renderInner(body)}</div>`
}

function renderPullquote(body: string): string {
  return `<blockquote class="journal-pullquote">${renderInner(body)}</blockquote>`
}

function renderToggle(header: string, body: string): string {
  return (
    `<details class="journal-toggle">` +
    `<summary class="journal-toggle-summary">${escape(header.trim())}</summary>` +
    `<div class="journal-toggle-body">${renderInner(body)}</div>` +
    `</details>`
  )
}

interface FaqPair {
  q: string
  a: string
}
function parseFaqPairs(content: string): FaqPair[] {
  const pairs: FaqPair[] = []
  let q: string | null = null
  let a: string[] = []
  const flush = () => {
    if (q && a.length > 0) pairs.push({ q: q.trim(), a: a.join(' ').trim() })
    q = null
    a = []
  }
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('Q:')) {
      flush()
      q = line.slice(2).trim()
    } else if (line.startsWith('A:')) {
      a = [line.slice(2).trim()]
    } else if (line === '') {
      // ignore
    } else if (a.length > 0) {
      a.push(line)
    }
  }
  flush()
  return pairs
}
function renderFaq(body: string): string {
  const pairs = parseFaqPairs(body)
  if (pairs.length === 0) return ''
  const items = pairs
    .map(
      ({ q, a }) =>
        `<div class="journal-faq-item">` +
        `<dt class="journal-faq-question">${escape(q)}</dt>` +
        `<dd class="journal-faq-answer">${renderInner(a)}</dd>` +
        `</div>`,
    )
    .join('')
  return `<div class="journal-faq"><dl class="journal-faq-list">${items}</dl></div>`
}
// Raw-body FAQ extraction for FAQPage JSON-LD (decoupled from rendered HTML).
export function extractFaqPairs(
  src: string,
): Array<{ question: string; answer: string }> {
  const out: Array<{ question: string; answer: string }> = []
  const re = /^:::faq\s*\n([\s\S]*?)\n:::\s*$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    for (const p of parseFaqPairs(m[1])) {
      out.push({ question: p.q, answer: p.a })
    }
  }
  return out
}

function renderYouTube(videoId: string): string {
  const safe = escapeAttr(videoId)
  return (
    `<div class="journal-embed-youtube">` +
    `<iframe src="https://www.youtube-nocookie.com/embed/${safe}" ` +
    `title="YouTube video" ` +
    `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
    `allowfullscreen loading="lazy"></iframe>` +
    `</div>`
  )
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
// Reject private, loopback, link-local, ULA, CGNAT, and reserved ranges so a
// bookmark URL cannot reach internal services (SSRF). Accepts a literal IP.
function isPrivateIp(ip: string): boolean {
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip)
  if (v4) {
    const a = Number(v4[1])
    const b = Number(v4[2])
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true // link-local
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
    if (a >= 224) return true // multicast + reserved
    return false
  }
  const v6 = ip.toLowerCase()
  if (v6 === '::1' || v6 === '::') return true
  if (v6.startsWith('fe80')) return true // link-local
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true // unique-local
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6)
  if (mapped) return isPrivateIp(mapped[1])
  return false
}

// Resolve the host and confirm it (and every address it resolves to) is a
// public, routable destination before we fetch it server-side.
async function isPublicHost(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (!host) return false
  if (host === 'localhost' || host.endsWith('.localhost')) return false
  if (host.endsWith('.local') || host.endsWith('.internal')) return false
  if (isIP(host)) return !isPrivateIp(host)
  // Reject single-label hosts (e.g. intranet shortcuts) that aren't IPs.
  if (!host.includes('.')) return false
  try {
    const addresses = await lookup(host, { all: true })
    if (addresses.length === 0) return false
    return addresses.every((a) => !isPrivateIp(a.address))
  } catch {
    return false
  }
}

async function fetchBookmarkTitle(url: string): Promise<string | null> {
  try {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return null
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (!(await isPublicHost(parsed.hostname))) return null
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Foxing/1.0 (+https://foxing.app)' },
      next: { revalidate: 86400 },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const ctype = res.headers.get('content-type') ?? ''
    if (!/text\/html|application\/xhtml/.test(ctype)) return null
    const text = await res.text()
    const m =
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i.exec(text) ??
      /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text)
    return m ? m[1].replace(/\s+/g, ' ').trim() : null
  } catch {
    return null
  }
}
async function renderBookmark(url: string): Promise<string> {
  const safe = safeHref(url)
  if (!safe || !/^https?:\/\//i.test(safe)) {
    return `<p>${escape(url)}</p>`
  }
  const title = await fetchBookmarkTitle(safe)
  const href = escapeAttr(safe)
  const domain = escape(domainOf(safe))
  const label = escape(title ?? safe)
  return (
    `<a href="${href}" target="_blank" rel="noopener noreferrer" class="journal-bookmark">` +
    `<span class="journal-bookmark-domain">${domain}</span>` +
    `<span class="journal-bookmark-title">${label}</span>` +
    `</a>`
  )
}

// ---- placeholder plumbing ---------------------------------------------
function placeholder(i: number): string {
  return `JOURNALBLOCK${i}END`
}
async function replaceAsync(
  src: string,
  pattern: RegExp,
  replacer: (...args: string[]) => Promise<string>,
): Promise<string> {
  const matches: Array<{ start: number; end: number; args: string[] }> = []
  let m: RegExpExecArray | null
  pattern.lastIndex = 0
  while ((m = pattern.exec(src)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, args: m.slice(0) as string[] })
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

interface PreparedBlocks {
  source: string
  blocks: string[]
}
async function extractBlockShortcodes(src: string): Promise<PreparedBlocks> {
  const blocks: string[] = []
  let work = src

  work = await replaceAsync(
    work,
    /^:::(tip|warning|note|danger)\s*\n([\s\S]*?)\n:::\s*$/gm,
    async (_m, kind: string, body: string) => {
      blocks.push(renderCallout(kind, body.trim()))
      return placeholder(blocks.length - 1)
    },
  )
  work = await replaceAsync(
    work,
    /^:::pullquote\s*\n([\s\S]*?)\n:::\s*$/gm,
    async (_m, body: string) => {
      blocks.push(renderPullquote(body.trim()))
      return placeholder(blocks.length - 1)
    },
  )
  work = await replaceAsync(
    work,
    /^:::faq\s*\n([\s\S]*?)\n:::\s*$/gm,
    async (_m, body: string) => {
      blocks.push(renderFaq(body.trim()))
      return placeholder(blocks.length - 1)
    },
  )
  work = await replaceAsync(
    work,
    /^:::toggle(?:\[([^\]]+)\]|\s+([^\n]+))\s*\n([\s\S]*?)\n:::\s*$/gm,
    async (_m, bracket: string | undefined, spaced: string | undefined, body: string) => {
      blocks.push(renderToggle((bracket ?? spaced ?? '').trim(), body.trim()))
      return placeholder(blocks.length - 1)
    },
  )
  work = await replaceAsync(
    work,
    /^::youtube\[([A-Za-z0-9_-]{6,})\]\s*$/gm,
    async (_m, id: string) => {
      blocks.push(renderYouTube(id))
      return placeholder(blocks.length - 1)
    },
  )
  work = await replaceAsync(
    work,
    /^::bookmark\[([^\]]+)\]\s*$/gm,
    async (_m, url: string) => {
      blocks.push(await renderBookmark(url.trim()))
      return placeholder(blocks.length - 1)
    },
  )

  return { source: work, blocks }
}

async function applyInlinePostlinks(html: string): Promise<string> {
  const slugs = new Set<string>()
  const re = /::postlink\[([a-z0-9-]+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) slugs.add(m[1])
  if (slugs.size === 0) return html
  const titles = new Map<string, string>()
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    try {
      const admin = createAdminClient()
      const { data } = await admin
        .from('journal_posts')
        .select('slug, title')
        .eq('is_published', true)
        .in('slug', Array.from(slugs))
      for (const row of (data as { slug: string; title: string }[] | null) ?? []) {
        titles.set(row.slug, row.title)
      }
    } catch {
      // unresolved slugs render as <code> below
    }
  }
  return html.replace(/::postlink\[([a-z0-9-]+)\]/g, (raw, slug: string) => {
    const title = titles.get(slug)
    if (!title) return `<code>${escape(raw)}</code>`
    return `<a href="/journal/${escapeAttr(slug)}" class="journal-postlink">${escape(title)}</a>`
  })
}

function addHeadingIds(html: string): string {
  const used = new Map<string, number>()
  return html.replace(/<(h[1-6])>([\s\S]*?)<\/\1>/g, (_m, tag: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '').trim()
    const base = headingId(text) || 'section'
    const n = used.get(base) ?? 0
    used.set(base, n + 1)
    const id = n === 0 ? base : `${base}-${n + 1}`
    return `<${tag} id="${id}">${inner}</${tag}>`
  })
}

// ---- public entry points ----------------------------------------------
export async function renderJournalMarkdown(src: string): Promise<string> {
  if (!src || !src.trim()) return ''
  configureMarked()

  const prepared = await extractBlockShortcodes(src)
  // Author body -> HTML -> sanitize. Placeholders are plain text and survive.
  let html = sanitizeBody(marked.parse(prepared.source, { async: false }) as string)
  // Stitch trusted block HTML back (marked may have wrapped placeholders in <p>).
  html = html.replace(
    /<p>JOURNALBLOCK(\d+)END<\/p>/g,
    (_m, n: string) => prepared.blocks[Number(n)] ?? '',
  )
  html = html.replace(
    /JOURNALBLOCK(\d+)END/g,
    (_m, n: string) => prepared.blocks[Number(n)] ?? '',
  )
  html = await applyInlinePostlinks(html)
  html = addHeadingIds(html)
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

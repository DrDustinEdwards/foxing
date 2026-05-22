// In-process EPUB content extraction for the Readium reader.
//
// Readium's native renderer paints the book but exposes no JS API for
// chapter plain text or paragraph arrays. The TTS bar and bilingual mode
// both need that text, so we open the EPUB ourselves on the JS thread:
// download once (via the existing epub-cache utility), unzip it with
// jszip, parse the OPF manifest, and stream chapter HTML through a simple
// tag-stripper.
//
// Performance note: jszip parses the whole ZIP into an in-memory tree on
// open, ~30-80 ms for a 500 KB book. The opened archive is cached per
// EPUB URL so subsequent chapter reads are <5 ms. Memory pressure is the
// book's compressed bytes plus jszip's internal index, well under 5 MB
// for a typical Gutenberg classic.

import JSZip from 'jszip'
import * as FileSystem from 'expo-file-system/legacy'

import { ensureEpubLocallyCached } from '@/lib/epub-cache'

interface SpineItem {
  href: string
  mediaType: string
}

interface OpenedEpub {
  zip: JSZip
  // Absolute paths within the zip, in spine order. Used so we can resolve
  // relative chapter hrefs from any source (Readium Locator, TOC link).
  spine: SpineItem[]
  // Root directory of the OPF file. Chapter hrefs in the manifest are
  // relative to this path, not to the zip root.
  rootDir: string
}

const openCache = new Map<string, Promise<OpenedEpub>>()

async function readFileAsArrayBuffer(path: string): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(path, {
    encoding: FileSystem.EncodingType.Base64,
  })
  return base64ToArrayBuffer(base64)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = globalThis.atob ? globalThis.atob(base64) : decodeBase64Fallback(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function decodeBase64Fallback(input: string): string {
  // RN's Hermes ships atob in newer SDKs, but keep a fallback so this
  // module works in unit-test environments too.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
  const cleaned = input.replace(/[^A-Za-z0-9+/=]/g, '')
  let out = ''
  for (let i = 0; i < cleaned.length; ) {
    const c1 = chars.indexOf(cleaned.charAt(i++))
    const c2 = chars.indexOf(cleaned.charAt(i++))
    const c3 = chars.indexOf(cleaned.charAt(i++))
    const c4 = chars.indexOf(cleaned.charAt(i++))
    out += String.fromCharCode((c1 << 2) | (c2 >> 4))
    if (c3 !== 64) out += String.fromCharCode(((c2 & 15) << 4) | (c3 >> 2))
    if (c4 !== 64) out += String.fromCharCode(((c3 & 3) << 6) | c4)
  }
  return out
}

// Locate the OPF file via META-INF/container.xml. The path inside the zip
// can be anything (publishers vary); container.xml's <rootfile> element
// is the canonical pointer.
async function findOpfPath(zip: JSZip): Promise<string> {
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('container.xml not found')
  const containerXml = await containerFile.async('text')
  const match = /<rootfile[^>]+full-path="([^"]+)"/i.exec(containerXml)
  if (!match) throw new Error('rootfile path missing from container.xml')
  return match[1]
}

function dirname(path: string): string {
  const i = path.lastIndexOf('/')
  return i >= 0 ? path.slice(0, i + 1) : ''
}

function resolveRelative(rootDir: string, ref: string): string {
  if (ref.startsWith('/')) return ref.slice(1)
  // Strip any fragment (#chap1) before joining; the zip path doesn't carry it.
  const cleaned = ref.split('#')[0]
  return `${rootDir}${cleaned}`
}

// Minimal OPF spine parser. Pulls manifest items + spine itemref order +
// resolves item idrefs back to manifest hrefs. Doesn't try to validate the
// full OPF schema; just enough to enumerate chapter files in reading order.
function parseOpf(rootDir: string, opfXml: string): SpineItem[] {
  const manifest = new Map<string, { href: string; mediaType: string }>()
  const itemRegex = /<item\s+([^>]+?)\/?>/gi
  let m: RegExpExecArray | null
  while ((m = itemRegex.exec(opfXml)) !== null) {
    const attrs = m[1]
    const id = /id="([^"]+)"/i.exec(attrs)?.[1]
    const href = /href="([^"]+)"/i.exec(attrs)?.[1]
    const mt = /media-type="([^"]+)"/i.exec(attrs)?.[1] ?? ''
    if (id && href) manifest.set(id, { href: resolveRelative(rootDir, href), mediaType: mt })
  }

  const spine: SpineItem[] = []
  const itemrefRegex = /<itemref\s+([^>]+?)\/?>/gi
  while ((m = itemrefRegex.exec(opfXml)) !== null) {
    const idref = /idref="([^"]+)"/i.exec(m[1])?.[1]
    if (!idref) continue
    const item = manifest.get(idref)
    if (item) spine.push(item)
  }
  return spine
}

async function openEpub(remoteUrl: string): Promise<OpenedEpub> {
  const cached = openCache.get(remoteUrl)
  if (cached) return cached
  const promise = (async (): Promise<OpenedEpub> => {
    // Download into local cache (no-op on second call) and read the raw
    // bytes for jszip. ensureEpubLocallyCached returns base64 plus byte
    // count; we re-read the file as Base64 here to avoid keeping the
    // mb-scale string in memory twice.
    await ensureEpubLocallyCached(remoteUrl)
    const path = await resolveLocalEpubPath(remoteUrl)
    const buf = await readFileAsArrayBuffer(path)
    const zip = await JSZip.loadAsync(buf)
    const opfPath = await findOpfPath(zip)
    const rootDir = dirname(opfPath)
    const opfFile = zip.file(opfPath)
    if (!opfFile) throw new Error(`OPF not found at ${opfPath}`)
    const opfXml = await opfFile.async('text')
    const spine = parseOpf(rootDir, opfXml)
    return { zip, spine, rootDir }
  })()
  openCache.set(remoteUrl, promise)
  // If parsing fails, drop the cached promise so the next caller can retry.
  promise.catch(() => openCache.delete(remoteUrl))
  return promise
}

// The cache module hashes the URL into a stable filename; we don't export
// that hash, so we have to mirror the layout here to reconstruct the path.
// Keep these two in sync if epub-cache changes its naming scheme.
function cacheKey(remoteUrl: string): string {
  let a = 0x811c9dc5
  let b = 0x84222325
  for (let i = 0; i < remoteUrl.length; i++) {
    const c = remoteUrl.charCodeAt(i)
    a ^= c
    a = Math.imul(a, 0x01000193)
    b ^= c
    b = Math.imul(b, 0x05f5e101)
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
  return `${hex(a)}${hex(b)}`
}

async function resolveLocalEpubPath(remoteUrl: string): Promise<string> {
  return `${FileSystem.documentDirectory}epubs/${cacheKey(remoteUrl)}.epub`
}

// HTML to plain text. Drops <script> + <style> blocks entirely, then strips
// remaining tags. Block-level elements get a trailing newline so paragraph
// boundaries survive into the text output, the sentence splitter in TtsBar
// then divides those into individual utterances.
function htmlToText(html: string): string {
  const noScript = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  const withBreaks = noScript
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr|br)>/gi, '$&\n')
    .replace(/<br\s*\/?>/gi, '\n')
  const stripped = withBreaks.replace(/<[^>]+>/g, '')
  return decodeEntities(stripped)
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function htmlToParagraphs(html: string): string[] {
  const noScript = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  // Capture content between block-level openers/closers; matches paragraphs,
  // headings, blockquotes, list items. Falls back to splitting on double
  // newline if no block tags exist (raw text manifests).
  const blocks: string[] = []
  const blockRegex = /<(?:p|div|li|h[1-6]|blockquote|pre)\b[^>]*>([\s\S]*?)<\/(?:p|div|li|h[1-6]|blockquote|pre)>/gi
  let m: RegExpExecArray | null
  while ((m = blockRegex.exec(noScript)) !== null) {
    const text = decodeEntities(m[1].replace(/<[^>]+>/g, ''))
      .replace(/\s+/g, ' ')
      .trim()
    if (text) blocks.push(text)
  }
  if (blocks.length > 0) return blocks
  return htmlToText(html)
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  hellip: '...',
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, ent: string) => {
    if (ent.startsWith('#x') || ent.startsWith('#X')) {
      return String.fromCodePoint(parseInt(ent.slice(2), 16))
    }
    if (ent.startsWith('#')) return String.fromCodePoint(parseInt(ent.slice(1), 10))
    return NAMED_ENTITIES[ent.toLowerCase()] ?? ` `
  })
}

// Resolve a Readium Locator.href (or a TOC link href, or a raw spine path)
// against the EPUB's spine. Returns the absolute zip path of the chapter's
// HTML file, or null if no match.
function resolveChapterPath(opened: OpenedEpub, hrefOrPath: string): string | null {
  const cleaned = hrefOrPath.split('#')[0]
  if (!cleaned) return null
  // Match by suffix so callers can pass either the absolute spine path or
  // the relative href (sometimes Readium strips the leading rootDir).
  for (const item of opened.spine) {
    if (item.href === cleaned) return item.href
    if (item.href.endsWith(cleaned)) return item.href
    if (cleaned.endsWith(item.href)) return item.href
  }
  // Fallback: try a direct zip lookup (last-ditch for unusual hrefs).
  if (opened.zip.file(cleaned)) return cleaned
  return null
}

export interface ChapterContent {
  text: string
  paragraphs: string[]
}

export async function getChapterContent(
  remoteUrl: string,
  chapterHrefOrLocator: string,
): Promise<ChapterContent> {
  const opened = await openEpub(remoteUrl)
  const path = resolveChapterPath(opened, chapterHrefOrLocator)
  if (!path) return { text: '', paragraphs: [] }
  const file = opened.zip.file(path)
  if (!file) return { text: '', paragraphs: [] }
  const html = await file.async('text')
  return {
    text: htmlToText(html),
    paragraphs: htmlToParagraphs(html),
  }
}

// Convenience: when no specific chapter is named, return the first spine
// item's content. Used as a sane default for "open TTS without first
// turning a page" cases.
export async function getFirstChapterContent(
  remoteUrl: string,
): Promise<ChapterContent> {
  const opened = await openEpub(remoteUrl)
  const first = opened.spine[0]
  if (!first) return { text: '', paragraphs: [] }
  return getChapterContent(remoteUrl, first.href)
}

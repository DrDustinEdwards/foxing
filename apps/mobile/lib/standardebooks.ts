const STANDARD_EBOOKS_OPDS = 'https://standardebooks.org/opds'

export interface StandardEbook {
  title: string
  author: string
  epubUrl: string | null
  coverUrl: string | null
  url: string
}

export async function searchStandardEbooks(query: string): Promise<StandardEbook[]> {
  try {
    const url = `${STANDARD_EBOOKS_OPDS}/all?query=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: { Accept: 'application/atom+xml' },
    })
    const text = await response.text()
    return parseOpdsFeed(text)
  } catch {
    return []
  }
}

function parseOpdsFeed(xml: string): StandardEbook[] {
  const entries: StandardEbook[] = []
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match: RegExpExecArray | null
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1]
    const title = extract(entry, /<title>([\s\S]*?)<\/title>/)
    const author = extract(entry, /<author>[\s\S]*?<name>([\s\S]*?)<\/name>/)
    const epubUrl = extractAttr(entry, /<link[^>]+type="application\/epub\+zip"[^>]+href="([^"]+)"/)
    const coverUrl = extractAttr(entry, /<link[^>]+rel="http:\/\/opds-spec\.org\/image"[^>]+href="([^"]+)"/)
    const pageUrl = extractAttr(entry, /<link[^>]+rel="alternate"[^>]+href="([^"]+)"/) ?? ''
    if (title) {
      entries.push({
        title,
        author: author ?? 'Unknown',
        epubUrl: epubUrl ? `https://standardebooks.org${epubUrl}` : null,
        coverUrl: coverUrl ? `https://standardebooks.org${coverUrl}` : null,
        url: pageUrl ? `https://standardebooks.org${pageUrl}` : '',
      })
    }
  }
  return entries
}

function extract(src: string, re: RegExp): string | null {
  const m = src.match(re)
  return m ? m[1].trim() : null
}

function extractAttr(src: string, re: RegExp): string | null {
  const m = src.match(re)
  return m ? m[1] : null
}

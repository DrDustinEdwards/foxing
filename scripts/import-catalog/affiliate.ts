// Strips affiliate tracking parameters from Amazon and Bookshop.org URLs.

const AMAZON_STRIP = new Set(['tag', 'linkCode', 'camp', 'creative', 'creativeASIN'])
const BOOKSHOP_STRIP = new Set(['a_aid', 'a_bid'])

// Bookshop affiliate path pattern: /a/{affiliate_id}/{isbn}
const BOOKSHOP_AFFILIATE_PATH = /^\/a\/[^/]+\/(\d{10,13})$/

export function stripAffiliateParams(url: string | null): string | null {
  if (!url) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return url
  }

  if (u.hostname.endsWith('amazon.com') || u.hostname.endsWith('amazon.co.uk')) {
    let changed = false
    for (const p of AMAZON_STRIP) {
      if (u.searchParams.has(p)) {
        u.searchParams.delete(p)
        changed = true
      }
    }
    if (!changed) return url
    const s = u.toString()
    return s.endsWith('?') ? s.slice(0, -1) : s
  }

  if (u.hostname.endsWith('bookshop.org')) {
    const m = u.pathname.match(BOOKSHOP_AFFILIATE_PATH)
    if (m) {
      return `https://bookshop.org/p/books/${m[1]}`
    }
    let changed = false
    for (const p of BOOKSHOP_STRIP) {
      if (u.searchParams.has(p)) {
        u.searchParams.delete(p)
        changed = true
      }
    }
    if (!changed) return url
    const s = u.toString()
    return s.endsWith('?') ? s.slice(0, -1) : s
  }

  return url
}

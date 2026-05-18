/**
 * Affiliate URL builders. Bookshop.org is preferred (10% commission and
 * an independent-bookstore brand fit). Amazon is the fallback for titles
 * not stocked by Bookshop. WorldCat covers the library angle and earns
 * nothing but signals that we are not pushing one purchase path.
 *
 * The env vars are public because they are the affiliate identifiers
 * themselves and they ship in every outbound URL anyway.
 */

function cleanIsbn(isbn: string): string {
  return isbn.replace(/[^0-9Xx]/g, '')
}

export function amazonUrl(
  isbn10: string | null | undefined,
): string | null {
  if (!isbn10) return null
  const id = cleanIsbn(isbn10)
  if (!id) return null
  const tag = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG
  return tag
    ? `https://www.amazon.com/dp/${id}?tag=${tag}`
    : `https://www.amazon.com/dp/${id}`
}

export function amazonSearchUrl(title: string, author: string): string {
  const tag = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG
  const params = new URLSearchParams({
    k: `${title} ${author}`,
    i: 'stripbooks',
  })
  if (tag) params.set('tag', tag)
  return `https://www.amazon.com/s?${params.toString()}`
}

export function bookshopUrl(
  isbn13: string | null | undefined,
  fallbackUrl?: string | null,
): string | null {
  if (!isbn13 && !fallbackUrl) return null
  const id = process.env.NEXT_PUBLIC_BOOKSHOP_AFFILIATE_ID
  if (isbn13) {
    const cleaned = cleanIsbn(isbn13)
    return id
      ? `https://bookshop.org/a/${id}/${cleaned}`
      : (fallbackUrl ?? `https://bookshop.org/isbn/${cleaned}`)
  }
  return fallbackUrl ?? null
}

export function bookshopSearchUrl(title: string, author: string): string {
  const q = encodeURIComponent(`${title} ${author}`.trim())
  return `https://bookshop.org/search?keywords=${q}`
}

export function worldcatBookUrl(title: string, author: string): string {
  const q = encodeURIComponent(`${title} ${author}`.trim())
  return `https://www.worldcat.org/search?q=${q}`
}

export function ebookSearchUrl(title: string, author: string): string {
  const q = encodeURIComponent(`${title} ${author} kindle kobo apple books`)
  return `https://www.google.com/search?q=${q}`
}

export interface AffiliateBook {
  title: string
  author: string
  isbn?: string | null
  isbn13?: string | null
  amazon_url?: string | null
  bookshop_url?: string | null
}

export interface ResolvedAffiliateLinks {
  bookshop: string
  amazon: string
  worldcat: string
  ebookSearch: string
  hasIsbn: boolean
}

/**
 * Build the four purchase channels for a book. ISBN-based affiliate URLs
 * take priority over any per-row override stored in the DB, so the affiliate
 * tag is always credited. Per-row overrides remain as a fallback when no
 * ISBN is recorded; search URLs are the final fallback.
 */
export function resolveAffiliateLinks(
  book: AffiliateBook,
): ResolvedAffiliateLinks {
  const isbn13 = book.isbn13 ?? null
  const isbn10 = book.isbn ?? null
  return {
    bookshop:
      bookshopUrl(isbn13, book.bookshop_url) ??
      bookshopSearchUrl(book.title, book.author),
    amazon:
      amazonUrl(isbn10) ??
      book.amazon_url ??
      amazonSearchUrl(book.title, book.author),
    worldcat: worldcatBookUrl(book.title, book.author),
    ebookSearch: ebookSearchUrl(book.title, book.author),
    hasIsbn: Boolean(isbn13 ?? isbn10),
  }
}

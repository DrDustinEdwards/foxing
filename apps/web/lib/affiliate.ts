/**
 * Affiliate URL builders. Bookshop.org is preferred (10% commission and
 * an independent-bookstore brand fit). Amazon is the fallback for titles
 * not stocked by Bookshop. WorldCat covers the library angle and earns
 * nothing but signals that we are not pushing one purchase path.
 *
 * The env vars are public because they are the affiliate identifiers
 * themselves and they ship in every outbound URL anyway.
 */

const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG ?? ''
const BOOKSHOP_ID = process.env.NEXT_PUBLIC_BOOKSHOP_AFFILIATE_ID ?? ''

function cleanIsbn(isbn: string): string {
  return isbn.replace(/[^0-9Xx]/g, '')
}

export function amazonBookUrl(isbnOrAsin: string): string {
  const id = cleanIsbn(isbnOrAsin)
  const base = `https://www.amazon.com/dp/${id}`
  return AMAZON_TAG ? `${base}?tag=${AMAZON_TAG}` : base
}

export function amazonSearchUrl(title: string, author: string): string {
  const params = new URLSearchParams({ k: `${title} ${author}`, i: 'stripbooks' })
  if (AMAZON_TAG) params.set('tag', AMAZON_TAG)
  return `https://www.amazon.com/s?${params.toString()}`
}

export function bookshopBookUrl(isbn: string): string {
  const id = cleanIsbn(isbn)
  if (!BOOKSHOP_ID) return `https://bookshop.org/book/${id}`
  return `https://bookshop.org/a/${BOOKSHOP_ID}/${id}`
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

/**
 * Resolve the best available URL for each purchase channel. An admin
 * override on the book row wins; otherwise we build an affiliate link
 * from the ISBN; otherwise we fall back to a search.
 */
export interface ResolvedAffiliateLinks {
  bookshop: string
  amazon: string
  worldcat: string
  ebookSearch: string
  hasIsbn: boolean
}

export function resolveAffiliateLinks(
  book: AffiliateBook,
): ResolvedAffiliateLinks {
  const isbn = book.isbn13 ?? book.isbn ?? null
  return {
    bookshop:
      book.bookshop_url ??
      (isbn ? bookshopBookUrl(isbn) : bookshopSearchUrl(book.title, book.author)),
    amazon:
      book.amazon_url ??
      (isbn ? amazonBookUrl(isbn) : amazonSearchUrl(book.title, book.author)),
    worldcat: worldcatBookUrl(book.title, book.author),
    ebookSearch: ebookSearchUrl(book.title, book.author),
    hasIsbn: Boolean(isbn),
  }
}

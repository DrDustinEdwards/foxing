const GUTENDEX_BASE = 'https://gutendex.com/books'

export interface GutenbergBook {
  id: number
  title: string
  authors: Array<{ name: string; birth_year: number | null; death_year: number | null }>
  subjects: string[]
  languages: string[]
  download_count: number
  formats: Record<string, string>
}

export interface GutenbergResponse {
  count: number
  next: string | null
  previous: string | null
  results: GutenbergBook[]
}

export async function searchBooks(query: string, page = 1): Promise<GutenbergResponse> {
  const url = `${GUTENDEX_BASE}/?search=${encodeURIComponent(query)}&page=${page}`
  const response = await fetch(url)
  return response.json()
}

export async function getBooksBySubject(subject: string, page = 1): Promise<GutenbergResponse> {
  const url = `${GUTENDEX_BASE}/?topic=${encodeURIComponent(subject)}&page=${page}`
  const response = await fetch(url)
  return response.json()
}

export async function getPopularBooks(page = 1): Promise<GutenbergResponse> {
  const url = `${GUTENDEX_BASE}/?sort=popular&page=${page}`
  const response = await fetch(url)
  return response.json()
}

export async function getBook(id: number): Promise<GutenbergBook> {
  const url = `${GUTENDEX_BASE}/${id}`
  const response = await fetch(url)
  return response.json()
}

function toHttps(url: string | null | undefined): string | null {
  if (!url) return null
  return url.replace(/^http:\/\/www\.gutenberg\.org/i, 'https://www.gutenberg.org')
            .replace(/^http:\/\//i, 'https://')
}

// Used internally by lib/storage.ts to seed a per-book copy into Supabase
// Storage. UI code should never call this directly — read the Supabase
// Storage URL off the books table instead.
export function getEpubUrl(book: Pick<GutenbergBook, 'id'>): string {
  return `https://aleph.pglaf.org/cache/epub/${book.id}/pg${book.id}.epub`
}

export function getCoverUrl(book: GutenbergBook): string | null {
  // Defensive: if a non-Gutendex object lands here (e.g. Gutendex 404 returns
  // {detail: "Not found."}), formats is undefined and the bracket access
  // throws. Returning null lets the UI fall back to a placeholder.
  return toHttps(book?.formats?.['image/jpeg'] || null)
}

export function getAuthorName(book: GutenbergBook): string {
  if (book.authors.length === 0) return 'Unknown Author'
  return book.authors[0].name
}

export function getAuthorEra(book: GutenbergBook): string {
  const author = book.authors[0]
  if (!author) return 'Unknown era'
  if (author.death_year) return `${author.death_year}`
  if (author.birth_year) return `b. ${author.birth_year}`
  return 'Unknown era'
}

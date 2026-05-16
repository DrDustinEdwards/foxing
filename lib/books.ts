// Book source preference + cross-edition matching.
//
// Standard Ebooks editions are hand-tuned for typography and readability,
// so we always render that version when one exists — even if the user
// opened the Gutenberg row from their library. The user's progress,
// highlights, and vocabulary stay keyed to whichever book.id they tapped
// (so their library doesn't lose history); only the EPUB BYTES come from
// the SE row.
//
// Matching is fuzzy because Gutenberg and SE format titles + authors
// differently:
//   Gutenberg: "Frankenstein; or, the modern prometheus"
//              "Shelley, Mary Wollstonecraft"
//   SE:        "Frankenstein"
//              "Mary Shelley"

import { supabase } from './supabase'

export interface BookLike {
  id: string
  title: string
  author: string
  source: string
  epub_url: string
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    // Strip subtitle: "Frankenstein; or, the modern prometheus" → "frankenstein"
    .split(/[;:]/)[0]
    // Strip leading article so "The Adventures of X" matches "Adventures of X"
    .replace(/^\s*(the|a|an)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function authorSurname(s: string): string {
  const t = s.toLowerCase().trim()
  if (!t) return ''
  // "Shelley, Mary Wollstonecraft" → "shelley"
  if (t.includes(',')) return t.split(',')[0].trim()
  // "Mary Shelley" → "shelley" (last whitespace-separated token)
  const parts = t.split(/\s+/)
  return parts[parts.length - 1]
}

// Returns the URL of the Standard Ebooks edition if one exists for this
// book; otherwise returns the book's own epub_url. Safe for any source
// (SE input returns its own URL without a roundtrip).
export async function resolvePreferredEpubUrl(book: BookLike): Promise<string> {
  if (book.source === 'standard_ebooks') return book.epub_url

  const normTitle = normalizeTitle(book.title)
  const normSurname = authorSurname(book.author)
  if (!normTitle || !normSurname) return book.epub_url

  // Pull candidate SE rows in one query. Catalog is ~1.4k SE books max,
  // so the round-trip is small and we filter client-side for the title
  // normalization that's hard to express in SQL.
  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, epub_url')
    .eq('source', 'standard_ebooks')
  if (error || !data) return book.epub_url

  for (const candidate of data) {
    if (
      normalizeTitle(candidate.title) === normTitle &&
      authorSurname(candidate.author) === normSurname
    ) {
      console.log('[books] preferred SE edition', {
        from: book.epub_url,
        to: candidate.epub_url,
        candidateId: candidate.id,
      })
      return candidate.epub_url
    }
  }
  return book.epub_url
}

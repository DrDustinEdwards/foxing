/**
 * Client-safe journal exports. Lives outside lib/journal.ts (which is
 * 'server-only') so the admin editor and other client components can
 * import JOURNAL_TAGS, types, and pure formatters without dragging the
 * server-only marker into the browser bundle.
 *
 * The server-side query layer in lib/journal.ts re-exports these so
 * existing server callers keep their existing import path.
 */

export const JOURNAL_TAGS = [
  {
    slug: 'reading-guides',
    label: 'Reading Guides',
    description:
      'Long-form guides for finishing the books most readers stall on.',
  },
  {
    slug: 'book-picks',
    label: 'Book Picks',
    description:
      'Curated lists pulled from what Foxing readers actually finish.',
  },
  {
    slug: 'author-spotlights',
    label: 'Author Spotlights',
    description:
      'Where to start with a writer, and what to read once you are hooked.',
  },
  {
    slug: 'book-analysis',
    label: 'Book Analysis',
    description:
      'Close reads of specific books, with the structure and craft notes.',
  },
  {
    slug: 'book-clubs',
    label: 'Book Clubs',
    description:
      'Reading together: club mechanics, group reads, and what works.',
  },
] as const

export type JournalPost = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: string
  cover_image_url: string | null
  is_published: boolean
  published_at: string | null
  tags: string[]
  featured: boolean
  og_title: string | null
  og_description: string | null
  canonical_url: string | null
  created_at: string
  updated_at: string
}

export type JournalPostSummary = Omit<JournalPost, 'content'>

// Backward-compatible alias for older imports.
export type JournalPostFull = JournalPost

export function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

export function readingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export function formatLongDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

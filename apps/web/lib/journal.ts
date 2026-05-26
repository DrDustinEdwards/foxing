import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Server-side journal fetchers. Reads journal_posts directly, filtered to
 * is_published=true. RLS already gates non-published rows for anonymous
 * visitors, but we filter explicitly to stay defensive.
 */

export const JOURNAL_TAGS = [
  { slug: 'reading-guides', label: 'Reading Guides' },
  { slug: 'book-picks', label: 'Book Picks' },
  { slug: 'author-spotlights', label: 'Author Spotlights' },
  { slug: 'classics-explained', label: 'Classics Explained' },
  { slug: 'community', label: 'Community' },
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

const SUMMARY_COLS =
  'id, slug, title, excerpt, cover_image_url, is_published, published_at, tags, featured, og_title, og_description, canonical_url, created_at, updated_at'

const FULL_COLS = `${SUMMARY_COLS}, content`

function hasEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

function normalizeSummary(row: Record<string, unknown>): JournalPostSummary {
  return { ...(row as JournalPostSummary), tags: (row.tags as string[] | null) ?? [] }
}

function normalizeFull(row: Record<string, unknown>): JournalPost {
  return { ...(row as JournalPost), tags: (row.tags as string[] | null) ?? [] }
}

// New API per spec.

export async function getJournalPosts(
  limit?: number,
): Promise<JournalPostSummary[]> {
  if (!hasEnv()) return []
  const supabase = await createClient()
  const base = supabase
    .from('journal_posts')
    .select(SUMMARY_COLS)
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
  const query = typeof limit === 'number' ? base.limit(limit) : base
  const { data } = await query
  return ((data as Record<string, unknown>[] | null) ?? []).map(normalizeSummary)
}

export async function getFeaturedJournalPost(): Promise<JournalPostSummary | null> {
  if (!hasEnv()) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('journal_posts')
    .select(SUMMARY_COLS)
    .eq('is_published', true)
    .eq('featured', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return normalizeSummary(data as Record<string, unknown>)
}

export async function getJournalPost(slug: string): Promise<JournalPost | null> {
  if (!hasEnv()) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('journal_posts')
    .select(FULL_COLS)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()
  if (!data) return null
  return normalizeFull(data as Record<string, unknown>)
}

export async function getAdjacentJournalPosts(
  publishedAt: string,
  id: string,
): Promise<{
  prev: JournalPostSummary | null
  next: JournalPostSummary | null
}> {
  if (!hasEnv()) return { prev: null, next: null }
  const supabase = await createClient()
  const { data: prevData } = await supabase
    .from('journal_posts')
    .select(SUMMARY_COLS)
    .eq('is_published', true)
    .or(
      `published_at.lt.${publishedAt},and(published_at.eq.${publishedAt},id.lt.${id})`,
    )
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data: nextData } = await supabase
    .from('journal_posts')
    .select(SUMMARY_COLS)
    .eq('is_published', true)
    .or(
      `published_at.gt.${publishedAt},and(published_at.eq.${publishedAt},id.gt.${id})`,
    )
    .order('published_at', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()
  return {
    prev: prevData ? normalizeSummary(prevData as Record<string, unknown>) : null,
    next: nextData ? normalizeSummary(nextData as Record<string, unknown>) : null,
  }
}

// Reading time helpers.

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

// Legacy wrappers preserved for existing callers; they share the same shape
// as the new API and will be removed once all callers migrate.

export async function fetchPublishedJournalPosts(
  limit = 24,
): Promise<JournalPostSummary[]> {
  return getJournalPosts(limit)
}

export async function fetchJournalPostBySlug(
  slug: string,
): Promise<JournalPost | null> {
  return getJournalPost(slug)
}

export async function fetchAllJournalSlugs(): Promise<string[]> {
  if (!hasEnv()) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('journal_posts')
    .select('slug')
    .eq('is_published', true)
  return ((data as { slug: string }[] | null) ?? []).map((r) => r.slug)
}

export async function fetchRelatedPosts(
  slug: string,
  tags: string[],
  limit = 3,
): Promise<JournalPostSummary[]> {
  if (!hasEnv() || tags.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('journal_posts')
    .select(SUMMARY_COLS)
    .eq('is_published', true)
    .neq('slug', slug)
    .overlaps('tags', tags)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  return ((data as Record<string, unknown>[] | null) ?? []).map(normalizeSummary)
}

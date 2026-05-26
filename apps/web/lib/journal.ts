import 'server-only'
import { createClient } from '@/lib/supabase/server'
import {
  type JournalPost,
  type JournalPostSummary,
} from '@/lib/journal-shared'

/**
 * Server-side journal fetchers. Reads journal_posts directly, filtered to
 * is_published=true. RLS already gates non-published rows for anonymous
 * visitors, but we filter explicitly to stay defensive.
 *
 * Shared constants, types, and pure formatters live in journal-shared.ts
 * (no 'server-only' marker) so client components can use them without
 * the build refusing to bundle this module. We re-export them here so
 * existing server callers keep their import path.
 */

export {
  JOURNAL_TAGS,
  estimateReadingTime,
  readingMinutes,
  formatLongDate,
  type JournalPost,
  type JournalPostSummary,
  type JournalPostFull,
} from '@/lib/journal-shared'

const SUMMARY_COLS =
  'id, slug, title, excerpt, cover_image_url, is_published, published_at, tags, featured, og_title, og_description, canonical_url, reading_time_minutes, created_at, updated_at'

const FULL_COLS = `${SUMMARY_COLS}, content`

function hasEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

function normalizeSummary(row: Record<string, unknown>): JournalPostSummary {
  return {
    ...(row as JournalPostSummary),
    tags: (row.tags as string[] | null) ?? [],
  }
}

function normalizeFull(row: Record<string, unknown>): JournalPost {
  return {
    ...(row as JournalPost),
    tags: (row.tags as string[] | null) ?? [],
  }
}

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
  return ((data as Record<string, unknown>[] | null) ?? []).map(
    normalizeSummary,
  )
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
    prev: prevData
      ? normalizeSummary(prevData as Record<string, unknown>)
      : null,
    next: nextData
      ? normalizeSummary(nextData as Record<string, unknown>)
      : null,
  }
}

// Legacy wrappers preserved for existing callers.

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
  return ((data as Record<string, unknown>[] | null) ?? []).map(
    normalizeSummary,
  )
}

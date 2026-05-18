import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Server-side journal fetchers. Reads the journal_posts table directly,
 * filtered to is_published=true. RLS already gates non-published rows
 * for anonymous visitors, but we explicitly filter to be defensive.
 */

export interface JournalPostSummary {
  id: string
  title: string
  slug: string
  excerpt: string | null
  cover_image_url: string | null
  tags: string[] | null
  published_at: string | null
  created_at: string
}

export interface JournalPostFull extends JournalPostSummary {
  content: string
  updated_at: string
  author_id: string | null
}

function sb() {
  return createClient()
}

function hasEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

const SUMMARY_COLS =
  'id, title, slug, excerpt, cover_image_url, tags, published_at, created_at'

const FULL_COLS = `${SUMMARY_COLS}, content, updated_at, author_id`

export async function fetchPublishedJournalPosts(
  limit = 24,
): Promise<JournalPostSummary[]> {
  if (!hasEnv()) return []
  const { data } = await sb()
    .from('journal_posts')
    .select(SUMMARY_COLS)
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data as JournalPostSummary[] | null) ?? []
}

export async function fetchJournalPostBySlug(
  slug: string,
): Promise<JournalPostFull | null> {
  if (!hasEnv()) return null
  const { data } = await sb()
    .from('journal_posts')
    .select(FULL_COLS)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()
  return (data as JournalPostFull | null) ?? null
}

export async function fetchAllJournalSlugs(): Promise<string[]> {
  if (!hasEnv()) return []
  const { data } = await sb()
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
  const { data } = await sb()
    .from('journal_posts')
    .select(SUMMARY_COLS)
    .eq('is_published', true)
    .neq('slug', slug)
    .overlaps('tags', tags)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data as JournalPostSummary[] | null) ?? []
}

/**
 * Rough reading time in minutes. 200 wpm, 1 minute floor.
 */
export function readingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

/**
 * ISO date to "May 17, 2026". UTC to stay stable across server zones.
 */
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

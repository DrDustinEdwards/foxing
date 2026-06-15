import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { ERAS } from '@/lib/foxing'
import { ERA_RANGES } from './adapters'
import type { EraBucket } from './types'
import type { FacetOption } from './filter-config'

// Era facet on /book-clubs/picks is data-driven: it appears only once the catalog
// backfill has populated enough book.publication_year. Thresholds below define
// "meaningful coverage" so the control is never an all-empty / single-bucket stub.
const ERA_FACET_MIN_PICKS = 10 // picks (with any year) before the facet earns a slot
const ERA_FACET_MIN_BUCKETS = 2 // must span >1 era bucket, else not a useful filter

/**
 * Distinct values for an array/tag column, ranked by frequency, for building a
 * facet's options from real data (no fabricated taxonomy). Used for club
 * genre_tags and journal tags. Runs as the viewer (RLS).
 */
export async function fetchTagFacetOptions(
  table: string,
  column: string,
  opts?: { limit?: number; scan?: number },
): Promise<FacetOption[]> {
  const limit = opts?.limit ?? 24
  const scan = opts?.scan ?? 500
  const supabase = await createClient()
  const { data } = await supabase
    .from(table)
    .select(column)
    .not(column, 'is', null)
    .limit(scan)

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const tags = row[column]
    if (!Array.isArray(tags)) continue
    for (const t of tags) {
      if (typeof t === 'string' && t) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => ({ value, label: value }))
}

/** Public-club genre_tags as facet options (empty array hides the facet). */
export async function fetchClubGenreOptions(): Promise<FacetOption[]> {
  return fetchTagFacetOptions('clubs', 'genre_tags')
}

/** Distinct pick years (newest first) for the /book-clubs/picks year facet. */
export async function fetchPickYearOptions(): Promise<FacetOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('external_book_club_picks')
    .select('pick_year')
    .eq('is_published', true)
    .not('pick_year', 'is', null)

  const years = new Set<number>()
  for (const row of (data ?? []) as { pick_year: number | null }[]) {
    if (typeof row.pick_year === 'number') years.add(row.pick_year)
  }
  return [...years]
    .sort((a, b) => b - a)
    .map((y) => ({ value: String(y), label: String(y) }))
}

/**
 * Era options for the picks facet, derived from real data. Returns the populated
 * era buckets ONLY when coverage is meaningful (>= ERA_FACET_MIN_PICKS picks with
 * a year, spanning >= ERA_FACET_MIN_BUCKETS buckets); otherwise [] so the page
 * omits the era facet entirely. Before the catalog backfill almost no pick-book
 * has a publication_year (and the few are post-2000, outside every bucket), so
 * this returns [] today and auto-populates once publication_year is filled.
 */
export async function fetchPickEraOptions(): Promise<FacetOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('external_book_club_picks')
    .select('book:book_id(publication_year)')
    .eq('is_published', true)
    .limit(1000)

  const counts = new Map<string, number>()
  let withYear = 0
  for (const row of (data ?? []) as Array<{ book: unknown }>) {
    const book = Array.isArray(row.book) ? row.book[0] : row.book
    const y = (book as { publication_year?: number | null } | null)?.publication_year
    if (typeof y !== 'number') continue
    withYear++
    for (const e of ERAS) {
      const range = ERA_RANGES[e.value as EraBucket]
      if (
        (range.min == null || y >= range.min) &&
        (range.max == null || y <= range.max)
      ) {
        counts.set(e.value, (counts.get(e.value) ?? 0) + 1)
        break
      }
    }
  }

  const populated = ERAS.filter((e) => (counts.get(e.value) ?? 0) > 0)
  if (withYear < ERA_FACET_MIN_PICKS || populated.length < ERA_FACET_MIN_BUCKETS) {
    return []
  }
  return populated.map((e) => ({ value: e.value, label: e.label }))
}

/** External book clubs (those with published picks) for the club facet. */
export async function fetchPickClubOptions(): Promise<FacetOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('external_book_clubs')
    .select('id, name, short_name, sort_order')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  return ((data ?? []) as {
    id: string
    name: string | null
    short_name: string | null
  }[]).map((c) => ({
    value: c.id,
    label: c.name || c.short_name || c.id,
  }))
}

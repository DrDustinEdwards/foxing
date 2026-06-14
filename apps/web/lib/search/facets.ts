import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { FacetOption } from './filter-config'

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

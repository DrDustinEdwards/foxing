// Popular highlights, aggregates other readers' highlights by CFI so the
// reader can render a small "X readers highlighted this" label beneath
// commonly-marked paragraphs. Cheap enough for moderate catalogs; if the
// highlights table grows hot we'd switch to a materialized view.

import { supabase } from './supabase'

export interface PopularHighlight {
  cfi: string
  count: number
}

// Returns CFIs with >= minCount highlights from readers other than the
// viewer. Sorted by count desc, capped at `cap` to keep payload size sane.
export async function listPopularHighlights(input: {
  bookId: string
  viewerId: string | null
  minCount?: number
  cap?: number
}): Promise<PopularHighlight[]> {
  const minCount = input.minCount ?? 3
  const cap = input.cap ?? 200
  let q = supabase
    .from('highlights')
    .select('cfi, user_id')
    .eq('book_id', input.bookId)
    .limit(2000)
  if (input.viewerId) q = q.neq('user_id', input.viewerId)
  const { data, error } = await q
  if (error) {
    console.warn('[popular-highlights] fetch failed:', error.message)
    return []
  }
  const counts = new Map<string, number>()
  for (const r of (data ?? []) as Array<{ cfi: string; user_id: string }>) {
    if (!r.cfi) continue
    counts.set(r.cfi, (counts.get(r.cfi) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([cfi, count]) => ({ cfi, count }))
}

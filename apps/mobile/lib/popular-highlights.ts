// Popular highlights, aggregates other readers' highlights so the
// reader can render a soft tint on commonly-marked passages.
//
// Aggregation is by NORMALIZED TEXT, not by cfi. After the Foliate ->
// Readium reader migration, the highlights.cfi column holds a mix of
// legacy `epubcfi(...)` strings (Foliate users' old highlights) and
// Readium `Locator` JSON. Two users highlighting the same passage now
// have different cfi values, one in each format, so a cfi-keyed
// aggregation never crosses the migration boundary. Normalizing the
// excerpt text instead -- lowercase + collapse whitespace -- lets us
// match across formats and across small differences in selection
// boundaries (e.g. trailing space, smart vs straight quotes).

import { supabase } from './supabase'

export interface PopularHighlight {
  // Representative text for the group. Pass this to the reader's
  // text-based Locator decoration so Readium can match it against the
  // rendered page. Original casing / punctuation preserved.
  text: string
  // A representative cfi from the group, useful when the host needs a
  // navigable anchor (e.g. "jump to this passage" in a popular list).
  cfi: string
  count: number
}

const MIN_NORMALIZED_LENGTH = 12

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

// Returns groups with >= minCount highlights from readers other than the
// viewer. Sorted by count desc, capped at `cap` to keep the payload sane.
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
    .select('cfi, text, user_id, is_public')
    .eq('book_id', input.bookId)
    .eq('is_public', true)
    .limit(2000)
  if (input.viewerId) q = q.neq('user_id', input.viewerId)
  const { data, error } = await q
  if (error) {
    console.warn('[popular-highlights] fetch failed:', error.message)
    return []
  }

  // Group by normalized text. Track the first-seen original text + cfi
  // so the caller gets something usable to display / navigate to.
  interface Group {
    text: string
    cfi: string
    count: number
  }
  const groups = new Map<string, Group>()
  for (const r of (data ?? []) as Array<{
    cfi: string | null
    text: string | null
    user_id: string
  }>) {
    if (!r.text) continue
    const key = normalize(r.text)
    if (key.length < MIN_NORMALIZED_LENGTH) continue
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
    } else {
      groups.set(key, { text: r.text, cfi: r.cfi ?? '', count: 1 })
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= minCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, cap)
}

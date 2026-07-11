// Book/author AI helpers, wrap the new ai-companion actions with a small
// cache layer so the book detail and author screens don't re-bill the model
// every time the user reopens a page.
//
// SQL SCHEMA (assumed applied externally):
//
//   create table book_ai_cache (
//     cache_key text not null,
//     action text not null,
//     content text not null,
//     created_at timestamptz not null default now(),
//     primary key (cache_key, action)
//   );

import { supabase } from './supabase'

async function readCache(cacheKey: string, action: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('book_ai_cache')
    .select('content')
    .eq('cache_key', cacheKey)
    .eq('action', action)
    .maybeSingle()
  if (error) {
    // Table missing or RLS denial, degrade silently so the screen still
    // renders the freshly generated content.
    return null
  }
  return (data as { content: string } | null)?.content ?? null
}

async function writeCache(cacheKey: string, action: string, content: string): Promise<void> {
  await supabase.from('book_ai_cache').upsert(
    { cache_key: cacheKey, action, content },
    { onConflict: 'cache_key,action' },
  )
}

async function callAction<T = string>(
  action: string,
  payload: Record<string, unknown>,
  parser?: (raw: string) => T,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    'ai-companion',
    { body: { action, payload } },
  )
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  const raw = (data?.result ?? '').trim()
  return parser ? parser(raw) : ((raw as unknown) as T)
}

function stripFence(text: string): string {
  const t = text.trim()
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t)
  return m ? m[1].trim() : t
}

// ── Book actions ─────────────────────────────────────────────────────────

export interface BookCtx {
  bookId: string
  bookTitle: string
  author: string
}

export async function getBookDescription(ctx: BookCtx): Promise<string> {
  const cached = await readCache(ctx.bookId, 'book_description')
  if (cached) return cached
  const text = await callAction('book_description', {
    bookTitle: ctx.bookTitle,
    author: ctx.author,
    bookId: ctx.bookId,
  })
  await writeCache(ctx.bookId, 'book_description', text)
  // Also keep the canonical books.description column in sync so we don't
  // need to roundtrip through the cache for next reader.
  await supabase.from('books').update({ description: text }).eq('id', ctx.bookId)
  return text
}

export type BookInsightLens = 'difficulty' | 'warnings' | 'context' | 'appeal'

export type DeepDiveKind =
  | 'book_summary'
  | 'character_arcs'
  | 'book_timeline'
  | 'theme_analysis'
  | 'symbolism_index'
  | 'criticism_digest'
  | 'influence_map'
  | 'narrative_structure'
  | 'pov_analysis'
  | 'setting_analysis'
  | 'reread_guide'

export async function getDeepDive(ctx: BookCtx, kind: DeepDiveKind): Promise<string> {
  const action = `deep_dive_${kind}`
  const cached = await readCache(ctx.bookId, action)
  if (cached) return cached
  const text = await callAction('deep_dive', {
    kind,
    bookTitle: ctx.bookTitle,
    author: ctx.author,
    bookId: ctx.bookId,
  })
  await writeCache(ctx.bookId, action, text)
  return text
}

export async function getBookInsight(ctx: BookCtx, lens: BookInsightLens): Promise<string> {
  const action = `book_insight_${lens}`
  const cached = await readCache(ctx.bookId, action)
  if (cached) return cached
  const text = await callAction('book_insight', {
    bookTitle: ctx.bookTitle,
    author: ctx.author,
    lens,
    bookId: ctx.bookId,
  })
  await writeCache(ctx.bookId, action, text)
  return text
}

export interface SimilarBook {
  title: string
  author: string
  reason: string
  bookId?: string
}

export async function getSimilarBooks(ctx: BookCtx): Promise<SimilarBook[]> {
  const cached = await readCache(ctx.bookId, 'similar_books')
  let raw: string
  if (cached) {
    raw = cached
  } else {
    raw = await callAction('similar_books', {
      bookTitle: ctx.bookTitle,
      author: ctx.author,
      bookId: ctx.bookId,
    })
    await writeCache(ctx.bookId, 'similar_books', raw)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(stripFence(raw))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const recs = parsed
    .filter((r): r is { title: string; author: string; reason: string } =>
      !!r && typeof r === 'object' && typeof (r as { title?: unknown }).title === 'string',
    )
    .slice(0, 5)
    .map((r) => ({ title: r.title, author: r.author, reason: r.reason }))
  if (recs.length === 0) return []
  // Hydrate bookId from catalog title-match.
  const titles = recs.map((r) => r.title)
  const { data: matches } = await supabase
    .from('books')
    .select('id, title')
    .in('title', titles)
  const titleToId = new Map<string, string>()
  for (const m of (matches ?? []) as Array<{ id: string; title: string }>) {
    titleToId.set(m.title, m.id)
  }
  for (const r of recs) {
    const id = titleToId.get(r.title)
    if (id) (r as SimilarBook).bookId = id
  }
  return recs
}

// ── Author actions ───────────────────────────────────────────────────────

export function authorSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export async function getAuthorBio(authorName: string): Promise<string> {
  const slug = authorSlug(authorName)
  const cached = await readCache(`author:${slug}`, 'author_bio')
  if (cached) return cached
  const text = await callAction('author_bio', { authorName })
  await writeCache(`author:${slug}`, 'author_bio', text)
  return text
}

export interface ReadingOrderItem {
  title: string
  note: string
}

export async function getReadingOrder(
  authorName: string,
  bookTitles: string[],
): Promise<ReadingOrderItem[]> {
  if (bookTitles.length < 2) return []
  const slug = authorSlug(authorName)
  const cached = await readCache(`author:${slug}`, 'reading_order')
  let raw: string
  if (cached) {
    raw = cached
  } else {
    raw = await callAction('reading_order', { authorName, bookTitles })
    await writeCache(`author:${slug}`, 'reading_order', raw)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(stripFence(raw))
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== 'object') return []
  const items = (parsed as { items?: unknown }).items
  if (!Array.isArray(items)) return []
  return items
    .filter((r): r is ReadingOrderItem =>
      !!r && typeof r === 'object' && typeof (r as { title?: unknown }).title === 'string',
    )
    .map((r) => ({ title: r.title, note: r.note ?? '' }))
}

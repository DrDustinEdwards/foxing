// Maps Postgres rows to D1-ready plain objects.
// All values serialized to SqlVal (string | number | null):
//   - timestamps -> integer ms since epoch
//   - booleans -> 0 | 1
//   - Postgres text[] / jsonb arrays -> JSON.stringify'd string
//   - auto_confidence TEXT -> real (1.0 / 0.7 / 0.4)
//   - affiliate params stripped from amazon_url / bookshop_url
//   - added_by / author_id / saved_by -> null (user space starts empty)
//   - series_position / last_edited_at / last_edited_by -> dropped

import type {
  PgBook, PgBookAward, PgExternalBookClub, PgExternalBookClubPick,
  PgBookOfTheMonth, PgJournalPost, PgJournalPostVersion, SqlVal,
} from './types.ts'
import { stripAffiliateParams } from './affiliate.ts'

const AUTO_CONFIDENCE_MAP: Record<string, number> = { high: 1.0, medium: 0.7, low: 0.4 }

function ts(d: Date | null | undefined): number | null {
  if (!d) return null
  return d instanceof Date ? d.getTime() : null
}

// For D1 columns marked NOT NULL -- falls back to the provided epoch ms value.
function tsRequired(d: Date | null | undefined, fallbackMs: number): number {
  return ts(d) ?? fallbackMs
}

function bool(b: boolean): 0 | 1 {
  return b ? 1 : 0
}

function arr(a: string[] | null | undefined): string {
  return JSON.stringify(a ?? [])
}

// DATE columns from pg come back as 'YYYY-MM-DD' strings (not Date objects).
function dateStrToMs(s: string | null): number | null {
  if (!s) return null
  return new Date(s + 'T00:00:00.000Z').getTime()
}

export function transformBook(row: PgBook): Record<string, SqlVal> {
  return {
    id: row.id,
    gutenberg_id: row.gutenberg_id,
    title: row.title,
    author: row.author,
    author_slug: row.author_slug,
    slug: row.slug,
    description: row.description,
    cover_url: row.cover_url,
    epub_url: row.epub_url,
    source: row.source,
    source_type: row.source_type,
    external_url: row.external_url,
    language: row.language,
    subjects: arr(row.subjects),
    themes: arr(row.themes),
    mood_tags: arr(row.mood_tags),
    content_warnings: arr(row.content_warnings),
    pacing: row.pacing,
    reading_difficulty: row.reading_difficulty,
    word_count: row.word_count,
    publication_year: row.publication_year,
    publisher: row.publisher,
    country: row.country,
    series_name: row.series_name,
    series_order: row.series_order,
    // series_position: dropped (confirmed duplicate of series_order for all 23 series books)
    isbn: row.isbn,
    isbn13: row.isbn13,
    amazon_url: stripAffiliateParams(row.amazon_url),
    bookshop_url: stripAffiliateParams(row.bookshop_url),
    is_staff_pick: bool(row.is_staff_pick),
    staff_pick_note: row.staff_pick_note,
    weighted_rating: row.weighted_rating,
    rating_count: row.rating_count,
    added_by: null,
    created_at: tsRequired(row.created_at, Date.now()),
    updated_at: tsRequired(row.updated_at, tsRequired(row.created_at, Date.now())),
  }
}

export function transformBookAward(row: PgBookAward): Record<string, SqlVal> {
  return {
    id: row.id,
    book_id: row.book_id,
    award_slug: row.award_slug,
    award_name: row.award_name,
    year: row.year,
    distinction: row.distinction,
    scope: row.scope,
    country: row.country,
    url: row.url,
    created_at: tsRequired(row.created_at, Date.now()),
  }
}

export function transformExternalBookClub(row: PgExternalBookClub): Record<string, SqlVal> {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    short_name: row.short_name,
    description: row.description,
    curator: row.curator,
    website_url: row.website_url,
    logo_url: row.logo_url,
    cadence: row.cadence,
    focus: row.focus,
    eras: arr(row.eras),
    sort_order: row.sort_order,
    is_active: bool(row.is_active),
    created_at: tsRequired(row.created_at, Date.now()),
  }
}

export function transformExternalBookClubPick(row: PgExternalBookClubPick): Record<string, SqlVal> {
  const confidence = row.auto_confidence !== null
    ? (AUTO_CONFIDENCE_MAP[row.auto_confidence] ?? null)
    : null
  if (row.auto_confidence !== null && confidence === null) {
    console.warn(`[transform] Unknown auto_confidence "${row.auto_confidence}" on pick ${row.id}`)
  }
  return {
    id: row.id,
    club_id: row.club_id,
    book_id: row.book_id,
    picked_at: dateStrToMs(row.picked_at),
    pick_month: row.pick_month,
    pick_year: row.pick_year,
    category: row.category,
    official_url: row.official_url,
    notes: row.notes,
    curator_quote: row.curator_quote,
    era_label: row.era_label,
    era_start_year: row.era_start_year,
    era_end_year: row.era_end_year,
    auto_source: row.auto_source,
    auto_confidence: confidence,
    is_auto_discovered: bool(row.is_auto_discovered),
    is_published: bool(row.is_published),
    created_at: tsRequired(row.created_at, Date.now()),
    updated_at: tsRequired(row.updated_at, tsRequired(row.created_at, Date.now())),
    // last_edited_at, last_edited_by: dropped (no D1 target column)
  }
}

export function transformBookOfTheMonth(row: PgBookOfTheMonth): Record<string, SqlVal> {
  return {
    id: row.id,
    book_id: row.book_id,
    year: row.year,
    month: row.month,
    category: row.category,
    curator_note: row.curator_note,
    amazon_url: stripAffiliateParams(row.amazon_url),
    bookshop_url: stripAffiliateParams(row.bookshop_url),
    is_published: bool(row.is_published),
    created_at: tsRequired(row.created_at, Date.now()),
  }
}

export function transformJournalPost(
  row: PgJournalPost,
  relatedPostIds: string[],
): Record<string, SqlVal> {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    excerpt: row.excerpt,
    cover_image_url: row.cover_image_url,
    cover_image_alt: row.cover_image_alt,
    author_id: null,
    tags: arr(row.tags),
    related_post_ids: JSON.stringify(relatedPostIds),
    featured: bool(row.featured),
    is_published: bool(row.is_published),
    published_at: ts(row.published_at),
    show_published_at: bool(row.show_published_at),
    show_updated_at: bool(row.show_updated_at),
    og_title: row.og_title,
    og_description: row.og_description,
    canonical_url: row.canonical_url,
    reading_time_minutes: row.reading_time_minutes,
    created_at: tsRequired(row.created_at, Date.now()),
    updated_at: tsRequired(row.updated_at, tsRequired(row.created_at, Date.now())),
  }
}

export function transformJournalPostVersion(row: PgJournalPostVersion): Record<string, SqlVal> {
  return {
    id: row.id,
    post_id: row.post_id,
    title: row.title,
    content: row.content,
    excerpt: row.excerpt,
    saved_at: tsRequired(row.saved_at, Date.now()),
    saved_by: null,
  }
}

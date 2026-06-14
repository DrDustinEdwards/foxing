/**
 * Entity adapter registry — the ONE place each searchable entity declares its
 * table, text predicate, filters, sorts, and how a row maps to a card-ready
 * SearchHit. The query layer (query.ts) is generic over this registry, so a
 * new entity is a new adapter, never new query code.
 *
 * Every adapter builds a parameterized PostgREST query against the *caller's*
 * client (RLS as the viewer). Adapters never instantiate a client and never
 * use the service role.
 */
import { likePattern } from './escape'
import type {
  EntitySortOption,
  EraBucket,
  LengthBucket,
  SearchClient,
  SearchEntity,
  SearchHit,
  SearchQueryBuilder,
  EntityFilterMap,
} from './types'

// ── Named filter buckets → numeric ranges ─────────────────────────────────
// Kept here so the URL/UI tokens stay stable even if thresholds are retuned.

// Tokens + ranges align with lib/foxing ERAS (the indexed /books?era=… values).
export const ERA_RANGES: Record<EraBucket, { min: number | null; max: number | null }> = {
  'pre-1800': { min: null, max: 1799 },
  '1800s': { min: 1800, max: 1899 },
  'early-1900s': { min: 1900, max: 1949 },
  'mid-1900s': { min: 1950, max: 1999 },
}

/** word_count thresholds (a 60k / 120k split ≈ short / medium / long novels). */
export const LENGTH_RANGES: Record<LengthBucket, { min: number | null; max: number | null }> = {
  short: { min: null, max: 60_000 },
  medium: { min: 60_000, max: 120_000 },
  long: { min: 120_000, max: null },
}

export interface EntityAdapter<E extends SearchEntity> {
  entity: E
  /** Plural group label for grouped results. */
  label: string
  table: string
  /** Column projection passed to `.select()`. */
  selectColumns: string
  /** Apply the free-text predicate for a non-empty query. */
  applyText(q: SearchQueryBuilder, rawQuery: string): SearchQueryBuilder
  /** Apply always-on visibility/publish predicates (RLS-friendly). */
  applyBase(q: SearchQueryBuilder): SearchQueryBuilder
  /** Apply entity-specific facet filters. */
  applyFilters(
    q: SearchQueryBuilder,
    filters: EntityFilterMap[E] | undefined,
  ): SearchQueryBuilder
  sorts: EntitySortOption[]
  defaultSortValue: string
  /** Normalize a raw row to a card-ready hit. */
  mapRow(row: Record<string, unknown>): SearchHit<E>
  /** De-duplicate hits within a page (e.g. authors derived from books). */
  dedupeKey?(hit: SearchHit<E>): string
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}
function strOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function applyRange(
  q: SearchQueryBuilder,
  column: string,
  range: { min: number | null; max: number | null },
): SearchQueryBuilder {
  let out = q
  if (range.min != null) out = out.gte(column, range.min)
  if (range.max != null) out = out.lte(column, range.max)
  return out
}

// ── book ──────────────────────────────────────────────────────────────────

const BOOK_COLS =
  'id, slug, author_slug, title, author, cover_url, themes, weighted_rating, word_count, publication_year, created_at'

const bookAdapter: EntityAdapter<'book'> = {
  entity: 'book',
  label: 'Books',
  table: 'books',
  selectColumns: BOOK_COLS,
  applyText(q, raw) {
    const p = likePattern(raw)
    return q.or(`title.ilike.${p},author.ilike.${p}`)
  },
  applyBase: (q) => q,
  applyFilters(q, f) {
    let out = q
    if (f?.mood) out = out.contains('themes', [f.mood])
    if (f?.genre) out = out.contains('subjects', [f.genre])
    if (f?.era) out = applyRange(out, 'publication_year', ERA_RANGES[f.era])
    if (f?.length) out = applyRange(out, 'word_count', LENGTH_RANGES[f.length])
    return out
  },
  sorts: [
    { value: 'relevance', label: 'Best match', column: 'weighted_rating', dir: 'desc', nullsFirst: false },
    { value: 'title', label: 'Title A–Z', column: 'title', dir: 'asc' },
    { value: 'rating', label: 'Top rated', column: 'weighted_rating', dir: 'desc', nullsFirst: false },
    { value: 'newest', label: 'Newest', column: 'created_at', dir: 'desc' },
  ],
  defaultSortValue: 'relevance',
  mapRow: (r) => ({
    entity: 'book',
    id: str(r.id),
    href: `/book/${strOrNull(r.slug) ?? str(r.id)}`,
    title: str(r.title),
    subtitle: strOrNull(r.author),
    imageUrl: strOrNull(r.cover_url),
    data: r,
  }),
}

// ── author (derived from books) ────────────────────────────────────────────

const authorAdapter: EntityAdapter<'author'> = {
  entity: 'author',
  label: 'Authors',
  table: 'books',
  selectColumns: 'author, author_slug',
  applyText: (q, raw) => q.ilike('author', likePattern(raw)),
  applyBase: (q) => q,
  applyFilters: (q) => q,
  sorts: [
    { value: 'name', label: 'Name A–Z', column: 'author', dir: 'asc' },
  ],
  defaultSortValue: 'name',
  mapRow: (r) => ({
    entity: 'author',
    id: strOrNull(r.author_slug) ?? str(r.author),
    href: `/author/${strOrNull(r.author_slug) ?? ''}`,
    title: str(r.author),
    subtitle: null,
    imageUrl: null,
    data: r,
  }),
  dedupeKey: (hit) => hit.id,
}

// ── club ────────────────────────────────────────────────────────────────────

const CLUB_COLS =
  'id, slug, name, description, cover_url, member_count, visibility, genre_tags, current_book_id, created_at, current_book:current_book_id(id, slug, title, author, cover_url)'

const clubAdapter: EntityAdapter<'club'> = {
  entity: 'club',
  label: 'Clubs',
  table: 'clubs',
  selectColumns: CLUB_COLS,
  applyText: (q, raw) => q.ilike('name', likePattern(raw)),
  applyBase: (q) => q.eq('visibility', 'public'),
  applyFilters(q, f) {
    let out = q
    if (f?.genreTag) out = out.contains('genre_tags', [f.genreTag])
    if (f?.activity === 'active') out = out.gte('member_count', 1)
    return out
  },
  sorts: [
    { value: 'members', label: 'Most members', column: 'member_count', dir: 'desc' },
    { value: 'newest', label: 'Newest', column: 'created_at', dir: 'desc' },
    { value: 'active', label: 'Most active', column: 'member_count', dir: 'desc' },
  ],
  defaultSortValue: 'members',
  mapRow: (r) => ({
    entity: 'club',
    id: str(r.id),
    href: `/clubs/${strOrNull(r.slug) ?? str(r.id)}`,
    title: str(r.name),
    subtitle: strOrNull(r.description),
    imageUrl: strOrNull(r.cover_url),
    data: r,
  }),
}

// ── person ──────────────────────────────────────────────────────────────────

const PERSON_COLS =
  'id, username, display_name, avatar_url, reading_personality, is_public, total_books_read, total_highlights, created_at'

const personAdapter: EntityAdapter<'person'> = {
  entity: 'person',
  label: 'People',
  table: 'profiles',
  selectColumns: PERSON_COLS,
  applyText(q, raw) {
    const p = likePattern(raw)
    return q.or(`display_name.ilike.${p},username.ilike.${p}`)
  },
  applyBase: (q) => q.eq('is_public', true),
  applyFilters: (q) => q,
  sorts: [
    { value: 'most_books', label: 'Most books', column: 'total_books_read', dir: 'desc', nullsFirst: false },
    { value: 'most_active', label: 'Most active', column: 'total_highlights', dir: 'desc', nullsFirst: false },
    { value: 'new', label: 'Newest', column: 'created_at', dir: 'desc' },
  ],
  defaultSortValue: 'most_books',
  mapRow: (r) => ({
    entity: 'person',
    id: str(r.id),
    href: `/u/${str(r.username)}`,
    title: str(r.display_name) || str(r.username),
    subtitle: `@${str(r.username)}`,
    imageUrl: strOrNull(r.avatar_url),
    data: r,
  }),
}

// ── list ────────────────────────────────────────────────────────────────────

const LIST_COLS =
  'id, slug, title, description, cover_url, is_public, is_featured, like_count, created_at'

const listAdapter: EntityAdapter<'list'> = {
  entity: 'list',
  label: 'Lists',
  table: 'reading_lists',
  selectColumns: LIST_COLS,
  applyText(q, raw) {
    const p = likePattern(raw)
    return q.or(`title.ilike.${p},description.ilike.${p}`)
  },
  applyBase: (q) => q.eq('is_public', true),
  applyFilters: (q) => q,
  sorts: [
    { value: 'most_liked', label: 'Most liked', column: 'like_count', dir: 'desc', nullsFirst: false },
    { value: 'newest', label: 'Newest', column: 'created_at', dir: 'desc' },
  ],
  defaultSortValue: 'most_liked',
  mapRow: (r) => ({
    entity: 'list',
    id: str(r.id),
    href: `/lists/${strOrNull(r.slug) ?? str(r.id)}`,
    title: str(r.title),
    subtitle: strOrNull(r.description),
    imageUrl: strOrNull(r.cover_url),
    data: r,
  }),
}

// ── quote (public highlights) ────────────────────────────────────────────────

const QUOTE_COLS =
  'id, text, note, like_count, is_public, created_at, book:book_id(id, slug, title, author, cover_url)'

const quoteAdapter: EntityAdapter<'quote'> = {
  entity: 'quote',
  label: 'Quotes',
  table: 'highlights',
  selectColumns: QUOTE_COLS,
  applyText(q, raw) {
    const p = likePattern(raw)
    return q.or(`text.ilike.${p},note.ilike.${p}`)
  },
  applyBase: (q) => q.eq('is_public', true),
  applyFilters: (q) => q,
  sorts: [
    { value: 'most_liked', label: 'Most liked', column: 'like_count', dir: 'desc', nullsFirst: false },
    { value: 'newest', label: 'Newest', column: 'created_at', dir: 'desc' },
  ],
  defaultSortValue: 'newest',
  mapRow: (r) => {
    const book = r.book as Record<string, unknown> | null
    return {
      entity: 'quote',
      id: str(r.id),
      href: `/quotes/${str(r.id)}`,
      title: str(r.text),
      subtitle: book ? `${str(book.title)} · ${str(book.author)}` : null,
      imageUrl: book ? strOrNull(book.cover_url) : null,
      data: r,
    }
  },
}

// ── journal ──────────────────────────────────────────────────────────────────

const JOURNAL_COLS =
  'id, slug, title, excerpt, cover_image_url, tags, is_published, published_at, created_at'

const journalAdapter: EntityAdapter<'journal'> = {
  entity: 'journal',
  label: 'Journal',
  table: 'journal_posts',
  selectColumns: JOURNAL_COLS,
  applyText(q, raw) {
    const p = likePattern(raw)
    return q.or(`title.ilike.${p},excerpt.ilike.${p},content.ilike.${p}`)
  },
  applyBase: (q) => q.eq('is_published', true),
  applyFilters(q, f) {
    return f?.tag ? q.contains('tags', [f.tag]) : q
  },
  sorts: [
    { value: 'newest', label: 'Newest', column: 'published_at', dir: 'desc', nullsFirst: false },
  ],
  defaultSortValue: 'newest',
  mapRow: (r) => ({
    entity: 'journal',
    id: str(r.id),
    href: `/journal/${str(r.slug)}`,
    title: str(r.title),
    subtitle: strOrNull(r.excerpt),
    imageUrl: strOrNull(r.cover_image_url),
    data: r,
  }),
}

// ── pick (celebrity / external book-club picks) ──────────────────────────────

const PICK_COLS =
  'id, club_id, book_id, picked_at, pick_year, pick_month, category, is_published, book:book_id(id, slug, title, author, cover_url, publication_year), club:club_id(id, slug, name, short_name)'

const pickAdapter: EntityAdapter<'pick'> = {
  entity: 'pick',
  label: 'Picks',
  table: 'external_book_club_picks',
  selectColumns: PICK_COLS,
  applyText(q, raw) {
    const p = likePattern(raw)
    // Search the embedded book by title/author (PostgREST referenced-table or).
    return q.or(`title.ilike.${p},author.ilike.${p}`, { referencedTable: 'book' })
  },
  applyBase: (q) => q.eq('is_published', true),
  applyFilters(q, f) {
    let out = q
    if (f?.year != null) out = out.eq('pick_year', f.year)
    if (f?.clubId) out = out.eq('club_id', f.clubId)
    if (f?.era) {
      out = applyRange(out, 'book.publication_year', ERA_RANGES[f.era])
    }
    return out
  },
  sorts: [
    { value: 'newest', label: 'Newest', column: 'picked_at', dir: 'desc', nullsFirst: false },
    { value: 'year', label: 'By year', column: 'pick_year', dir: 'desc', nullsFirst: false },
  ],
  defaultSortValue: 'newest',
  mapRow: (r) => {
    const book = r.book as Record<string, unknown> | null
    const club = r.club as Record<string, unknown> | null
    return {
      entity: 'pick',
      id: str(r.id),
      href: book ? `/book/${strOrNull(book.slug) ?? str(book.id)}` : '#',
      title: book ? str(book.title) : 'Pick',
      subtitle: [book ? str(book.author) : null, club ? str(club.name) : null]
        .filter(Boolean)
        .join(' · '),
      imageUrl: book ? strOrNull(book.cover_url) : null,
      data: r,
    }
  },
}

// ── registry ────────────────────────────────────────────────────────────────

type AdapterRegistry = {
  [E in SearchEntity]: EntityAdapter<E>
}

export const ENTITY_ADAPTERS: AdapterRegistry = {
  book: bookAdapter,
  author: authorAdapter,
  club: clubAdapter,
  person: personAdapter,
  list: listAdapter,
  quote: quoteAdapter,
  journal: journalAdapter,
  pick: pickAdapter,
}

export function getAdapter<E extends SearchEntity>(entity: E): EntityAdapter<E> {
  return ENTITY_ADAPTERS[entity]
}

/** Re-export for tests/consumers that need to assert client type at a boundary. */
export type { SearchClient }

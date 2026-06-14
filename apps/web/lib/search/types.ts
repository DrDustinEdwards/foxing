/**
 * Federated search — shared type system.
 *
 * ONE set of types for every searchable entity. Pages and the command
 * palette are thin consumers of this layer; they never define their own
 * query shapes. See task-search-filters.md.
 */

// ── Entities ──────────────────────────────────────────────────────────────

export const SEARCH_ENTITIES = [
  'book',
  'author',
  'club',
  'person',
  'list',
  'quote',
  'journal',
  'pick',
] as const

export type SearchEntity = (typeof SEARCH_ENTITIES)[number]

export function isSearchEntity(value: string): value is SearchEntity {
  return (SEARCH_ENTITIES as readonly string[]).includes(value)
}

// ── Per-entity filter params ──────────────────────────────────────────────
// `era` and `length` are named buckets resolved to numeric ranges in the
// adapter, so the URL/UI stays stable even if the underlying thresholds move.

export type EraBucket =
  | 'ancient'
  | 'early-modern'
  | 'nineteenth'
  | 'twentieth'
  | 'contemporary'

export type LengthBucket = 'short' | 'medium' | 'long'

export interface BookFilters {
  mood?: string
  genre?: string
  era?: EraBucket
  length?: LengthBucket
}

export interface AuthorFilters {
  // No structured facets yet; text + sort only.
  readonly _never?: never
}

export interface ClubFilters {
  genreTag?: string
  /** When 'active', restrict to clubs with recent member activity. */
  activity?: 'active'
}

export interface PersonFilters {
  readonly _never?: never
}

export interface ListFilters {
  readonly _never?: never
}

export interface QuoteFilters {
  readonly _never?: never
}

export interface JournalFilters {
  tag?: string
}

export interface PickFilters {
  year?: number
  clubId?: string
  era?: EraBucket
}

export interface EntityFilterMap {
  book: BookFilters
  author: AuthorFilters
  club: ClubFilters
  person: PersonFilters
  list: ListFilters
  quote: QuoteFilters
  journal: JournalFilters
  pick: PickFilters
}

export type FiltersFor<E extends SearchEntity> = EntityFilterMap[E]

// ── Sorting ───────────────────────────────────────────────────────────────

export type SortDir = 'asc' | 'desc'

/** A sort option an entity supports. `value` is the stable URL token. */
export interface EntitySortOption {
  value: string
  label: string
  column: string
  dir: SortDir
  nullsFirst?: boolean
}

// ── Query params + results ────────────────────────────────────────────────

export interface SearchParams<E extends SearchEntity = SearchEntity> {
  entity: E
  query?: string
  /** A `value` from the entity's sort options; falls back to the default. */
  sort?: string
  filters?: FiltersFor<E>
  /** Opaque cursor from a previous page's `nextCursor`. */
  cursor?: string | null
  /** Page size. Defaults to DEFAULT_PAGE_SIZE. */
  limit?: number
}

/** A single result row, normalized to a card-ready shape per entity. */
export interface SearchHit<E extends SearchEntity = SearchEntity> {
  entity: E
  id: string
  /** Canonical href for navigation. */
  href: string
  title: string
  subtitle?: string | null
  imageUrl?: string | null
  /** The raw normalized record, typed per entity by the adapter's mapRow. */
  data: unknown
}

export interface SearchResult<E extends SearchEntity = SearchEntity> {
  entity: E
  hits: SearchHit<E>[]
  total: number
  nextCursor: string | null
}

/** Grouped output for the /search page and the palette (Layer 2). */
export interface SearchGroup {
  entity: SearchEntity
  label: string
  hits: SearchHit[]
  total: number
}

export interface GroupedResults {
  query: string
  groups: SearchGroup[]
  /** Sum of all group totals. */
  total: number
}

// ── Structural Supabase client ────────────────────────────────────────────
// The query layer never instantiates a client. It receives one (the viewer's
// role) so RLS is enforced by Postgres. This structural interface matches both
// the real PostgREST builder and the test fake, keeping the core decoupled and
// unit-testable without a live database.

export interface SearchQueryBuilder {
  select(
    columns: string,
    opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean },
  ): SearchQueryBuilder
  or(filters: string, opts?: { referencedTable?: string }): SearchQueryBuilder
  ilike(column: string, pattern: string): SearchQueryBuilder
  contains(column: string, value: unknown): SearchQueryBuilder
  eq(column: string, value: unknown): SearchQueryBuilder
  gte(column: string, value: unknown): SearchQueryBuilder
  lte(column: string, value: unknown): SearchQueryBuilder
  order(
    column: string,
    opts?: { ascending?: boolean; nullsFirst?: boolean },
  ): SearchQueryBuilder
  range(from: number, to: number): SearchQueryBuilder
  then<TResult1 = SearchQueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: SearchQueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>
}

export interface SearchQueryResult {
  data: Record<string, unknown>[] | null
  count: number | null
  error: { message: string } | null
}

export interface SearchClient {
  from(table: string): SearchQueryBuilder
}

export const DEFAULT_PAGE_SIZE = 24
export const MAX_PAGE_SIZE = 100

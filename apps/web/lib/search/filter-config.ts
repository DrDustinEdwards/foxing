/**
 * <FilterBar> configuration — a page becomes a small config object plus
 * <FilterBar config={...}/> and the shared results grid. No bespoke per-page
 * filter components. The same config also drives URL <-> SearchParams sync so
 * filters are shareable / SEO-friendly / ISR-safe.
 */
import type { FiltersFor, SearchEntity, SearchParams } from './types'

export interface FacetOption {
  value: string
  label: string
}

/** A multi/single chip group or dropdown bound to one URL param. */
export interface ChoiceFacet {
  type: 'chips' | 'select'
  /** Stable id (used as React key). */
  key: string
  label: string
  /** URL search param this facet reads/writes. */
  param: string
  /** Filter object key for the adapter (defaults to `param`). Use when the
   * URL token and the typed filter key differ, e.g. URL `genre_tag` ->
   * ClubFilters.genreTag. */
  filterKey?: string
  options: FacetOption[]
  /** Allow multiple selections (chips only). */
  multiple?: boolean
}

/** A numeric/bucket range rendered as two controls. */
export interface RangeFacet {
  type: 'range'
  key: string
  label: string
  param: string
  filterKey?: string
  options: FacetOption[]
}

export type FacetConfig = ChoiceFacet | RangeFacet

/**
 * Per-option result counts, keyed by facet `param` then option `value`.
 * Computed in the query layer (fetchFacetCounts) and passed to <FilterBar> so
 * it can label options ("Dark (62)") and disable dead (0-count) ones.
 */
export type FacetCounts = Record<string, Record<string, number>>

export interface SortConfig {
  value: string
  label: string
}

export interface FilterBarConfig {
  /** Federated entity this config queries. Optional: pages that are NOT a
   * federated search entity (e.g. /giveaways) reuse the FilterBar *UI* primitive
   * for URL-synced facets while running their own data query. The query side
   * (paramsToSearch / searchPageData) takes the entity separately, so this field
   * is only documentary and is unused by the FilterBar component itself. */
  entity?: SearchEntity
  /** Placeholder for the text input. */
  searchPlaceholder: string
  /** Whether to render the free-text input at all (some pages are facet-only). */
  showSearch?: boolean
  sorts: SortConfig[]
  defaultSort: string
  facets: FacetConfig[]
}

// ── URL <-> SearchParams ──────────────────────────────────────────────────
// Pure, dependency-free, so both server components (parse incoming
// searchParams) and the client FilterBar (write the URL) use the same logic,
// and it is unit-testable.

/** Reserved param names the FilterBar manages directly. */
export const RESERVED_PARAMS = {
  query: 'q',
  sort: 'sort',
  cursor: 'cursor',
} as const

type ParamRecord = Record<string, string | string[] | undefined>

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

/**
 * Parse incoming URL searchParams into a typed SearchParams for one entity,
 * driven by the page's FilterBar config.
 */
export function paramsToSearch<E extends SearchEntity>(
  entity: E,
  config: FilterBarConfig,
  searchParams: ParamRecord,
): SearchParams<E> {
  const query = first(searchParams[RESERVED_PARAMS.query])?.trim() || undefined
  const sortRaw = first(searchParams[RESERVED_PARAMS.sort])
  const sort = config.sorts.some((s) => s.value === sortRaw)
    ? sortRaw
    : config.defaultSort
  const cursor = first(searchParams[RESERVED_PARAMS.cursor]) ?? null

  const filters: Record<string, unknown> = {}
  for (const facet of config.facets) {
    const raw = searchParams[facet.param]
    if (raw == null) continue
    const key = facet.filterKey ?? facet.param
    if (facet.type === 'chips' && facet.multiple) {
      const values = Array.isArray(raw) ? raw : [raw]
      const valid = values.filter((v) => facet.options.some((o) => o.value === v))
      if (valid.length) filters[key] = valid
    } else {
      const value = first(raw)
      if (value && facet.options.some((o) => o.value === value)) {
        filters[key] = value
      }
    }
  }

  return {
    entity,
    query,
    sort,
    cursor,
    filters: (Object.keys(filters).length
      ? (filters as FiltersFor<E>)
      : undefined) as FiltersFor<E> | undefined,
  }
}

/**
 * Serialize a partial filter state back into a flat URLSearchParams-ready
 * record. Used by the client FilterBar to push shareable URLs.
 */
export function searchToParams(
  config: FilterBarConfig,
  state: {
    query?: string
    sort?: string
    filters?: Record<string, string | string[] | undefined>
  },
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  if (state.query?.trim()) out[RESERVED_PARAMS.query] = state.query.trim()
  if (state.sort && state.sort !== config.defaultSort) {
    out[RESERVED_PARAMS.sort] = state.sort
  }
  for (const facet of config.facets) {
    const v = state.filters?.[facet.param]
    if (v == null) continue
    if (Array.isArray(v)) {
      if (v.length) out[facet.param] = v
    } else if (v) {
      out[facet.param] = v
    }
  }
  return out
}

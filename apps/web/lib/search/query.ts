/**
 * Federated query engine. Generic over the adapter registry — there is no
 * per-entity query code here and no second search implementation anywhere.
 *
 * RLS: every function receives the *caller's* SearchClient and runs queries
 * with that role. This module must never import a service-role/admin client;
 * the regression tests enforce that (query-as-viewer is the castle wall).
 */
import { getAdapter } from './adapters'
import { decodeCursor, encodeCursor } from './escape'
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  SEARCH_ENTITIES,
  type GroupedResults,
  type SearchClient,
  type SearchEntity,
  type SearchGroup,
  type SearchHit,
  type SearchParams,
  type SearchResult,
} from './types'

export class SearchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SearchError'
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function dedupe<E extends SearchEntity>(
  hits: SearchHit<E>[],
  keyOf: (hit: SearchHit<E>) => string,
): SearchHit<E>[] {
  const seen = new Set<string>()
  const out: SearchHit<E>[] = []
  for (const hit of hits) {
    const k = keyOf(hit)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(hit)
  }
  return out
}

/**
 * Search a single entity. Server-side, parameterized, RLS-safe.
 * Pagination is offset-based behind an opaque cursor.
 */
export async function searchEntity<E extends SearchEntity>(
  client: SearchClient,
  params: SearchParams<E>,
): Promise<SearchResult<E>> {
  const adapter = getAdapter(params.entity)
  const limit = clamp(params.limit ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE)
  const offset = decodeCursor(params.cursor)

  const sort =
    adapter.sorts.find((s) => s.value === params.sort) ??
    adapter.sorts.find((s) => s.value === adapter.defaultSortValue) ??
    adapter.sorts[0]

  let q = client
    .from(adapter.table)
    .select(adapter.selectColumns, { count: 'exact' })

  q = adapter.applyBase(q)

  const query = params.query?.trim()
  if (query) q = adapter.applyText(q, query)

  q = adapter.applyFilters(q, params.filters)

  if (sort) {
    q = q.order(sort.column, {
      ascending: sort.dir === 'asc',
      nullsFirst: sort.nullsFirst,
    })
  }

  q = q.range(offset, offset + limit - 1)

  const { data, count, error } = await q
  if (error) throw new SearchError(error.message)

  let hits = (data ?? []).map((row) => adapter.mapRow(row))
  if (adapter.dedupeKey) hits = dedupe(hits, adapter.dedupeKey)

  const total = count ?? 0
  const nextOffset = offset + limit
  const nextCursor = nextOffset < total ? encodeCursor(nextOffset) : null

  return { entity: params.entity, hits, total, nextCursor }
}

export interface FederatedSearchOptions {
  query: string
  /** Which entities to include. Defaults to all. */
  entities?: SearchEntity[]
  /** Hits per entity group. Defaults to 5 (palette-sized). */
  perEntityLimit?: number
}

/**
 * Search every (or a subset of) entity in parallel and return grouped results
 * with per-group counts. Powers both the /search page and the command palette
 * (Layer 2). One entity failing (e.g. an RLS denial) drops that group rather
 * than failing the whole search.
 */
export async function searchFederated(
  client: SearchClient,
  opts: FederatedSearchOptions,
): Promise<GroupedResults> {
  const query = opts.query.trim()
  if (!query) return { query: '', groups: [], total: 0 }

  const entities = opts.entities ?? [...SEARCH_ENTITIES]
  const perEntityLimit = opts.perEntityLimit ?? 5

  const settled = await Promise.all(
    entities.map((entity) =>
      searchEntity(client, { entity, query, limit: perEntityLimit }).catch(
        (err: unknown) => {
          // Resilient: a single entity's failure must not blank the palette.
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[search] ${entity} failed:`, err)
          }
          return null
        },
      ),
    ),
  )

  const groups: SearchGroup[] = settled
    .filter((r): r is SearchResult => r !== null)
    .filter((r) => r.hits.length > 0)
    .map((r) => ({
      entity: r.entity,
      label: getAdapter(r.entity).label,
      hits: r.hits as SearchHit[],
      total: r.total,
    }))

  const total = groups.reduce((sum, g) => sum + g.total, 0)
  return { query, groups, total }
}

export { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE }

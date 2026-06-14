/**
 * One query-key scheme for every search query (per-entity and federated), so
 * the /search page, per-page filters, and the palette share one cache.
 */
import type { SearchEntity, SearchParams } from './types'

/** Stable, serializable slice of params that affects results. */
function keyParams<E extends SearchEntity>(params: SearchParams<E>) {
  return {
    query: params.query?.trim() || '',
    sort: params.sort ?? null,
    filters: params.filters ?? null,
    cursor: params.cursor ?? null,
    limit: params.limit ?? null,
  }
}

export const searchKeys = {
  all: ['search'] as const,
  entity: <E extends SearchEntity>(entity: E, params: SearchParams<E>) =>
    ['search', 'entity', entity, keyParams(params)] as const,
  federated: (query: string, entities?: SearchEntity[], perEntityLimit?: number) =>
    [
      'search',
      'federated',
      query.trim(),
      entities ? [...entities].sort() : 'all',
      perEntityLimit ?? null,
    ] as const,
}

export type SearchEntityKey = ReturnType<typeof searchKeys.entity>
export type SearchFederatedKey = ReturnType<typeof searchKeys.federated>

'use client'

/**
 * Client bindings for the search core. The actual queries run server-side
 * (RLS as the viewer) behind /api/search; these hooks only cache + manage
 * async state via TanStack Query, using the shared key scheme.
 */
import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { searchKeys } from './keys'
import type {
  GroupedResults,
  SearchEntity,
  SearchParams,
  SearchResult,
} from './types'

const ENDPOINT = '/api/search'

/** Build the GET URL for a single-entity search. */
export function entitySearchUrl<E extends SearchEntity>(
  params: SearchParams<E>,
): string {
  const sp = new URLSearchParams()
  sp.set('mode', 'entity')
  sp.set('entity', params.entity)
  if (params.query) sp.set('q', params.query)
  if (params.sort) sp.set('sort', params.sort)
  if (params.cursor) sp.set('cursor', params.cursor)
  if (params.limit != null) sp.set('limit', String(params.limit))
  if (params.filters && Object.keys(params.filters).length) {
    sp.set('f', JSON.stringify(params.filters))
  }
  return `${ENDPOINT}?${sp.toString()}`
}

/** Build the GET URL for a federated (grouped) search. */
export function federatedSearchUrl(opts: {
  query: string
  entities?: SearchEntity[]
  perEntityLimit?: number
}): string {
  const sp = new URLSearchParams()
  sp.set('mode', 'federated')
  sp.set('q', opts.query)
  if (opts.entities) sp.set('entities', opts.entities.join(','))
  if (opts.perEntityLimit != null) sp.set('limit', String(opts.perEntityLimit))
  return `${ENDPOINT}?${sp.toString()}`
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Search request failed: ${res.status}`)
  return (await res.json()) as T
}

export function entitySearchQueryOptions<E extends SearchEntity>(
  params: SearchParams<E>,
): UseQueryOptions<SearchResult<E>> {
  return {
    queryKey: searchKeys.entity(params.entity, params),
    queryFn: ({ signal }) =>
      fetchJson<SearchResult<E>>(entitySearchUrl(params), signal),
  }
}

export function federatedSearchQueryOptions(opts: {
  query: string
  entities?: SearchEntity[]
  perEntityLimit?: number
}): UseQueryOptions<GroupedResults> {
  return {
    queryKey: searchKeys.federated(opts.query, opts.entities, opts.perEntityLimit),
    queryFn: ({ signal }) =>
      fetchJson<GroupedResults>(federatedSearchUrl(opts), signal),
  }
}

export function useEntitySearch<E extends SearchEntity>(
  params: SearchParams<E>,
  options?: { enabled?: boolean },
) {
  return useQuery<SearchResult<E>>({
    ...entitySearchQueryOptions(params),
    enabled: options?.enabled ?? true,
  })
}

export function useFederatedSearch(
  opts: { query: string; entities?: SearchEntity[]; perEntityLimit?: number },
  options?: { enabled?: boolean },
) {
  const enabled = (options?.enabled ?? true) && opts.query.trim().length > 0
  return useQuery<GroupedResults>({
    ...federatedSearchQueryOptions(opts),
    enabled,
    placeholderData: (prev) => prev, // keep previous results while typing
  })
}

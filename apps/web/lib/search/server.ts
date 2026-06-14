import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { searchEntity } from './query'
import { encodeCursor } from './escape'
import { paramsToSearch } from './filter-config'
import type { FilterBarConfig } from './filter-config'
import {
  DEFAULT_PAGE_SIZE,
  type SearchClient,
  type SearchEntity,
  type SearchResult,
} from './types'

type ParamRecord = Record<string, string | string[] | undefined>

export interface SearchPageData<E extends SearchEntity> {
  result: SearchResult<E>
  page: number
  totalPages: number
  pageSize: number
  query: string
}

/**
 * Run a single-entity browse query for a page from its URL searchParams +
 * FilterBar config. Pages call ONLY this — no per-page query logic. Numbered
 * `?page=N` (SEO-crawlable) maps to the core's offset cursor; legacy `?search=`
 * is accepted alongside `?q=`. Queries run as the viewer (cookie client → RLS).
 */
export async function searchPageData<E extends SearchEntity>(
  entity: E,
  config: FilterBarConfig,
  searchParams: ParamRecord,
  opts?: { pageSize?: number },
): Promise<SearchPageData<E>> {
  const pageSize = opts?.pageSize ?? DEFAULT_PAGE_SIZE
  const pageRaw = Array.isArray(searchParams.page)
    ? searchParams.page[0]
    : searchParams.page
  const page = Math.max(1, Number(pageRaw) || 1)

  // Back-compat: accept legacy ?search= in addition to the canonical ?q=.
  const merged: ParamRecord = { ...searchParams }
  if (merged.q == null && merged.search != null) merged.q = merged.search

  const params = paramsToSearch(entity, config, merged)
  params.cursor = encodeCursor((page - 1) * pageSize)
  params.limit = pageSize

  const supabase = await createClient()
  const result = await searchEntity(
    supabase as unknown as SearchClient,
    params,
  )
  const totalPages = Math.max(1, Math.ceil(result.total / pageSize))
  return { result, page, totalPages, pageSize, query: params.query ?? '' }
}

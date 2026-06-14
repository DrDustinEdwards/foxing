/**
 * Federated search core — public surface. Consumers (the /search page,
 * per-page FilterBars, the command palette) import from here only.
 */
export * from './types'
export { ENTITY_ADAPTERS, getAdapter, ERA_RANGES, LENGTH_RANGES } from './adapters'
export type { EntityAdapter } from './adapters'
export {
  searchEntity,
  searchFederated,
  SearchError,
  type FederatedSearchOptions,
} from './query'
export { searchKeys } from './keys'
export { escapeLike, likePattern, encodeCursor, decodeCursor } from './escape'
export {
  paramsToSearch,
  searchToParams,
  RESERVED_PARAMS,
  type FilterBarConfig,
  type FacetConfig,
  type ChoiceFacet,
  type RangeFacet,
  type FacetOption,
  type SortConfig,
} from './filter-config'

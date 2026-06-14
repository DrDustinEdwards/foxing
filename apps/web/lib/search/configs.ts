/**
 * Per-page FilterBar configs. A browse page = one of these + <FilterBar/> +
 * the shared results grid. Facet tokens reuse the canonical lib/foxing lists so
 * existing indexed /books?mood=… / ?era=… / ?length=… URLs resolve identically.
 */
import { ERAS, LENGTHS, MOODS } from '@/lib/foxing'
import type { FacetOption, FilterBarConfig } from './filter-config'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const BOOKS_FILTER_CONFIG: FilterBarConfig = {
  entity: 'book',
  searchPlaceholder: 'Search books and authors',
  defaultSort: 'relevance',
  sorts: [
    { value: 'relevance', label: 'Best match' },
    { value: 'title', label: 'Title A–Z' },
    { value: 'rating', label: 'Top rated' },
    { value: 'newest', label: 'Newest' },
  ],
  facets: [
    // mood -> books.themes (single-select to match the existing single-mood URL)
    {
      type: 'chips',
      key: 'mood',
      label: 'Mood',
      param: 'mood',
      options: MOODS.map((m) => ({ value: m, label: cap(m) })),
    },
    // era -> publication_year buckets (tokens from lib/foxing ERAS)
    {
      type: 'select',
      key: 'era',
      label: 'Era',
      param: 'era',
      options: ERAS.map((e) => ({ value: e.value, label: e.label })),
    },
    // length -> word_count buckets (tokens from lib/foxing LENGTHS)
    {
      type: 'select',
      key: 'length',
      label: 'Length',
      param: 'length',
      options: LENGTHS.map((l) => ({ value: l.value, label: l.label })),
    },
    // genre -> books.subjects is supported by the adapter, but there is no
    // curated subject taxonomy yet, so no facet is surfaced (follow-up).
  ],
}

/**
 * People config. No structured facets (text + sort only). Sort tokens match the
 * person adapter (most_books -> total_books_read, most_active -> total_highlights,
 * new -> created_at).
 */
export const PEOPLE_FILTER_CONFIG: FilterBarConfig = {
  entity: 'person',
  searchPlaceholder: 'Search by name or username',
  defaultSort: 'most_books',
  sorts: [
    { value: 'most_books', label: 'Most books' },
    { value: 'most_active', label: 'Most active' },
    { value: 'new', label: 'New members' },
  ],
  facets: [],
}

/**
 * Lists config. Text search over title/description + most-liked/newest sort.
 * No facets. (/lists keeps its own card + per-viewer like button — it consumes
 * the shared QUERY layer, not the shared result card. See the page comment.)
 */
export const LISTS_FILTER_CONFIG: FilterBarConfig = {
  entity: 'list',
  searchPlaceholder: 'Search lists',
  defaultSort: 'most_liked',
  sorts: [
    { value: 'most_liked', label: 'Most liked' },
    { value: 'newest', label: 'Newest' },
  ],
  facets: [],
}

/**
 * Quotes config. Text search over the highlight text/note + most-liked/newest
 * sort. No facets. (Per-viewer like button stays on the page; shared query only.)
 */
export const QUOTES_FILTER_CONFIG: FilterBarConfig = {
  entity: 'quote',
  searchPlaceholder: 'Search quotes, books, authors',
  defaultSort: 'newest',
  sorts: [
    { value: 'newest', label: 'Newest' },
    { value: 'most_liked', label: 'Most liked' },
  ],
  facets: [],
}

/**
 * Clubs config. Genre options come from real genre_tags data (empty hides the
 * facet). URL token `genre_tag` maps to ClubFilters.genreTag via filterKey.
 */
export function buildClubsFilterConfig(
  genreOptions: FacetOption[],
): FilterBarConfig {
  return {
    entity: 'club',
    searchPlaceholder: 'Search clubs',
    defaultSort: 'members',
    sorts: [
      { value: 'members', label: 'Most members' },
      { value: 'newest', label: 'Newest' },
      { value: 'active', label: 'Most active' },
    ],
    facets: genreOptions.length
      ? [
          {
            type: 'select',
            key: 'genre',
            label: 'Genre',
            param: 'genre_tag',
            filterKey: 'genreTag',
            options: genreOptions,
          },
        ]
      : [],
  }
}

/**
 * Giveaways config. /giveaways is NOT a federated search entity (it is excluded
 * from the Layer 1 entity list by design -- giveaways are transactional, not
 * catalog content, and must not enter the universal palette). It reuses the
 * FilterBar UI primitive for URL-synced type/status facets while the page runs
 * its own giveaway query. No `entity`, no free-text search, no sort.
 */
export const GIVEAWAYS_FILTER_CONFIG: FilterBarConfig = {
  searchPlaceholder: '',
  showSearch: false,
  defaultSort: '',
  sorts: [],
  facets: [
    {
      type: 'select',
      key: 'kind',
      label: 'Type',
      param: 'kind',
      options: [
        { value: 'digital', label: 'Digital' },
        { value: 'physical', label: 'Physical' },
      ],
    },
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      param: 'status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'ended', label: 'Ended' },
      ],
    },
  ],
}

/**
 * Picks config (/book-clubs/picks). Text search over the embedded book
 * title/author, with year / club / era facets. Year + club options come from
 * real data; era uses the canonical lib/foxing ERAS (filters book.publication_year
 * via the pick adapter's inner-joined book). URL `club` maps to PickFilters.clubId.
 */
export function buildPicksFilterConfig(
  yearOptions: FacetOption[],
  clubOptions: FacetOption[],
): FilterBarConfig {
  return {
    entity: 'pick',
    searchPlaceholder: 'Search picks by title or author',
    defaultSort: 'newest',
    sorts: [
      { value: 'newest', label: 'Newest' },
      { value: 'year', label: 'By year' },
    ],
    facets: [
      ...(yearOptions.length
        ? [
            {
              type: 'select' as const,
              key: 'year',
              label: 'Year',
              param: 'year',
              filterKey: 'year',
              options: yearOptions,
            },
          ]
        : []),
      ...(clubOptions.length
        ? [
            {
              type: 'select' as const,
              key: 'club',
              label: 'Club',
              param: 'club',
              filterKey: 'clubId',
              options: clubOptions,
            },
          ]
        : []),
      {
        type: 'select' as const,
        key: 'era',
        label: 'Era',
        param: 'era',
        filterKey: 'era',
        options: ERAS.map((e) => ({ value: e.value, label: e.label })),
      },
    ],
  }
}

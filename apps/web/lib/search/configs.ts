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

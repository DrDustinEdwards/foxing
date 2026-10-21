import type { UserBookStatus } from '@/lib/library'

export type ShelfKey =
  | { kind: 'status'; status: UserBookStatus; label: string }
  | { kind: 'custom'; shelfId: string; label: string }

export const STATUS_SHELVES: Array<{ status: UserBookStatus; label: string }> = [
  { status: 'reading', label: 'Reading' },
  { status: 'paused', label: 'Paused' },
  { status: 'want_to_read', label: 'Want to Read' },
  { status: 'finished', label: 'Finished' },
  { status: 'abandoned', label: 'Abandoned' },
]

export type SortKey =
  | 'date_added'
  | 'date_finished'
  | 'title'
  | 'author'
  | 'rating'
  | 'length'

export const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: 'date_added', label: 'Date added' },
  { id: 'date_finished', label: 'Date finished' },
  { id: 'title', label: 'Title' },
  { id: 'author', label: 'Author' },
  { id: 'rating', label: 'Rating' },
  { id: 'length', label: 'Length' },
]

export interface BookRow {
  id: string
  status: UserBookStatus
  progress_percentage: number
  created_at: string
  finished_at: string | null
  rating: number | null
  rating_half: number | null
  review: string | null
  review_is_public: boolean | null
  book: {
    id: string
    title: string
    author: string
    cover_url: string | null
    word_count: number | null
    series_name: string | null
    epub_url: string | null
  } | null
}

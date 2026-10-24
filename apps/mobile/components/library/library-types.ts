import type * as W from '@foxing/types'

export type ShelfKey =
  | { kind: 'status'; status: W.ShelfStatus; label: string }
  | { kind: 'custom'; shelfId: string; label: string }

export const STATUS_SHELVES: Array<{ status: W.ShelfStatus; label: string }> = [
  { status: 'reading', label: 'Reading' },
  { status: 'paused', label: 'Paused' },
  { status: 'want', label: 'Want to Read' },
  { status: 'finished', label: 'Finished' },
  { status: 'abandoned', label: 'Abandoned' },
]

export type SortKey = 'updated' | 'title' | 'author'

export const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: 'updated', label: 'Recently updated' },
  { id: 'title', label: 'Title' },
  { id: 'author', label: 'Author' },
]

/** A library row: the book, plus the reader's shelf state when it is in their library. */
export interface BookRow {
  bookId: string
  slug: string
  title: string
  author: string
  coverUrl: string | null
  status: W.ShelfStatus | null
  progressPct: number
  updatedAt: number
}

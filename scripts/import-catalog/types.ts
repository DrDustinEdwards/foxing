// Postgres row types matching the live schema verified by Stage 0 (2026-07-07).
// Dropped columns (no D1 target): series_position, last_edited_at, last_edited_by.

export type SqlVal = string | number | null

// Shared output format written by stage1, consumed by stage2 and stage4.
export interface ExtractedData {
  extractedAt: string
  counts: Record<string, number>
  books: Record<string, SqlVal>[]
  bookAwards: Record<string, SqlVal>[]
  externalBookClubs: Record<string, SqlVal>[]
  externalBookClubPicks: Record<string, SqlVal>[]
  bookOfTheMonth: Record<string, SqlVal>[]
  journalPosts: Record<string, SqlVal>[]
  journalPostVersions: Record<string, SqlVal>[]
}

export interface PgBook {
  id: string
  gutenberg_id: number | null
  title: string
  author: string
  author_slug: string | null
  slug: string
  description: string | null
  cover_url: string | null
  epub_url: string | null
  source: string
  source_type: string
  external_url: string | null
  language: string
  subjects: string[] | null     // text[] in Postgres -> JS array
  themes: string[] | null
  mood_tags: string[] | null
  content_warnings: string[] | null
  pacing: string | null
  reading_difficulty: number | null
  word_count: number | null
  publication_year: number | null
  publisher: string | null
  country: string | null
  series_name: string | null
  series_order: number | null
  series_position: number | null  // dropped: duplicate of series_order confirmed by Stage 0
  isbn: string | null
  isbn13: string | null
  amazon_url: string | null
  bookshop_url: string | null
  is_staff_pick: boolean
  staff_pick_note: string | null
  weighted_rating: number | null
  rating_count: number
  added_by: string | null         // set to NULL in D1: user space starts empty
  created_at: Date
  updated_at: Date
}

export interface PgBookAward {
  id: string
  book_id: string
  award_slug: string
  award_name: string
  year: number | null
  distinction: string
  scope: string
  country: string | null
  url: string | null
  created_at: Date
}

export interface PgExternalBookClub {
  id: string
  slug: string
  name: string
  short_name: string
  description: string | null
  curator: string | null
  website_url: string | null
  logo_url: string | null
  cadence: string | null
  focus: string | null
  eras: string[] | null      // jsonb in Postgres -> pg returns parsed JS array
  sort_order: number
  is_active: boolean
  created_at: Date
}

export interface PgExternalBookClubPick {
  id: string
  club_id: string
  book_id: string | null
  picked_at: string | null   // DATE in Postgres -> pg returns 'YYYY-MM-DD' string
  pick_month: number | null
  pick_year: number | null
  category: string | null
  official_url: string | null
  notes: string | null
  curator_quote: string | null
  era_label: string | null
  era_start_year: number | null
  era_end_year: number | null
  auto_source: string | null
  auto_confidence: string | null  // TEXT: 'high'|'medium'|'low'|null -> real in D1
  is_auto_discovered: boolean
  is_published: boolean
  created_at: Date
  updated_at: Date
  // last_edited_at, last_edited_by: present in Postgres, dropped (no D1 target)
}

export interface PgBookOfTheMonth {
  id: string
  book_id: string | null
  year: number
  month: number
  category: string | null
  curator_note: string | null
  amazon_url: string | null
  bookshop_url: string | null
  is_published: boolean
  created_at: Date
}

export interface PgJournalPost {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  cover_image_url: string | null
  cover_image_alt: string | null
  author_id: string | null   // set to NULL in D1: user space starts empty
  tags: string[] | null      // text[] in Postgres -> JS array
  featured: boolean
  is_published: boolean
  published_at: Date | null
  show_published_at: boolean
  show_updated_at: boolean
  og_title: string | null
  og_description: string | null
  canonical_url: string | null
  reading_time_minutes: number | null
  created_at: Date
  updated_at: Date
}

export interface PgJournalPostVersion {
  id: string
  post_id: string
  title: string
  content: string
  excerpt: string | null
  saved_at: Date
  saved_by: string | null    // set to NULL in D1: user space starts empty
}

export interface PgJournalPostLink {
  id: string
  source_id: string
  target_id: string
  position: number
  created_at: Date
}

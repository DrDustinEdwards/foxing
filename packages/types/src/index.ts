// Shared database shapes used by both mobile and web. The schema is the
// source of truth in Supabase; these types are hand-maintained mirrors.
// When adding columns, update both this file and the consumers.

export type SubscriptionTier = 'free' | 'plus' | 'patron'

export type ReadingStatus =
  | 'reading'
  | 'want_to_read'
  | 'finished'
  | 'paused'
  | 'abandoned'

export type Privacy = 'public' | 'close_friends' | 'private'

export interface Book {
  id: string
  slug: string | null
  title: string
  author: string
  description: string | null
  cover_url: string | null
  epub_url: string | null
  source: 'standard_ebooks' | 'gutenberg'
  mood_tags: string[] | null
  pacing: 'slow' | 'medium' | 'fast' | null
  content_warnings: Record<string, string[]> | null
  is_staff_pick: boolean
  staff_pick_note: string | null
  weighted_rating: number | null
  raw_rating: number | null
  rating_count: number
  created_at: string
}

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  reading_personality: string | null
  is_public: boolean
  is_admin: boolean
  subscription_tier: SubscriptionTier
  backdrop_url: string | null
  favorite_genres: string[] | null
  created_at: string
}

export interface UserBook {
  id: string
  user_id: string
  book_id: string
  status: ReadingStatus
  rating: number | null
  rating_half: number | null
  review: string | null
  review_is_public: boolean
  mood_tags: string[] | null
  pacing: string | null
  format_read: 'print' | 'audio' | 'ebook' | 'unknown' | null
  edition_read: string | null
  date_started: string | null
  date_finished: string | null
  paused_at: string | null
  paused_note: string | null
  created_at: string
}

export interface Highlight {
  id: string
  user_id: string
  book_id: string
  text: string
  cfi: string | null
  color: string
  note: string | null
  is_public: boolean
  created_at: string
}

export interface Club {
  id: string
  name: string
  description: string | null
  cover_url: string | null
  is_public: boolean
  created_by: string
  current_book_id: string | null
  created_at: string
}

export interface DiaryEntry {
  id: string
  user_id: string
  book_id: string
  log_date: string
  rating_half: number | null
  review: string | null
  privacy: Privacy
  is_draft: boolean
  is_reread: boolean
  created_at: string
}

export interface UserFavorite {
  user_id: string
  book_id: string
  position: number
}

export interface ReadingList {
  id: string
  user_id: string
  title: string
  description: string | null
  is_public: boolean
  is_featured: boolean
  created_at: string
}

export interface JournalPost {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  cover_image_url: string | null
  author_id: string | null
  is_published: boolean
  published_at: string | null
  tags: string[] | null
  created_at: string
}

export interface Badge {
  id: string
  slug: string
  name: string
  description: string
  icon: string
}

export interface ChapterReaction {
  id: string
  user_id: string
  book_id: string
  chapter_name: string | null
  emoji: string
  note: string | null
  privacy: Privacy
  created_at: string
}

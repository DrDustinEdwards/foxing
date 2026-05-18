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
  slug: string
  author_slug: string
  title: string
  author: string
  description?: string | null
  cover_url?: string | null
  epub_url?: string | null
  source: string
  source_type?: string | null
  language?: string | null
  subjects?: string[]
  themes?: string[]
  mood_tags?: string[]
  pacing?: string | null
  content_warnings?: string[]
  word_count?: number | null
  series_name?: string | null
  series_order?: number | null
  series_position?: number | null
  country?: string | null
  is_staff_pick?: boolean
  staff_pick_note?: string | null
  weighted_rating?: number | null
  raw_rating?: number | null
  rating_count?: number
  isbn?: string | null
  isbn13?: string | null
  publication_year?: number | null
  publisher?: string | null
  external_url?: string | null
  amazon_url?: string | null
  bookshop_url?: string | null
  added_by?: string | null
  updated_at?: string | null
  created_at?: string
}

export interface BookOfMonth {
  id: string
  book_id: string
  year: number
  month: number
  category?: string | null
  curator_note?: string | null
  amazon_url?: string | null
  bookshop_url?: string | null
  is_published: boolean
  created_at?: string
}

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
  backdrop_url?: string | null
  bio?: string | null
  reading_personality?: string | null
  favorite_genres?: string[]
  is_public: boolean
  is_admin?: boolean
  is_suspended?: boolean
  is_verified_author?: boolean
  is_verified_educator?: boolean
  subscription_tier?: SubscriptionTier | string | null
  total_books_read?: number
  total_highlights?: number
  xp_points?: number
  reading_level?: string | null
  created_at?: string
  updated_at?: string | null
}

export interface UserBook {
  id: string
  user_id: string
  book_id: string
  status: ReadingStatus
  rating?: number | null
  rating_half?: number | null
  review?: string | null
  review_is_public?: boolean
  review_likes?: number
  mood_tags?: string[]
  pacing?: string | null
  format_read?: string | null
  edition_read?: string | null
  is_favorite?: boolean
  personal_notes?: string | null
  paused_note?: string | null
  progress_cfi?: string | null
  progress_percentage?: number | null
  started_at?: string | null
  finished_at?: string | null
  date_started?: string | null
  date_finished?: string | null
  abandoned_at?: string | null
  paused_at?: string | null
  updated_at?: string | null
  created_at?: string
}

export interface Highlight {
  id: string
  user_id: string
  book_id: string
  text: string
  cfi?: string | null
  color?: string | null
  note?: string | null
  chapter?: string | null
  is_public: boolean
  like_count?: number
  created_at?: string
  updated_at?: string | null
}

export interface Club {
  id: string
  slug?: string | null
  name: string
  description?: string | null
  cover_url?: string | null
  creator_id?: string | null
  current_book_id?: string | null
  visibility: 'public' | 'private' | 'secret'
  member_count?: number
  member_approval?: boolean
  max_members?: number | null
  reading_pace?: string | null
  chapters_per_week?: number | null
  genre_tags?: string[]
  is_public?: boolean
  created_by?: string
  created_at?: string
  updated_at?: string | null
}

export interface ReadingList {
  id: string
  user_id: string
  slug?: string | null
  title: string
  description?: string | null
  is_public: boolean
  is_featured?: boolean
  cover_url?: string | null
  like_count?: number
  created_at?: string
  updated_at?: string | null
}

export interface DiaryEntry {
  id: string
  user_id: string
  book_id: string
  slug?: string | null
  log_date: string
  rating_half?: number | null
  review?: string | null
  privacy: Privacy
  is_draft?: boolean
  is_reread?: boolean
  created_at?: string
  updated_at?: string | null
}

export interface JournalPost {
  id: string
  title: string
  slug: string
  content: string
  excerpt?: string | null
  cover_image_url?: string | null
  author_id?: string | null
  author_name?: string | null
  is_published: boolean
  published_at?: string | null
  tags?: string[]
  created_at?: string
  updated_at?: string | null
}

export interface BookAICache {
  id: string
  book_id: string
  action: string
  content: string
  created_at?: string
  updated_at?: string | null
}

export interface UserFavorite {
  user_id: string
  book_id: string
  position: number
}

export interface ReadingGoal {
  id: string
  user_id: string
  year: number
  target: number
  type: 'books' | 'pages'
}

export interface ReadingStreak {
  user_id: string
  current_streak: number
  longest_streak: number
  last_read_date?: string | null
  updated_at?: string | null
}

export interface ExternalBookClub {
  id: string
  slug: string
  name: string
  short_name: string
  description?: string | null
  curator?: string | null
  website_url?: string | null
  logo_url?: string | null
  cadence?: string | null
  focus?: string | null
  sort_order?: number
  is_active?: boolean
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

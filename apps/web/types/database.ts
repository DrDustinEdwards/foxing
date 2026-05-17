/**
 * Web-specific database types. Re-exports the shared shapes from
 * @foxing/types and adds shapes that only the web platform needs
 * (club discussions, reviews-as-derived-rows, journal authoring, etc.).
 */

export type {
  SubscriptionTier,
  ReadingStatus,
  Privacy,
  Book,
  Profile,
  UserBook,
  Highlight,
  Club,
  DiaryEntry,
  UserFavorite,
  ReadingList,
  JournalPost,
  Badge,
  ChapterReaction,
} from '@foxing/types'

export interface ClubMember {
  club_id: string
  user_id: string
  role: 'owner' | 'moderator' | 'member'
  joined_at: string
}

export interface ClubThread {
  id: string
  club_id: string
  title: string
  chapter_locked: number | null
  created_at: string
}

export interface ClubPost {
  id: string
  thread_id: string
  author_id: string
  content: string
  is_public: boolean
  created_at: string
}

export interface ReadingListBook {
  list_id: string
  book_id: string
  position: number
}

export interface ReadingGoal {
  user_id: string
  year: number
  target: number
  type: 'books' | 'pages'
}

export interface ReadingStreak {
  user_id: string
  current_streak: number
  longest_streak: number
  last_read_date: string | null
}

export interface UserBadge {
  user_id: string
  badge_id: string
  earned_at: string
}

export interface Follow {
  follower_id: string
  following_id: string
  created_at: string
}

/**
 * A review is a user_books row with a non-null review string. The web
 * surfaces this projection often enough that it deserves a named type.
 */
export interface Review {
  id: string
  user_id: string
  book_id: string
  rating_half: number | null
  review: string
  mood_tags: string[] | null
  pacing: string | null
  created_at: string
  /** Joined from profiles for review-card rendering. */
  author?: {
    username: string
    display_name: string
    avatar_url: string | null
  }
}

export interface PostReport {
  id: string
  post_id: string
  post_type: string
  reporter_id: string
  reason: string
  status: 'pending' | 'dismissed' | 'actioned'
  created_at: string
}

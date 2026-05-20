export type ReactionPrivacy = 'public' | 'close_friends' | 'private'

export const REACTION_EMOJIS = ['😭', '😂', '😱', '😤', '🥺', '🤯', '❤️', '🙃'] as const
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

export interface ChapterReaction {
  id: string
  user_id: string
  book_id: string
  chapter_name: string
  emoji: string
  note: string | null
  privacy: ReactionPrivacy
  created_at: string
}

export interface PublicChapterReaction extends ChapterReaction {
  author: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

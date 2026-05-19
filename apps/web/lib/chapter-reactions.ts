import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

export async function fetchOwnChapterReactions(
  userId: string,
  bookId: string,
): Promise<ChapterReaction[]> {
  const sb = createClient()
  const { data } = await sb
    .from('chapter_reactions')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
  return (data as ChapterReaction[] | null) ?? []
}

export async function fetchPublicChapterReactions(
  bookId: string,
  limit = 20,
): Promise<PublicChapterReaction[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('chapter_reactions')
    .select(
      '*, author:user_id(username, display_name, avatar_url)',
    )
    .eq('book_id', bookId)
    .eq('privacy', 'public')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as unknown as PublicChapterReaction[] | null) ?? []
}

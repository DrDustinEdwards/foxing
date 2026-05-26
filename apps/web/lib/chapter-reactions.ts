import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  ChapterReaction,
  PublicChapterReaction,
} from '@/lib/chapter-reactions-types'

export {
  REACTION_EMOJIS,
  type ReactionPrivacy,
  type ReactionEmoji,
  type ChapterReaction,
  type PublicChapterReaction,
} from '@/lib/chapter-reactions-types'

export async function fetchOwnChapterReactions(
  userId: string,
  bookId: string,
): Promise<ChapterReaction[]> {
  const sb = await createClient()
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

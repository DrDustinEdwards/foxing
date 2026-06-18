import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { reportWriteError } from '@/lib/db-write'

// activity_events.type is free text (no DB check); these are the namespaced
// types the feed knows how to render.
export type ActivityType =
  | 'finished_book'
  | 'started_book'
  | 'rated_book'
  | 'reviewed_book'
  | 'highlighted'
  | 'joined_club'
  | 'hit_streak_milestone'
  | 'finished_goal'

export type ActivityVisibility = 'public' | 'followers' | 'private'

// A private profile shouldn't broadcast; default everyone else to public.
export async function resolveActivityVisibility(
  client: SupabaseClient,
  userId: string,
): Promise<ActivityVisibility> {
  const { data } = await client
    .from('profiles')
    .select('is_public')
    .eq('id', userId)
    .maybeSingle()
  const isPublic = (data as { is_public: boolean | null } | null)?.is_public
  return isPublic === false ? 'private' : 'public'
}

// Best-effort emit -- a failed activity insert must never break the source
// action. Pass a client that can write the row for user_id (the admin client
// when the actor differs from the authed caller, e.g. approving a member).
export async function emitActivity(
  client: SupabaseClient,
  params: {
    userId: string
    type: ActivityType
    bookId?: string | null
    targetId?: string | null
    data?: Record<string, unknown>
    visibility?: ActivityVisibility
  },
): Promise<void> {
  const { error } = await client.from('activity_events').insert({
    user_id: params.userId,
    type: params.type,
    book_id: params.bookId ?? null,
    target_id: params.targetId ?? null,
    data: params.data ?? {},
    visibility: params.visibility ?? 'public',
  })
  reportWriteError(error, { op: `emitActivity.${params.type}`, table: 'activity_events' })
}

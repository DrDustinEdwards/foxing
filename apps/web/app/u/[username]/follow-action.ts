'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function toggleFollow(opts: {
  targetUserId: string
  username: string
  isFollowing: boolean
}) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false as const, error: 'unauthenticated' }
  if (user.id === opts.targetUserId) {
    return { ok: false as const, error: 'cannot-follow-self' }
  }

  if (opts.isFollowing) {
    await sb
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', opts.targetUserId)
  } else {
    await sb
      .from('follows')
      .upsert(
        { follower_id: user.id, following_id: opts.targetUserId },
        { onConflict: 'follower_id,following_id' },
      )
  }
  revalidatePath(`/u/${opts.username}`)
  return { ok: true as const, isFollowing: !opts.isFollowing }
}

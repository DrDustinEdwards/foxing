'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/nav-user'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function addCloseFriend(
  formData: FormData,
): Promise<ActionResult> {
  const friendId = String(formData.get('friend_id') ?? '').trim()
  if (!friendId) return { ok: false, error: 'Missing user.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  if (friendId === userId) {
    return { ok: false, error: 'You cannot add yourself.' }
  }
  const sb = createClient()
  const { data: follow } = await sb
    .from('follows')
    .select('follower_id')
    .eq('follower_id', userId)
    .eq('following_id', friendId)
    .maybeSingle()
  if (!follow) {
    return { ok: false, error: 'You can only add people you follow.' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('close_friends')
    .upsert(
      { user_id: userId, friend_id: friendId },
      { onConflict: 'user_id,friend_id', ignoreDuplicates: true },
    )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings')
  return { ok: true }
}

export async function removeCloseFriend(
  formData: FormData,
): Promise<ActionResult> {
  const friendId = String(formData.get('friend_id') ?? '').trim()
  if (!friendId) return { ok: false, error: 'Missing user.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('close_friends')
    .delete()
    .eq('user_id', userId)
    .eq('friend_id', friendId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings')
  return { ok: true }
}

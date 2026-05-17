// Close friends, a private list of followers the user trusts. Used as the
// middle privacy tier between Public and Private for highlights, reviews,
// and chapter reactions per task.md Section H3.

import { supabase } from './supabase'

export interface CloseFriendProfile {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

export async function getCloseFriends(userId: string): Promise<CloseFriendProfile[]> {
  const { data, error } = await supabase
    .from('close_friends')
    .select('friend:profiles!friend_id(id, display_name, username, avatar_url)')
    .eq('user_id', userId)
  if (error) {
    console.warn('[close-friends] getCloseFriends failed:', error.message)
    return []
  }
  type Row = {
    friend:
      | CloseFriendProfile
      | Array<CloseFriendProfile>
      | null
  }
  const out: CloseFriendProfile[] = []
  for (const r of ((data ?? []) as unknown) as Row[]) {
    const f = Array.isArray(r.friend) ? r.friend[0] ?? null : r.friend
    if (f) out.push(f)
  }
  return out
}

export async function addCloseFriend(userId: string, friendId: string): Promise<boolean> {
  const { error } = await supabase
    .from('close_friends')
    .insert({ user_id: userId, friend_id: friendId })
  if (error && !error.message.includes('duplicate key')) {
    console.warn('[close-friends] addCloseFriend failed:', error.message)
    return false
  }
  return true
}

export async function removeCloseFriend(userId: string, friendId: string): Promise<boolean> {
  const { error } = await supabase
    .from('close_friends')
    .delete()
    .eq('user_id', userId)
    .eq('friend_id', friendId)
  if (error) {
    console.warn('[close-friends] removeCloseFriend failed:', error.message)
    return false
  }
  return true
}

export async function isCloseFriend(userId: string, friendId: string): Promise<boolean> {
  const { data } = await supabase
    .from('close_friends')
    .select('friend_id')
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .maybeSingle()
  return !!data
}

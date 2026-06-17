import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

// @mentions: @ followed by a username (lowercase letters/digits/underscore).
// Foxing usernames are stored lowercase, so handles are lowercased to match.
const MENTION_RE = /@([a-z0-9_]{2,30})/gi

export function extractMentionHandles(content: string): string[] {
  const out = new Set<string>()
  for (const m of content.matchAll(MENTION_RE)) {
    out.add(m[1].toLowerCase())
  }
  return [...out]
}

/**
 * Resolve @handles to active members of the club, excluding the actor.
 * False-positive handles (non-users, non-members) are dropped because they
 * match no profile / membership row.
 */
export async function resolveMentionedMembers(
  admin: SupabaseClient,
  clubId: string,
  handles: string[],
  excludeUserId: string,
): Promise<Array<{ user_id: string; username: string }>> {
  if (handles.length === 0) return []
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, username')
    .in('username', handles)
  const profRows =
    ((profiles as { id: string; username: string }[] | null) ?? []).filter(
      (p) => p.id !== excludeUserId,
    )
  if (profRows.length === 0) return []
  const { data: members } = await admin
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('status', 'active')
    .in(
      'user_id',
      profRows.map((p) => p.id),
    )
  const memberIds = new Set(
    ((members as { user_id: string }[] | null) ?? []).map((m) => m.user_id),
  )
  return profRows
    .filter((p) => memberIds.has(p.id))
    .map((p) => ({ user_id: p.id, username: p.username }))
}

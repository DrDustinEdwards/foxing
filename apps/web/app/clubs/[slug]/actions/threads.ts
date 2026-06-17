'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/nav-user'
import {
  extractMentionHandles,
  resolveMentionedMembers,
} from '@/lib/club-notify'

type NewThreadResult =
  | { ok: true; threadId: string }
  | { ok: false; error: string }

/**
 * Start a club discussion thread + its opening post. Gated on an ACTIVE
 * club_members row (the Discord IDOR fix pattern). Write columns are the
 * verified ones, NOT the mobile-drift names:
 *   club_threads: author_id, title, chapter, has_spoilers
 *   club_posts:   author_id, content, has_spoiler
 */
export async function createClubThread(
  formData: FormData,
): Promise<NewThreadResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim().slice(0, 200)
  const chapter = String(formData.get('chapter') ?? '').trim().slice(0, 80) || null
  const content = String(formData.get('content') ?? '').trim().slice(0, 5000)
  const hasSpoilers = formData.get('has_spoilers') === 'on'
  if (!clubId) return { ok: false, error: 'Missing club.' }
  if (!title) return { ok: false, error: 'A title is required.' }
  if (!content) return { ok: false, error: 'Write an opening post.' }

  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }

  const sb = await createClient()
  const { data: member } = await sb
    .from('club_members')
    .select('status')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!member || (member as { status: string | null }).status !== 'active') {
    return { ok: false, error: 'Only active members can start a thread.' }
  }

  const { data: threadRow, error: threadErr } = await sb
    .from('club_threads')
    .insert({
      club_id: clubId,
      author_id: userId,
      title,
      chapter,
      has_spoilers: hasSpoilers,
    })
    .select('id')
    .single()
  if (threadErr || !threadRow) {
    return { ok: false, error: threadErr?.message ?? 'Could not create thread.' }
  }
  const threadId = (threadRow as { id: string }).id

  const { error: postErr } = await sb.from('club_posts').insert({
    thread_id: threadId,
    author_id: userId,
    content,
    has_spoiler: hasSpoilers,
  })
  if (postErr) return { ok: false, error: postErr.message }

  const { data: club } = await sb
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const slug = (club as { slug: string | null } | null)?.slug

  // Notify @mentioned active members in the opening post.
  const admin = createAdminClient()
  const mentioned = await resolveMentionedMembers(
    admin,
    clubId,
    extractMentionHandles(content),
    userId,
  )
  if (mentioned.length > 0) {
    const { data: actor } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()
    const actorName =
      (actor as { display_name: string | null } | null)?.display_name ??
      'A member'
    const href = slug ? `/clubs/${slug}/threads/${threadId}` : undefined
    await admin.from('notifications').insert(
      mentioned.map((m) => ({
        user_id: m.user_id,
        type: 'club_mention',
        title: `${actorName} mentioned you`,
        body: content.slice(0, 140),
        data: {
          club_id: clubId,
          club_slug: slug ?? null,
          thread_id: threadId,
          ...(href ? { href } : {}),
        },
      })),
    )
  }

  if (slug) revalidatePath(`/clubs/${slug}`)
  return { ok: true, threadId }
}

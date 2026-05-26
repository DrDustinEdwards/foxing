'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type ActionResult =
  | { ok: true; liked: boolean; likeCount: number }
  | { ok: false; error: string }

export async function toggleReadingListLike(opts: {
  listId: string
}): Promise<ActionResult> {
  const id = opts.listId.trim()
  if (!id) return { ok: false, error: 'Missing list id.' }

  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  const { data: list } = await sb
    .from('reading_lists')
    .select('id, slug, user_id, is_public, like_count')
    .eq('id', id)
    .maybeSingle()
  if (!list) return { ok: false, error: 'List not found.' }
  const row = list as {
    id: string
    slug: string | null
    user_id: string
    is_public: boolean | null
    like_count: number | null
  }
  if (!row.is_public) {
    return { ok: false, error: 'List is not public.' }
  }
  const currentCount = row.like_count ?? 0

  const { data: existing } = await sb
    .from('reading_list_likes')
    .select('list_id')
    .eq('user_id', user.id)
    .eq('list_id', id)
    .maybeSingle()

  if (existing) {
    const { error: delErr } = await sb
      .from('reading_list_likes')
      .delete()
      .eq('user_id', user.id)
      .eq('list_id', id)
    if (delErr) return { ok: false, error: delErr.message }
    // trg_reading_list_like_count on reading_list_likes updates reading_lists.like_count.
    const next = Math.max(0, currentCount - 1)
    revalidatePath('/lists')
    if (row.slug) {
      revalidatePath(`/u/[username]/lists/${row.slug}`, 'page')
    }
    return { ok: true, liked: false, likeCount: next }
  } else {
    const { error: insErr } = await sb
      .from('reading_list_likes')
      .insert({ user_id: user.id, list_id: id })
    if (insErr) return { ok: false, error: insErr.message }
    const next = currentCount + 1
    revalidatePath('/lists')
    if (row.slug) {
      revalidatePath(`/u/[username]/lists/${row.slug}`, 'page')
    }
    return { ok: true, liked: true, likeCount: next }
  }
}

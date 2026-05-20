'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type ActionResult =
  | { ok: true; liked: boolean; likeCount: number }
  | { ok: false; error: string }

export async function toggleHighlightLike(opts: {
  highlightId: string
}): Promise<ActionResult> {
  const id = opts.highlightId.trim()
  if (!id) return { ok: false, error: 'Missing highlight id.' }

  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  const { data: existing } = await sb
    .from('highlight_likes')
    .select('post_id')
    .eq('user_id', user.id)
    .eq('post_id', id)
    .maybeSingle()

  const { data: countRow } = await sb
    .from('highlights')
    .select('like_count')
    .eq('id', id)
    .maybeSingle()
  const currentCount = (countRow as { like_count: number | null } | null)?.like_count ?? 0

  if (existing) {
    const { error: delErr } = await sb
      .from('highlight_likes')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', id)
    if (delErr) return { ok: false, error: delErr.message }
    const next = Math.max(0, currentCount - 1)
    await sb.from('highlights').update({ like_count: next }).eq('id', id)
    revalidatePath(`/quotes/${id}`)
    revalidatePath('/quotes')
    return { ok: true, liked: false, likeCount: next }
  } else {
    const { error: insErr } = await sb
      .from('highlight_likes')
      .insert({ user_id: user.id, post_id: id })
    if (insErr) return { ok: false, error: insErr.message }
    const next = currentCount + 1
    await sb.from('highlights').update({ like_count: next }).eq('id', id)
    revalidatePath(`/quotes/${id}`)
    revalidatePath('/quotes')
    return { ok: true, liked: true, likeCount: next }
  }
}

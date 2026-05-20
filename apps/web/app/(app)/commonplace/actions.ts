'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthedUserId } from '@/lib/nav-user'

// Note: there are two tables for this concept (commonplace_book and
// commonplace_entries). commonplace_book is canonical. Do not write to
// commonplace_entries.

type ActionResult = { ok: true } | { ok: false; error: string }

export async function addCommonplaceEntry(formData: FormData): Promise<ActionResult> {
  const passage = String(formData.get('passage_text') ?? '').trim()
  const bookId = String(formData.get('book_id') ?? '').trim() || null
  const bookTitle = String(formData.get('book_title') ?? '').trim() || null
  const note = String(formData.get('note') ?? '').trim() || null
  const isPublic = formData.get('is_public') === 'on'
  if (!passage) return { ok: false, error: 'Passage is required.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = createClient()
  const { error } = await sb.from('commonplace_book').insert({
    user_id: userId,
    passage_text: passage.slice(0, 5000),
    book_id: bookId,
    book_title: bookTitle,
    note,
    is_public: isPublic,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/commonplace')
  return { ok: true }
}

export async function deleteCommonplaceEntry(
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { ok: false, error: 'Missing id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = createClient()
  const { error } = await sb
    .from('commonplace_book')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/commonplace')
  return { ok: true }
}

export async function toggleCommonplacePrivacy(
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { ok: false, error: 'Missing id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = createClient()
  const { data: row } = await sb
    .from('commonplace_book')
    .select('is_public')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  const current = (row as { is_public: boolean | null } | null)?.is_public ?? false
  const { error } = await sb
    .from('commonplace_book')
    .update({ is_public: !current })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/commonplace')
  return { ok: true }
}

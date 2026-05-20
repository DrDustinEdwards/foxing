'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthedUserId } from '@/lib/nav-user'

type ActionResult = { ok: true } | { ok: false; error: string }

const VALID_STATUS = new Set([
  'reading',
  'want_to_read',
  'finished',
  'paused',
  'abandoned',
])

export async function addBookToLibrary(formData: FormData): Promise<ActionResult> {
  const bookId = String(formData.get('book_id') ?? '').trim()
  const statusRaw = String(formData.get('status') ?? 'want_to_read').trim()
  const status = VALID_STATUS.has(statusRaw) ? statusRaw : 'want_to_read'
  if (!bookId) return { ok: false, error: 'Missing book.' }

  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }

  const sb = createClient()
  const { error } = await sb.from('user_books').upsert(
    { user_id: userId, book_id: bookId, status },
    { onConflict: 'user_id,book_id' },
  )
  if (error) return { ok: false, error: error.message }

  revalidatePath('/library')
  return { ok: true }
}

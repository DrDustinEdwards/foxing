'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

interface LogEntryInput {
  book_id: string
  log_date: string
  rating_half: number | null
  review: string | null
  privacy: 'private' | 'friends' | 'public'
}

export async function logDiaryEntry(input: LogEntryInput) {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false as const, error: 'unauthenticated' }

  if (!input.book_id || !input.log_date) {
    return { ok: false as const, error: 'missing-fields' }
  }
  const ratingHalf =
    typeof input.rating_half === 'number' &&
    input.rating_half >= 0 &&
    input.rating_half <= 10
      ? input.rating_half
      : null
  const privacy = ['private', 'friends', 'public'].includes(input.privacy)
    ? input.privacy
    : 'private'

  const { error } = await sb.from('diary_entries').insert({
    user_id: user.id,
    book_id: input.book_id,
    log_date: input.log_date,
    rating_half: ratingHalf,
    review: input.review?.trim() || null,
    privacy,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/diary')
  return { ok: true as const }
}

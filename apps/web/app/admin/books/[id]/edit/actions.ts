'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function updateBook(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'missing id' }
  const title = String(formData.get('title') ?? '').trim()
  const author = String(formData.get('author') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const cover_url = String(formData.get('cover_url') ?? '').trim() || null
  const themesRaw = String(formData.get('themes') ?? '').trim()
  const themes =
    themesRaw.length > 0
      ? themesRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : null
  const reading_difficulty_raw = String(formData.get('reading_difficulty') ?? '')
  const reading_difficulty = reading_difficulty_raw
    ? Number(reading_difficulty_raw)
    : null
  const word_count_raw = String(formData.get('word_count') ?? '')
  const word_count = word_count_raw ? Number(word_count_raw) : null

  const admin = createAdminClient()
  await admin
    .from('books')
    .update({
      title,
      author,
      description,
      cover_url,
      themes,
      reading_difficulty,
      word_count,
    })
    .eq('id', id)

  revalidatePath(`/admin/books/${id}/edit`)
  revalidatePath(`/book/${id}`)
  return { ok: true }
}

export async function clearAiCache(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'missing id' }
  const admin = createAdminClient()
  await admin.from('book_ai_cache').delete().eq('book_id', id)
  revalidatePath(`/admin/books/${id}/edit`)
  revalidatePath(`/book/${id}`)
  return { ok: true }
}

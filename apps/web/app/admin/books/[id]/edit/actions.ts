'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

function parseJsonArray(raw: FormDataEntryValue | null): string[] | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const cleaned = parsed
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean)
    return cleaned.length > 0 ? cleaned : null
  } catch {
    return null
  }
}

const ALLOWED_PACING = ['slow', 'medium', 'fast'] as const

export async function updateBook(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'missing id' }
  const title = String(formData.get('title') ?? '').trim()
  const author = String(formData.get('author') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const cover_url = String(formData.get('cover_url') ?? '').trim() || null
  const isbn = String(formData.get('isbn') ?? '').trim() || null
  const isbn13 = String(formData.get('isbn13') ?? '').trim() || null
  const pubYearRaw = String(formData.get('publication_year') ?? '').trim()
  const publication_year = pubYearRaw ? Number(pubYearRaw) : null
  const themes = parseJsonArray(formData.get('themes_json'))
  const mood_tags = parseJsonArray(formData.get('mood_tags_json'))
  const content_warnings = parseJsonArray(formData.get('content_warnings_json'))
  const pacingRaw = String(formData.get('pacing') ?? '').trim()
  const pacing =
    pacingRaw && (ALLOWED_PACING as readonly string[]).includes(pacingRaw)
      ? pacingRaw
      : null
  const is_staff_pick = formData.get('is_staff_pick') === 'on'
  const staff_pick_note =
    String(formData.get('staff_pick_note') ?? '').trim() || null
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
      mood_tags,
      content_warnings,
      pacing,
      is_staff_pick,
      staff_pick_note: is_staff_pick ? staff_pick_note : null,
      isbn,
      isbn13,
      publication_year,
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

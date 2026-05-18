'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

interface CreatePayload {
  club_id: string
  book_id: string
  pick_month: number
  pick_year: number
  category: string | null
  official_url: string | null
  notes: string | null
  is_published: boolean
}

function parseCreate(formData: FormData): CreatePayload {
  const club_id = String(formData.get('club_id') ?? '').trim()
  const book_id = String(formData.get('book_id') ?? '').trim()
  const pick_year = Number(formData.get('pick_year') ?? 0)
  const pick_month = Number(formData.get('pick_month') ?? 0)
  const category = String(formData.get('category') ?? '').trim() || null
  const official_url = String(formData.get('official_url') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 500) || null
  const is_published = formData.get('is_published') === 'on'
  return {
    club_id,
    book_id,
    pick_month,
    pick_year,
    category,
    official_url,
    notes,
    is_published,
  }
}

export async function createCelebrityPick(formData: FormData): Promise<void> {
  const payload = parseCreate(formData)
  if (
    !payload.club_id ||
    !payload.book_id ||
    !payload.pick_year ||
    !payload.pick_month
  ) {
    throw new Error('club, book, month, and year are required')
  }
  const picked_at = `${payload.pick_year}-${String(payload.pick_month).padStart(2, '0')}-01`
  const admin = createAdminClient()
  const { error } = await admin.from('external_book_club_picks').insert({
    club_id: payload.club_id,
    book_id: payload.book_id,
    picked_at,
    pick_month: payload.pick_month,
    pick_year: payload.pick_year,
    category: payload.category,
    official_url: payload.official_url,
    notes: payload.notes,
    is_published: payload.is_published,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/celebrity-picks')
  revalidatePath('/book-clubs')
  redirect('/admin/celebrity-picks')
}

export async function deleteCelebrityPick(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim()
  if (!id) throw new Error('id is required')
  const admin = createAdminClient()
  await admin.from('external_book_club_picks').delete().eq('id', id)
  revalidatePath('/admin/celebrity-picks')
  revalidatePath('/book-clubs')
}

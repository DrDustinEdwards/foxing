'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

interface SavePayload {
  id?: string
  book_id: string
  year: number
  month: number
  category: string
  curator_note: string | null
  amazon_url: string | null
  bookshop_url: string | null
  is_published: boolean
}

function parsePayload(formData: FormData): SavePayload {
  const id = String(formData.get('id') ?? '').trim() || undefined
  const book_id = String(formData.get('book_id') ?? '').trim()
  const year = Number(formData.get('year') ?? 0)
  const month = Number(formData.get('month') ?? 0)
  const category = String(formData.get('category') ?? 'fiction').trim().toLowerCase()
  const curator_note =
    String(formData.get('curator_note') ?? '').trim().slice(0, 280) || null
  const amazon_url = String(formData.get('amazon_url') ?? '').trim() || null
  const bookshop_url = String(formData.get('bookshop_url') ?? '').trim() || null
  const is_published = formData.get('is_published') === 'on'
  return {
    id,
    book_id,
    year,
    month,
    category,
    curator_note,
    amazon_url,
    bookshop_url,
    is_published,
  }
}

export async function createPick(formData: FormData): Promise<void> {
  const payload = parsePayload(formData)
  if (!payload.book_id || !payload.year || !payload.month) {
    throw new Error('book_id, year, and month are required')
  }
  const admin = createAdminClient()
  const { error } = await admin.from('book_of_the_month').insert({
    book_id: payload.book_id,
    year: payload.year,
    month: payload.month,
    category: payload.category,
    curator_note: payload.curator_note,
    amazon_url: payload.amazon_url,
    bookshop_url: payload.bookshop_url,
    is_published: payload.is_published,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/book-of-month')
  revalidatePath('/book-of-the-month')
  revalidatePath(`/book-of-the-month/${payload.year}/${payload.month}`)
  redirect('/admin/book-of-month')
}

export async function updatePick(formData: FormData): Promise<void> {
  const payload = parsePayload(formData)
  if (!payload.id) throw new Error('id is required')
  const admin = createAdminClient()
  const { error } = await admin
    .from('book_of_the_month')
    .update({
      book_id: payload.book_id,
      year: payload.year,
      month: payload.month,
      category: payload.category,
      curator_note: payload.curator_note,
      amazon_url: payload.amazon_url,
      bookshop_url: payload.bookshop_url,
      is_published: payload.is_published,
    })
    .eq('id', payload.id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/book-of-month')
  revalidatePath('/book-of-the-month')
  revalidatePath(`/book-of-the-month/${payload.year}/${payload.month}`)
}

export async function deletePick(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim()
  if (!id) throw new Error('id is required')
  const admin = createAdminClient()
  await admin.from('book_of_the_month').delete().eq('id', id)
  revalidatePath('/admin/book-of-month')
  revalidatePath('/book-of-the-month')
  redirect('/admin/book-of-month')
}

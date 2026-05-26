'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthedUserId } from '@/lib/nav-user'

type ActionResult =
  | { ok: true; shelfId?: string }
  | { ok: false; error: string }

const MAX_NAME = 60
const MAX_DESC = 280

function trimName(formData: FormData, key: string, max: number): string {
  return String(formData.get(key) ?? '').trim().slice(0, max)
}

export async function createShelf(formData: FormData): Promise<ActionResult> {
  const name = trimName(formData, 'name', MAX_NAME)
  const description = trimName(formData, 'description', MAX_DESC) || null
  const isPublic = formData.get('is_public') === 'on'
  if (!name) return { ok: false, error: 'Name is required.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { data, error } = await sb
    .from('custom_shelves')
    .insert({
      user_id: userId,
      name,
      description,
      is_public: isPublic,
    })
    .select('id')
    .single()
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Could not create shelf.' }
  }
  revalidatePath('/library')
  revalidatePath('/shelves')
  return { ok: true, shelfId: (data as { id: string }).id }
}

export async function updateShelf(formData: FormData): Promise<ActionResult> {
  const shelfId = String(formData.get('shelf_id') ?? '').trim()
  const name = trimName(formData, 'name', MAX_NAME)
  const description = trimName(formData, 'description', MAX_DESC) || null
  const isPublic = formData.get('is_public') === 'on'
  if (!shelfId || !name) return { ok: false, error: 'Name is required.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { error } = await sb
    .from('custom_shelves')
    .update({ name, description, is_public: isPublic })
    .eq('id', shelfId)
    .eq('user_id', userId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/library')
  revalidatePath('/shelves')
  revalidatePath(`/shelves/${shelfId}`)
  return { ok: true }
}

export async function deleteShelf(formData: FormData): Promise<ActionResult> {
  const shelfId = String(formData.get('shelf_id') ?? '').trim()
  if (!shelfId) return { ok: false, error: 'Missing shelf.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { error } = await sb
    .from('custom_shelves')
    .delete()
    .eq('id', shelfId)
    .eq('user_id', userId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/library')
  revalidatePath('/shelves')
  return { ok: true }
}

export async function toggleBookOnShelf(
  formData: FormData,
): Promise<ActionResult> {
  const shelfId = String(formData.get('shelf_id') ?? '').trim()
  const bookId = String(formData.get('book_id') ?? '').trim()
  const wantAdd = formData.get('add') === 'true'
  if (!shelfId || !bookId) return { ok: false, error: 'Missing input.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = await createClient()
  const { data: shelf } = await sb
    .from('custom_shelves')
    .select('id')
    .eq('id', shelfId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!shelf) return { ok: false, error: 'Shelf not found.' }

  if (wantAdd) {
    const { error } = await sb
      .from('custom_shelf_books')
      .insert({ shelf_id: shelfId, book_id: bookId })
    if (error && !error.message.includes('duplicate')) {
      return { ok: false, error: error.message }
    }
  } else {
    const { error } = await sb
      .from('custom_shelf_books')
      .delete()
      .eq('shelf_id', shelfId)
      .eq('book_id', bookId)
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/library')
  revalidatePath('/shelves')
  revalidatePath(`/shelves/${shelfId}`)
  return { ok: true }
}

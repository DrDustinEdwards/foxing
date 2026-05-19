'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/nav-user'

type ActionResult = { ok: true } | { ok: false; error: string }

async function assertAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()
  if (!(profile as { is_admin: boolean | null } | null)?.is_admin) {
    return { ok: false, error: 'Admin access required.' }
  }
  return { ok: true, userId }
}

export async function toggleVerification(
  formData: FormData,
): Promise<ActionResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  const verified = formData.get('verified') === 'true'
  if (!clubId) return { ok: false, error: 'Missing club id.' }
  const auth = await assertAdmin()
  if (!auth.ok) return auth
  const admin = createAdminClient()
  const update = verified
    ? {
        is_verified: true,
        verified_at: new Date().toISOString(),
        verified_by: auth.userId,
        club_type: 'bookstore',
      }
    : {
        is_verified: false,
        verified_at: null,
        verified_by: null,
      }
  const { error } = await admin.from('clubs').update(update).eq('id', clubId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/bookstores')
  revalidatePath('/clubs')
  return { ok: true }
}

interface BookstorePayload {
  name: string
  bookstore_address: string | null
  bookstore_city: string | null
  bookstore_state: string | null
  bookstore_zip: string | null
  bookstore_website: string | null
  bookstore_phone: string | null
  bookstore_hours: Record<string, string> | null
  club_type: 'reading' | 'bookstore'
}

function parseBookstore(formData: FormData): BookstorePayload {
  const get = (k: string) => String(formData.get(k) ?? '').trim() || null
  const hours: Record<string, string> = {}
  for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
    const v = get(`hours_${day}`)
    if (v) hours[day] = v
  }
  const stateRaw = (get('bookstore_state') ?? '').toUpperCase().slice(0, 2)
  const clubType = String(formData.get('club_type') ?? 'bookstore')
  return {
    name: String(formData.get('name') ?? '').trim(),
    bookstore_address: get('bookstore_address'),
    bookstore_city: get('bookstore_city'),
    bookstore_state: stateRaw || null,
    bookstore_zip: get('bookstore_zip'),
    bookstore_website: get('bookstore_website'),
    bookstore_phone: get('bookstore_phone'),
    bookstore_hours: Object.keys(hours).length > 0 ? hours : null,
    club_type: clubType === 'reading' ? 'reading' : 'bookstore',
  }
}

export async function updateBookstoreProfile(
  formData: FormData,
): Promise<ActionResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!clubId) return { ok: false, error: 'Missing club id.' }
  const auth = await assertAdmin()
  if (!auth.ok) return auth
  const payload = parseBookstore(formData)
  if (!payload.name) return { ok: false, error: 'Bookstore name is required.' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('clubs')
    .update({
      name: payload.name,
      bookstore_address: payload.bookstore_address,
      bookstore_city: payload.bookstore_city,
      bookstore_state: payload.bookstore_state,
      bookstore_zip: payload.bookstore_zip,
      bookstore_website: payload.bookstore_website,
      bookstore_phone: payload.bookstore_phone,
      bookstore_hours: payload.bookstore_hours,
      club_type: payload.club_type,
    })
    .eq('id', clubId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/bookstores')
  return { ok: true }
}

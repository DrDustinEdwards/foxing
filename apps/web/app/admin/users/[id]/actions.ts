'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUserId } from '@/lib/nav-user'

const ALLOWED_TIERS = ['free', 'plus'] as const

export async function updateUserTier(formData: FormData) {
  await requireAdminUserId()
  const id = String(formData.get('id') ?? '')
  const tier = String(formData.get('tier') ?? '')
  if (!id || !(ALLOWED_TIERS as readonly string[]).includes(tier)) return
  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({ subscription_tier: tier })
    .eq('id', id)
  revalidatePath(`/admin/users/${id}`)
}

export async function toggleUserAdmin(formData: FormData) {
  await requireAdminUserId()
  const id = String(formData.get('id') ?? '')
  const next = formData.get('next') === 'true'
  if (!id) return
  const admin = createAdminClient()
  await admin.from('profiles').update({ is_admin: next }).eq('id', id)
  revalidatePath(`/admin/users/${id}`)
}

export async function toggleUserSuspended(formData: FormData) {
  await requireAdminUserId()
  const id = String(formData.get('id') ?? '')
  const next = formData.get('next') === 'true'
  if (!id) return
  const admin = createAdminClient()
  await admin.from('profiles').update({ is_suspended: next }).eq('id', id)
  // Ban the auth user for ~100 years on suspend, clear ban on unsuspend.
  // The auth admin API only takes a duration string and the value 'none'
  // to remove the ban.
  await admin.auth.admin.updateUserById(id, {
    ban_duration: next ? '876600h' : 'none',
  })
  revalidatePath(`/admin/users/${id}`)
}

export async function sendAdminNotification(formData: FormData) {
  await requireAdminUserId()
  const id = String(formData.get('id') ?? '')
  const title = String(formData.get('title') ?? '').trim().slice(0, 120)
  const body = String(formData.get('body') ?? '').trim().slice(0, 500)
  if (!id || !title || !body) {
    throw new Error('title and body required')
  }
  const admin = createAdminClient()
  await admin.from('notifications').insert({
    user_id: id,
    type: 'admin_message',
    title,
    body,
    data: { from: 'admin' },
  })
  revalidatePath(`/admin/users/${id}`)
}

export async function deleteUser(formData: FormData) {
  await requireAdminUserId()
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(id)
  revalidatePath('/admin/users')
  redirect('/admin/users')
}

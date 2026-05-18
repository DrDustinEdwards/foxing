'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_TIERS = ['free', 'plus', 'patron'] as const

export async function updateUserTier(formData: FormData) {
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
  const id = String(formData.get('id') ?? '')
  const next = formData.get('next') === 'true'
  if (!id) return
  const admin = createAdminClient()
  await admin.from('profiles').update({ is_admin: next }).eq('id', id)
  revalidatePath(`/admin/users/${id}`)
}

export async function deleteUser(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(id)
  revalidatePath('/admin/users')
  redirect('/admin/users')
}

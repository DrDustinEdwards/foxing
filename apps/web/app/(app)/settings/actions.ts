'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Settings server actions. All actions require the calling user to be the
 * owner of the row they touch, which the server client guarantees via the
 * session cookie. createAdminClient is only used for the auth-side delete.
 */

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_]{1,28}[a-z0-9])?$/i

type ProfileUpdateResult =
  | { ok: true }
  | { ok: false; error: string; field?: 'display_name' | 'bio' }

export async function updateProfile(
  formData: FormData,
): Promise<ProfileUpdateResult> {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to update your profile.' }

  const displayName = String(formData.get('display_name') ?? '').trim()
  const bio = String(formData.get('bio') ?? '').trim()

  if (!displayName) {
    return { ok: false, error: 'Display name is required.', field: 'display_name' }
  }
  if (displayName.length > 60) {
    return {
      ok: false,
      error: 'Display name must be 60 characters or fewer.',
      field: 'display_name',
    }
  }
  if (bio.length > 200) {
    return { ok: false, error: 'Bio must be 200 characters or fewer.', field: 'bio' }
  }

  const { error } = await sb
    .from('profiles')
    .update({
      display_name: displayName,
      bio: bio || null,
    })
    .eq('id', user.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings')
  // Revalidate public profile route after display_name change.
  const { data: current } = await sb
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()
  const currentUsername = (current as { username: string } | null)?.username
  if (currentUsername) revalidatePath(`/u/${currentUsername}`)
  return { ok: true }
}

type UsernameUpdateResult =
  | { ok: true; username: string }
  | { ok: false; error: string }

export async function updateUsername(
  formData: FormData,
): Promise<UsernameUpdateResult> {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to update your username.' }

  const usernameRaw = String(formData.get('username') ?? '')
    .trim()
    .toLowerCase()
  if (!USERNAME_PATTERN.test(usernameRaw)) {
    return {
      ok: false,
      error: 'Username must be 3 to 30 characters, letters/numbers/underscore.',
    }
  }

  const { data: existing } = await sb
    .from('profiles')
    .select('id')
    .eq('username', usernameRaw)
    .neq('id', user.id)
    .maybeSingle()
  if (existing) {
    return { ok: false, error: 'That username is taken.' }
  }

  const { data: prior } = await sb
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()
  const priorUsername = (prior as { username: string } | null)?.username

  const { error } = await sb
    .from('profiles')
    .update({ username: usernameRaw })
    .eq('id', user.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings')
  revalidatePath(`/u/${usernameRaw}`)
  if (priorUsername && priorUsername !== usernameRaw) {
    revalidatePath(`/u/${priorUsername}`)
  }
  return { ok: true, username: usernameRaw }
}

export async function updateVisibility(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to update visibility.' }

  const isPublic = formData.get('is_public') === 'true'
  const progressPublic = formData.get('progress_is_public') === 'true'

  const { error } = await sb
    .from('profiles')
    .update({ is_public: isPublic, progress_is_public: progressPublic })
    .eq('id', user.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings')
  return { ok: true }
}

export async function deleteAccount(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const confirmation = String(formData.get('confirmation') ?? '')
  if (confirmation !== 'DELETE') {
    return { ok: false, error: 'Type DELETE to confirm.' }
  }
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to delete your account.' }

  const admin = createAdminClient()
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) return { ok: false, error: deleteError.message }

  await sb.auth.signOut()
  redirect('/')
}

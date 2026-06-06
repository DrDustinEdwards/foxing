'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubRole } from '@/lib/club-membership'
import { getAuthedUserId } from '@/lib/nav-user'
import {
  getClubDiscordWebhook,
  isValidDiscordWebhook,
  postToDiscord,
} from '@/lib/discord'
import type { ActionResult } from './_shared'

export async function updateClubDiscordWebhook(
  formData: FormData,
): Promise<ActionResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  const urlRaw = String(formData.get('webhook_url') ?? '').trim()
  const clearFlag = formData.get('clear') === 'true'
  if (!clubId) return { ok: false, error: 'Missing club id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const role = await getClubRole(clubId, userId)
  if (role !== 'admin') return { ok: false, error: 'Admin access required.' }

  let next: string | null = null
  if (!clearFlag) {
    if (!urlRaw) return { ok: false, error: 'Webhook URL is required.' }
    if (!isValidDiscordWebhook(urlRaw)) {
      return {
        ok: false,
        error: 'URL must start with https://discord.com/api/webhooks/',
      }
    }
    next = urlRaw
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('clubs')
    .update({ discord_webhook_url: next })
    .eq('id', clubId)
  if (error) return { ok: false, error: error.message }
  const { data: club } = await admin
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .maybeSingle()
  const clubSlug = (club as { slug: string | null } | null)?.slug
  if (clubSlug) revalidatePath(`/clubs/${clubSlug}`)
  return { ok: true }
}

export async function testClubDiscordWebhook(
  formData: FormData,
): Promise<ActionResult> {
  const clubId = String(formData.get('club_id') ?? '').trim()
  if (!clubId) return { ok: false, error: 'Missing club id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const role = await getClubRole(clubId, userId)
  if (role !== 'admin') return { ok: false, error: 'Admin access required.' }

  const hook = await getClubDiscordWebhook(clubId)
  if (!hook) return { ok: false, error: 'No webhook configured.' }
  const ok = await postToDiscord(hook.url, '✅ Foxing is connected.')
  if (!ok) return { ok: false, error: 'Discord rejected the test message.' }
  return { ok: true }
}

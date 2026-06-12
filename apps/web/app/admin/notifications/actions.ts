'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUserId } from '@/lib/nav-user'

export type BroadcastTarget = 'all' | 'free' | 'plus' | 'patron' | 'user'

interface SendInput {
  title: string
  body: string
  target: BroadcastTarget
  username?: string
}

export async function sendBroadcast(input: SendInput): Promise<{
  ok: boolean
  sent?: number
  error?: string
}> {
  const adminId = await requireAdminUserId()
  const title = input.title.trim()
  const body = input.body.trim()
  if (!title || !body) return { ok: false, error: 'Title and body required.' }
  if (title.length > 120) return { ok: false, error: 'Title too long.' }
  if (body.length > 600) return { ok: false, error: 'Body too long.' }

  const admin = createAdminClient()

  let ids: string[] = []
  if (input.target === 'user') {
    const username = input.username?.trim() ?? ''
    if (!username) return { ok: false, error: 'Username required for single-user target.' }
    const { data: row } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    const found = row as { id: string } | null
    if (!found) return { ok: false, error: `No user @${username}.` }
    ids = [found.id]
  } else {
    let query = admin.from('profiles').select('id')
    if (input.target === 'free') {
      query = query.or('subscription_tier.eq.free,subscription_tier.is.null')
    } else if (input.target === 'plus') {
      query = query.eq('subscription_tier', 'plus')
    } else if (input.target === 'patron') {
      query = query.eq('subscription_tier', 'patron')
    }
    const { data: profiles, error } = await query
    if (error) return { ok: false, error: error.message }
    ids = ((profiles as { id: string }[] | null) ?? []).map((p) => p.id)
  }
  if (ids.length === 0) return { ok: true, sent: 0 }

  const batchSize = 100
  let sent = 0
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize).map((userId) => ({
      user_id: userId,
      type: 'admin_broadcast',
      title,
      body,
      data: { target: input.target },
    }))
    const { error: insertError } = await admin.from('notifications').insert(batch)
    if (insertError) {
      return { ok: false, sent, error: insertError.message }
    }
    sent += batch.length
  }

  await admin.from('admin_notification_log').insert({
    title,
    body,
    target_type: input.target,
    target_value: input.target === 'user' ? (input.username ?? null) : null,
    recipient_count: sent,
    sent_by: adminId,
  })

  revalidatePath('/admin/notifications')
  return { ok: true, sent }
}

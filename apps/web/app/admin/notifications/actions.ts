'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

interface SendInput {
  title: string
  body: string
  target: 'all' | 'plus' | 'patron'
}

export async function sendBroadcast(input: SendInput): Promise<{
  ok: boolean
  sent?: number
  error?: string
}> {
  const title = input.title.trim()
  const body = input.body.trim()
  if (!title || !body) return { ok: false, error: 'Title and body required.' }
  if (title.length > 120) return { ok: false, error: 'Title too long.' }
  if (body.length > 600) return { ok: false, error: 'Body too long.' }

  const admin = createAdminClient()
  let query = admin.from('profiles').select('id')
  if (input.target === 'plus') {
    query = query.eq('subscription_tier', 'plus')
  } else if (input.target === 'patron') {
    query = query.eq('subscription_tier', 'patron')
  }
  const { data: profiles, error } = await query
  if (error) return { ok: false, error: error.message }
  const ids = ((profiles as { id: string }[] | null) ?? []).map((p) => p.id)
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

  revalidatePath('/admin/notifications')
  return { ok: true, sent }
}

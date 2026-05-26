'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function setMastered(opts: { id: string; mastered: boolean }) {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false as const, error: 'unauthenticated' }
  const { error } = await sb
    .from('vocabulary')
    .update({ mastered: opts.mastered })
    .eq('id', opts.id)
    .eq('user_id', user.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/vocabulary')
  return { ok: true as const }
}

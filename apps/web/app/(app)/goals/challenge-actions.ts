'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function joinChallenge(challengeId: string) {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false as const, error: 'unauthenticated' }
  const { error } = await sb
    .from('user_challenges')
    .upsert(
      {
        user_id: user.id,
        challenge_id: challengeId,
        progress: 0,
      },
      { onConflict: 'user_id,challenge_id' },
    )
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/goals')
  return { ok: true as const }
}

export async function leaveChallenge(challengeId: string) {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { ok: false as const, error: 'unauthenticated' }
  await sb
    .from('user_challenges')
    .delete()
    .eq('user_id', user.id)
    .eq('challenge_id', challengeId)
  revalidatePath('/goals')
  return { ok: true as const }
}

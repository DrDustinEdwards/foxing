'use server'

import { revalidatePath } from 'next/cache'
import { getAuthedUserId } from '@/lib/nav-user'
import { generateReadingPersonality } from '@/lib/reading-personality'

type ActionResult =
  | { ok: true; personality: string }
  | { ok: false; error: string }

export async function regenerateReadingPersonality(): Promise<ActionResult> {
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const line = await generateReadingPersonality(userId)
  if (!line) {
    return {
      ok: false,
      error:
        'Finish a few more books, then try again. We need at least 3 finished books.',
    }
  }
  revalidatePath('/settings')
  revalidatePath('/u')
  return { ok: true, personality: line }
}

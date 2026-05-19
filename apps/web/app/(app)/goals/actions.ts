'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthedUserId } from '@/lib/nav-user'

type ActionResult = { ok: true } | { ok: false; error: string }

function parseTarget(formData: FormData): number | null {
  const raw = Number(formData.get('target') ?? 0)
  if (!Number.isInteger(raw) || raw < 1 || raw > 365) return null
  return raw
}

export async function setReadingGoal(
  formData: FormData,
): Promise<ActionResult> {
  const target = parseTarget(formData)
  if (target === null) {
    return { ok: false, error: 'Enter a number between 1 and 365.' }
  }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const year = new Date().getFullYear()

  const sb = createClient()
  const { data: existing } = await sb
    .from('reading_goals')
    .select('id')
    .eq('user_id', userId)
    .eq('year', year)
    .maybeSingle()
  const row = existing as { id: string } | null
  if (row) {
    const { error } = await sb
      .from('reading_goals')
      .update({ target, type: 'books' })
      .eq('id', row.id)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await sb.from('reading_goals').insert({
      user_id: userId,
      year,
      type: 'books',
      target,
    })
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/goals')
  return { ok: true }
}

export async function deleteReadingGoal(): Promise<ActionResult> {
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const year = new Date().getFullYear()
  const sb = createClient()
  const { error } = await sb
    .from('reading_goals')
    .delete()
    .eq('user_id', userId)
    .eq('year', year)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/goals')
  return { ok: true }
}

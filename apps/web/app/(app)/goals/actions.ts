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

export async function consumeStreakFreeze(): Promise<ActionResult> {
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = createClient()
  const { data } = await sb
    .from('reading_streaks')
    .select('streak_freeze_credits, last_read_date, current_streak')
    .eq('user_id', userId)
    .maybeSingle()
  const row = data as
    | {
        streak_freeze_credits: number | null
        last_read_date: string | null
        current_streak: number | null
      }
    | null
  if (!row) return { ok: false, error: 'No streak record found.' }
  const credits = row.streak_freeze_credits ?? 0
  if (credits <= 0) {
    return { ok: false, error: 'No freeze credits available.' }
  }
  if ((row.current_streak ?? 0) <= 0) {
    return { ok: false, error: 'You do not have an active streak to protect.' }
  }
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayISO = yesterday.toISOString().slice(0, 10)
  const todayISO = today.toISOString().slice(0, 10)
  if (row.last_read_date !== yesterdayISO) {
    return {
      ok: false,
      error: 'Freezes can only be used the day after your last read.',
    }
  }
  const { error } = await sb
    .from('reading_streaks')
    .update({
      streak_freeze_credits: credits - 1,
      last_read_date: todayISO,
    })
    .eq('user_id', userId)
  if (error) return { ok: false, error: error.message }
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
    .eq('period_type', 'annual')
  if (error) return { ok: false, error: error.message }
  revalidatePath('/goals')
  return { ok: true }
}

function parsePeriodTarget(formData: FormData, max: number): number | null {
  const raw = Number(formData.get('target') ?? 0)
  if (!Number.isInteger(raw) || raw < 1 || raw > max) return null
  return raw
}

export async function setMonthlyGoal(formData: FormData): Promise<ActionResult> {
  const target = parsePeriodTarget(formData, 50)
  if (target === null) {
    return { ok: false, error: 'Enter a number between 1 and 50.' }
  }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1
  const sb = createClient()
  const { data: existing } = await sb
    .from('reading_goals')
    .select('id')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .eq('period_type', 'monthly')
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
      month,
      period_type: 'monthly',
      type: 'books',
      target,
    })
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/goals')
  return { ok: true }
}

export async function deleteMonthlyGoal(): Promise<ActionResult> {
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1
  const sb = createClient()
  const { error } = await sb
    .from('reading_goals')
    .delete()
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .eq('period_type', 'monthly')
  if (error) return { ok: false, error: error.message }
  revalidatePath('/goals')
  return { ok: true }
}

export async function setWeeklyGoal(formData: FormData): Promise<ActionResult> {
  const target = parsePeriodTarget(formData, 14)
  if (target === null) {
    return { ok: false, error: 'Enter a number between 1 and 14.' }
  }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const { isoWeekOf } = await import('@/lib/goal-periods')
  const { year, week } = isoWeekOf(new Date())
  const sb = createClient()
  const { data: existing } = await sb
    .from('reading_goals')
    .select('id')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('week', week)
    .eq('period_type', 'weekly')
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
      week,
      period_type: 'weekly',
      type: 'books',
      target,
    })
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/goals')
  return { ok: true }
}

export async function deleteWeeklyGoal(): Promise<ActionResult> {
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const { isoWeekOf } = await import('@/lib/goal-periods')
  const { year, week } = isoWeekOf(new Date())
  const sb = createClient()
  const { error } = await sb
    .from('reading_goals')
    .delete()
    .eq('user_id', userId)
    .eq('year', year)
    .eq('week', week)
    .eq('period_type', 'weekly')
  if (error) return { ok: false, error: error.message }
  revalidatePath('/goals')
  return { ok: true }
}

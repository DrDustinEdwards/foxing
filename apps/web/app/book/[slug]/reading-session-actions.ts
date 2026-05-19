'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthedUserId } from '@/lib/nav-user'
import { checkAndAwardBadges } from '@/lib/badges'

type StartResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string }

type FinishResult =
  | {
      ok: true
      durationMinutes: number
      pagesRead: number
      avgWpm: number | null
    }
  | { ok: false; error: string }

export async function startReadingSession(
  formData: FormData,
): Promise<StartResult> {
  const bookId = String(formData.get('book_id') ?? '').trim()
  if (!bookId) return { ok: false, error: 'Missing book id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const sb = createClient()
  const { data, error } = await sb
    .from('reading_sessions')
    .insert({
      user_id: userId,
      book_id: bookId,
      started_at: new Date().toISOString(),
      pages_read: 0,
    })
    .select('id')
    .single()
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Could not start session.' }
  }
  return { ok: true, sessionId: (data as { id: string }).id }
}

export async function finishReadingSession(
  formData: FormData,
): Promise<FinishResult> {
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const pagesReadRaw = Number(formData.get('pages_read') ?? 0)
  const wordCountRaw = Number(formData.get('word_count') ?? 0)
  const totalPagesRaw = Number(formData.get('total_pages') ?? 0)
  const bookSlug = String(formData.get('book_slug') ?? '').trim()
  if (!sessionId) return { ok: false, error: 'Missing session id.' }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }

  const sb = createClient()
  const { data: existing } = await sb
    .from('reading_sessions')
    .select('id, started_at')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()
  const row = existing as { id: string; started_at: string } | null
  if (!row) return { ok: false, error: 'Session not found.' }

  const endedAt = new Date()
  const startedAt = new Date(row.started_at)
  const durationMs = endedAt.getTime() - startedAt.getTime()
  const durationMinutes = Math.max(1, Math.round(durationMs / 60000))
  const pages = Number.isFinite(pagesReadRaw) && pagesReadRaw > 0 ? pagesReadRaw : 0

  let avgWpm: number | null = null
  if (
    pages > 0 &&
    Number.isFinite(wordCountRaw) &&
    wordCountRaw > 0 &&
    Number.isFinite(totalPagesRaw) &&
    totalPagesRaw > 0
  ) {
    const wordsRead = (pages / totalPagesRaw) * wordCountRaw
    avgWpm = Math.max(1, Math.round(wordsRead / durationMinutes))
  }

  const update: Record<string, unknown> = {
    ended_at: endedAt.toISOString(),
    pages_read: pages,
  }
  if (avgWpm !== null) {
    update.avg_wpm = avgWpm
    update.last_wpm = avgWpm
  }
  const { error } = await sb
    .from('reading_sessions')
    .update(update)
    .eq('id', sessionId)
    .eq('user_id', userId)
  if (error) return { ok: false, error: error.message }

  await checkAndAwardBadges(userId)

  if (bookSlug) revalidatePath(`/book/${bookSlug}`)
  revalidatePath('/stats')
  return {
    ok: true,
    durationMinutes,
    pagesRead: pages,
    avgWpm,
  }
}

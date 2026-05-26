'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/nav-user'
import { userQuestionCountForAuthor } from '@/lib/author-qa'

type ActionResult = { ok: true } | { ok: false; error: string }

const MAX_PER_USER_PER_AUTHOR = 3

export async function askAuthorQuestion(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const authorUserId = String(formData.get('author_user_id') ?? '').trim()
  const text = String(formData.get('question') ?? '').trim()
  if (!authorUserId) return { ok: false, error: 'Missing author.' }
  if (text.length < 10 || text.length > 500) {
    return {
      ok: false,
      error: 'Question must be 10 to 500 characters.',
    }
  }
  const count = await userQuestionCountForAuthor(userId, authorUserId)
  if (count >= MAX_PER_USER_PER_AUTHOR) {
    return {
      ok: false,
      error: `You can ask up to ${MAX_PER_USER_PER_AUTHOR} questions per author.`,
    }
  }
  const sb = await createClient()
  const { error } = await sb.from('author_questions').insert({
    asker_id: userId,
    author_user_id: authorUserId,
    question: text,
    is_public: true,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/author-dashboard')
  return { ok: true }
}

export async function publishAnswer(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const questionId = String(formData.get('question_id') ?? '').trim()
  const answer = String(formData.get('answer') ?? '').trim().slice(0, 2000)
  if (!questionId || !answer) {
    return { ok: false, error: 'Question and answer required.' }
  }
  const admin = createAdminClient()
  const { data: q } = await admin
    .from('author_questions')
    .select('author_user_id')
    .eq('id', questionId)
    .maybeSingle()
  if (
    !q ||
    (q as { author_user_id: string }).author_user_id !== userId
  ) {
    return { ok: false, error: 'Not authorized to answer.' }
  }
  const { error } = await admin
    .from('author_questions')
    .update({
      answer,
      answered_at: new Date().toISOString(),
      is_public: true,
    })
    .eq('id', questionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/author-dashboard')
  return { ok: true }
}

export async function ignoreAuthorQuestion(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const questionId = String(formData.get('question_id') ?? '').trim()
  if (!questionId) return { ok: false, error: 'Missing question.' }
  const admin = createAdminClient()
  const { data: q } = await admin
    .from('author_questions')
    .select('author_user_id')
    .eq('id', questionId)
    .maybeSingle()
  if (
    !q ||
    (q as { author_user_id: string }).author_user_id !== userId
  ) {
    return { ok: false, error: 'Not authorized.' }
  }
  const { error } = await admin
    .from('author_questions')
    .update({ is_public: false, answered_at: new Date().toISOString() })
    .eq('id', questionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/author-dashboard')
  return { ok: true }
}

export async function toggleQuestionUpvote(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const questionId = String(formData.get('question_id') ?? '').trim()
  if (!questionId) return { ok: false, error: 'Missing question.' }
  const sb = await createClient()
  const { data: existing } = await sb
    .from('author_question_upvotes')
    .select('question_id')
    .eq('question_id', questionId)
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) {
    const { error } = await sb
      .from('author_question_upvotes')
      .delete()
      .eq('question_id', questionId)
      .eq('user_id', userId)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await sb
      .from('author_question_upvotes')
      .insert({ question_id: questionId, user_id: userId })
    if (error) return { ok: false, error: error.message }
  }
  return { ok: true }
}

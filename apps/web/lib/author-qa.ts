import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type {
  AuthorQuestion,
  AuthorQuestionWithMeta,
} from '@/lib/author-qa-types'

export type {
  AuthorQuestion,
  AuthorQuestionWithMeta,
} from '@/lib/author-qa-types'

const COLS =
  'id, asker_id, author_user_id, question, answer, is_public, created_at, answered_at' as const

export async function fetchAnsweredQuestions(
  authorUserId: string,
  viewerId: string | null,
  limit = 25,
): Promise<AuthorQuestionWithMeta[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('author_questions')
    .select(
      `${COLS}, asker:asker_id(username, display_name, avatar_url)`,
    )
    .eq('author_user_id', authorUserId)
    .eq('is_public', true)
    .not('answer', 'is', null)
    .order('answered_at', { ascending: false })
    .limit(limit)
  const rows =
    (data as unknown as Array<
      AuthorQuestion & {
        asker: {
          username: string
          display_name: string
          avatar_url: string | null
        } | null
      }
    > | null) ?? []
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const { data: countRows } = await admin
    .from('author_question_upvotes')
    .select('question_id')
    .in('question_id', ids)
  const counts = new Map<string, number>()
  for (const r of (countRows as { question_id: string }[] | null) ?? []) {
    counts.set(r.question_id, (counts.get(r.question_id) ?? 0) + 1)
  }

  const myUpvotes = new Set<string>()
  if (viewerId) {
    const { data: myRows } = await admin
      .from('author_question_upvotes')
      .select('question_id')
      .eq('user_id', viewerId)
      .in('question_id', ids)
    for (const r of (myRows as { question_id: string }[] | null) ?? []) {
      myUpvotes.add(r.question_id)
    }
  }

  return rows.map((r) => ({
    ...r,
    upvote_count: counts.get(r.id) ?? 0,
    viewer_upvoted: myUpvotes.has(r.id),
  }))
}

export async function fetchUnansweredQuestionsForAuthor(
  authorUserId: string,
): Promise<AuthorQuestionWithMeta[]> {
  const sb = createClient()
  const { data } = await sb
    .from('author_questions')
    .select(
      `${COLS}, asker:asker_id(username, display_name, avatar_url)`,
    )
    .eq('author_user_id', authorUserId)
    .is('answered_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
  const rows =
    (data as unknown as Array<
      AuthorQuestion & {
        asker: {
          username: string
          display_name: string
          avatar_url: string | null
        } | null
      }
    > | null) ?? []
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const { data: countRows } = await sb
    .from('author_question_upvotes')
    .select('question_id')
    .in('question_id', ids)
  const counts = new Map<string, number>()
  for (const r of (countRows as { question_id: string }[] | null) ?? []) {
    counts.set(r.question_id, (counts.get(r.question_id) ?? 0) + 1)
  }
  return rows
    .map((r) => ({
      ...r,
      upvote_count: counts.get(r.id) ?? 0,
      viewer_upvoted: false,
    }))
    .sort((a, b) => b.upvote_count - a.upvote_count)
}

export async function userQuestionCountForAuthor(
  userId: string,
  authorUserId: string,
): Promise<number> {
  const sb = createClient()
  const { count } = await sb
    .from('author_questions')
    .select('id', { count: 'exact', head: true })
    .eq('asker_id', userId)
    .eq('author_user_id', authorUserId)
  return count ?? 0
}

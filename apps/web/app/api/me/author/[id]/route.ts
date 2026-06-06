import { NextResponse } from 'next/server'
import { getAuthedUserId } from '@/lib/nav-user'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: authorUserId } = await params
  const viewerId = await getAuthedUserId()
  if (!viewerId) {
    return NextResponse.json(
      { viewerId: null, isOwnProfile: false, upvotedQuestionIds: [] },
      { headers: PRIVATE_HEADERS },
    )
  }
  const admin = createAdminClient()
  const { data: questions } = await admin
    .from('author_questions')
    .select('id')
    .eq('author_user_id', authorUserId)
    .eq('is_public', true)
    .not('answer', 'is', null)
  const questionIds = ((questions as { id: string }[] | null) ?? []).map(
    (q) => q.id,
  )
  let upvotedQuestionIds: string[] = []
  if (questionIds.length > 0) {
    const { data: upvotes } = await admin
      .from('author_question_upvotes')
      .select('question_id')
      .eq('user_id', viewerId)
      .in('question_id', questionIds)
    upvotedQuestionIds = (
      (upvotes as { question_id: string }[] | null) ?? []
    ).map((r) => r.question_id)
  }
  return NextResponse.json(
    {
      viewerId,
      isOwnProfile: viewerId === authorUserId,
      upvotedQuestionIds,
    },
    { headers: PRIVATE_HEADERS },
  )
}

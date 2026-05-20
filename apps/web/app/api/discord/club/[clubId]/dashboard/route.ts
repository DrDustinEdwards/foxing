import { NextResponse, type NextRequest } from 'next/server'
import { bearerFromHeaders, verifySession } from '@/lib/discord-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: { clubId: string } },
) {
  const token = bearerFromHeaders(request.headers)
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: memberRow } = await admin
    .from('club_members')
    .select('status')
    .eq('club_id', params.clubId)
    .eq('user_id', session.userId)
    .maybeSingle()
  if (
    !memberRow ||
    (memberRow as { status: string | null }).status !== 'active'
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: clubRow } = await admin
    .from('clubs')
    .select('current_book_id, current_book:current_book_id(id, title, author)')
    .eq('id', params.clubId)
    .maybeSingle()
  const currentBookId = (clubRow as { current_book_id: string | null } | null)
    ?.current_book_id
  const currentBook =
    (clubRow as unknown as {
      current_book: { id: string; title: string; author: string } | null
    } | null)?.current_book ?? null

  const [memberRowsRes, reactionsRes, guideRes, pollRes] = await Promise.all([
    admin
      .from('club_members')
      .select(
        'user_id, profile:user_id(display_name, avatar_url), progress:user_id(progress_percentage:progress_percentage)',
      )
      .eq('club_id', params.clubId)
      .eq('status', 'active'),
    currentBookId
      ? admin
          .from('chapter_reactions')
          .select(
            'id, chapter_name, emoji, note, created_at, author:user_id(display_name)',
          )
          .eq('book_id', currentBookId)
          .eq('privacy', 'public')
          .order('created_at', { ascending: false })
          .limit(60)
      : Promise.resolve({ data: null }),
    currentBookId
      ? admin
          .from('book_discussion_guides')
          .select('questions')
          .eq('book_id', currentBookId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('club_polls')
      .select(
        'id, title, poll_type, closes_at, options:club_poll_options(id, label)',
      )
      .eq('club_id', params.clubId)
      .is('closed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  let memberProgress: Array<{
    user_id: string
    display_name: string
    avatar_url: string | null
    progress_percentage: number | null
    status: string | null
  }> = []
  const memberIds =
    ((memberRowsRes.data as { user_id: string }[] | null) ?? []).map(
      (r) => r.user_id,
    )
  if (currentBookId && memberIds.length > 0) {
    const { data: progressRows } = await admin
      .from('user_books')
      .select('user_id, status, progress_percentage')
      .eq('book_id', currentBookId)
      .in('user_id', memberIds)
    const byId = new Map<
      string,
      { status: string | null; progress_percentage: number | null }
    >()
    for (const r of (progressRows as
      | Array<{
          user_id: string
          status: string | null
          progress_percentage: number | null
        }>
      | null) ?? []) {
      byId.set(r.user_id, {
        status: r.status,
        progress_percentage: r.progress_percentage,
      })
    }
    memberProgress = (
      (memberRowsRes.data as unknown as Array<{
        user_id: string
        profile: { display_name: string; avatar_url: string | null } | null
      }> | null) ?? []
    )
      .map((m) => {
        const p = byId.get(m.user_id)
        return {
          user_id: m.user_id,
          display_name: m.profile?.display_name ?? 'Reader',
          avatar_url: m.profile?.avatar_url ?? null,
          progress_percentage: p?.progress_percentage ?? 0,
          status: p?.status ?? null,
        }
      })
      .sort(
        (a, b) =>
          (b.progress_percentage ?? 0) - (a.progress_percentage ?? 0),
      )
  }

  const reactionRows =
    (reactionsRes.data as unknown as Array<{
      id: string
      chapter_name: string
      emoji: string
      note: string | null
      author: { display_name: string } | null
    }> | null) ?? []
  const chapterReactions = reactionRows.map((r) => ({
    id: r.id,
    chapter_name: r.chapter_name,
    emoji: r.emoji,
    note: r.note,
    display_name: r.author?.display_name ?? 'Reader',
  }))

  const guide = guideRes.data as { questions: unknown } | null
  const discussionQuestions = Array.isArray(guide?.questions)
    ? (guide!.questions as Array<{ question: string; theme?: string }>)
    : []

  let activePoll: {
    id: string
    title: string
    poll_type: string
    closes_at: string | null
    options: Array<{ id: string; label: string; vote_count: number }>
    my_vote: string | null
  } | null = null
  const poll = pollRes.data as
    | {
        id: string
        title: string
        poll_type: string
        closes_at: string | null
        options: Array<{ id: string; label: string }> | null
      }
    | null
  if (poll) {
    const optionIds = (poll.options ?? []).map((o) => o.id)
    const { data: votes } = await admin
      .from('club_poll_votes')
      .select('option_id, user_id')
      .in('option_id', optionIds.length > 0 ? optionIds : ['00000000-0000-0000-0000-000000000000'])
    const counts = new Map<string, number>()
    let myVote: string | null = null
    for (const v of (votes as { option_id: string; user_id: string }[] | null) ?? []) {
      counts.set(v.option_id, (counts.get(v.option_id) ?? 0) + 1)
      if (v.user_id === session.userId) myVote = v.option_id
    }
    activePoll = {
      id: poll.id,
      title: poll.title,
      poll_type: poll.poll_type,
      closes_at: poll.closes_at,
      options: (poll.options ?? []).map((o) => ({
        id: o.id,
        label: o.label,
        vote_count: counts.get(o.id) ?? 0,
      })),
      my_vote: myVote,
    }
  }

  return NextResponse.json({
    current_book: currentBook,
    discussion_questions: discussionQuestions,
    chapter_reactions: chapterReactions,
    active_poll: activePoll,
    member_progress: memberProgress,
  })
}

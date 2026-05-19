import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type PollType = 'single' | 'ranked'

export interface PollOption {
  id: string
  poll_id: string
  book_id: string | null
  label: string
  position: number
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  } | null
}

export interface PollVote {
  option_id: string
  user_id: string
  rank: number | null
}

export interface ClubPoll {
  id: string
  club_id: string
  created_by: string
  title: string
  description: string | null
  poll_type: PollType
  closes_at: string | null
  is_closed: boolean
  created_at: string
  options: PollOption[]
  votes: PollVote[]
  user_votes: PollVote[]
  winner_option_id: string | null
}

const POLL_COLS =
  'id, club_id, created_by, title, description, poll_type, closes_at, is_closed, created_at' as const
const OPTION_COLS =
  'id, poll_id, book_id, label, position, book:book_id(id, slug, title, author, cover_url)' as const

function hasEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

// Instant-runoff for ranked-choice: returns the winning option_id or null.
function computeRankedWinner(
  options: PollOption[],
  votes: PollVote[],
): string | null {
  if (options.length === 0) return null
  const optionIds = new Set(options.map((o) => o.id))
  // Build per-user ranked lists.
  const byUser = new Map<string, PollVote[]>()
  for (const v of votes) {
    if (v.rank === null) continue
    const list = byUser.get(v.user_id) ?? []
    list.push(v)
    byUser.set(v.user_id, list)
  }
  for (const list of byUser.values()) {
    list.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
  }

  const remaining = new Set(optionIds)
  for (let round = 0; round < options.length; round++) {
    const counts = new Map<string, number>()
    for (const id of remaining) counts.set(id, 0)
    let totalBallots = 0
    for (const list of byUser.values()) {
      const top = list.find((v) => remaining.has(v.option_id))
      if (!top) continue
      counts.set(top.option_id, (counts.get(top.option_id) ?? 0) + 1)
      totalBallots++
    }
    if (totalBallots === 0) return null
    let winner: string | null = null
    let winnerCount = 0
    for (const [id, c] of counts) {
      if (c > totalBallots / 2) {
        return id
      }
      if (c > winnerCount) {
        winner = id
        winnerCount = c
      }
    }
    if (remaining.size <= 1) return winner
    // Eliminate the lowest count.
    let loser: string | null = null
    let loserCount = Number.POSITIVE_INFINITY
    for (const [id, c] of counts) {
      if (c < loserCount) {
        loser = id
        loserCount = c
      }
    }
    if (loser) remaining.delete(loser)
  }
  return null
}

function computeSingleWinner(votes: PollVote[]): string | null {
  const counts = new Map<string, number>()
  for (const v of votes) {
    counts.set(v.option_id, (counts.get(v.option_id) ?? 0) + 1)
  }
  let winner: string | null = null
  let winnerCount = 0
  for (const [id, c] of counts) {
    if (c > winnerCount) {
      winner = id
      winnerCount = c
    }
  }
  return winner
}

export async function fetchPollsForClub(
  clubId: string,
  userId: string | null,
): Promise<ClubPoll[]> {
  if (!hasEnv()) return []
  const sb = createClient()
  const { data: polls } = await sb
    .from('club_polls')
    .select(POLL_COLS)
    .eq('club_id', clubId)
    .order('is_closed', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  const pollRows =
    (polls as Omit<
      ClubPoll,
      'options' | 'votes' | 'user_votes' | 'winner_option_id'
    >[] | null) ?? []
  if (pollRows.length === 0) return []
  const pollIds = pollRows.map((p) => p.id)

  const [{ data: optionsRaw }, { data: votesRaw }] = await Promise.all([
    sb.from('club_poll_options').select(OPTION_COLS).in('poll_id', pollIds),
    sb
      .from('club_poll_votes')
      .select('option_id, user_id, rank, poll_id')
      .in('poll_id', pollIds),
  ])

  const allOptions =
    (optionsRaw as unknown as Array<PollOption & { poll_id: string }> | null) ??
    []
  const votes =
    (votesRaw as { option_id: string; user_id: string; rank: number | null; poll_id: string }[] | null) ??
    []

  const optionsByPoll = new Map<string, PollOption[]>()
  for (const o of allOptions) {
    const list = optionsByPoll.get(o.poll_id) ?? []
    list.push(o)
    optionsByPoll.set(o.poll_id, list)
  }
  for (const list of optionsByPoll.values()) {
    list.sort((a, b) => a.position - b.position)
  }

  const votesByPoll = new Map<string, PollVote[]>()
  for (const v of votes) {
    const list = votesByPoll.get(v.poll_id) ?? []
    list.push({ option_id: v.option_id, user_id: v.user_id, rank: v.rank })
    votesByPoll.set(v.poll_id, list)
  }

  return pollRows.map((p) => {
    const opts = optionsByPoll.get(p.id) ?? []
    const v = votesByPoll.get(p.id) ?? []
    const myVotes = userId ? v.filter((x) => x.user_id === userId) : []
    const winner =
      p.poll_type === 'ranked'
        ? computeRankedWinner(opts, v)
        : computeSingleWinner(v)
    return {
      ...p,
      options: opts,
      votes: v,
      user_votes: myVotes,
      winner_option_id: winner,
    }
  })
}

export function isPollOpen(poll: ClubPoll): boolean {
  if (poll.is_closed) return false
  if (poll.closes_at && new Date(poll.closes_at).getTime() < Date.now()) {
    return false
  }
  return true
}

import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import type { ClubPoll, PollOption } from '@/lib/club-polls'
import { isPollOpen } from '@/lib/club-polls'
import { ClubSectionHeader } from './club-section-header'
import { ClosePollButton } from './close-poll-button'
import { CreatePollForm } from './create-poll-form'
import { RankedChoiceVote, SingleChoiceVote } from './vote-poll-buttons'

export function PollsSection({
  clubId,
  polls,
  canModerate,
  isMember,
}: {
  clubId: string
  polls: ClubPoll[]
  canModerate: boolean
  isMember: boolean
}) {
  const active = polls.filter(isPollOpen)
  const closed = polls.filter((p) => !isPollOpen(p))
  return (
    <section>
      <ClubSectionHeader title="Polls" />
      {polls.length === 0 ? (
        <p className="font-source-serif-4 text-sm text-text-tertiary">
          No polls yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {active.map((p) => (
            <PollCard
              key={p.id}
              poll={p}
              clubId={clubId}
              canModerate={canModerate}
              isMember={isMember}
            />
          ))}
          {closed.length > 0 && (
            <details className="rounded-lg border border-border-subtle bg-bg-surface">
              <summary className="cursor-pointer px-4 py-3 font-dm-sans text-sm text-text-secondary">
                Closed polls ({closed.length})
              </summary>
              <div className="flex flex-col gap-4 border-t border-border-subtle p-4">
                {closed.map((p) => (
                  <PollCard
                    key={p.id}
                    poll={p}
                    clubId={clubId}
                    canModerate={canModerate}
                    isMember={isMember}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {canModerate && (
        <div className="mt-6">
          <CreatePollForm clubId={clubId} />
        </div>
      )}
    </section>
  )
}

function PollCard({
  poll,
  clubId,
  canModerate,
  isMember,
}: {
  poll: ClubPoll
  clubId: string
  canModerate: boolean
  isMember: boolean
}) {
  const open = isPollOpen(poll)
  const counts = countVotes(poll)
  const totalVotes = poll.poll_type === 'single' ? poll.votes.length : new Set(poll.votes.map((v) => v.user_id)).size
  const userVoted = poll.user_votes.length > 0
  const showResults = !open || userVoted

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-fraunces text-base text-text-primary">
          {poll.title}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">
            {poll.poll_type === 'ranked' ? 'Ranked choice' : 'Single choice'}
          </Badge>
          {open ? (
            poll.closes_at && (
              <span className="font-dm-mono text-[0.6875rem] uppercase tracking-wider text-text-tertiary">
                Closes {new Date(poll.closes_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )
          ) : (
            <span className="font-dm-mono text-[0.6875rem] uppercase tracking-wider text-text-tertiary">
              Closed
            </span>
          )}
        </div>
      </header>

      {poll.description && (
        <p className="font-source-serif-4 text-sm text-text-secondary">
          {poll.description}
        </p>
      )}

      {showResults ? (
        <ul className="flex flex-col gap-2">
          {poll.options.map((o) => (
            <ResultRow
              key={o.id}
              option={o}
              count={counts.get(o.id) ?? 0}
              total={totalVotes}
              isWinner={!open && poll.winner_option_id === o.id}
            />
          ))}
        </ul>
      ) : null}

      {isMember && open && (
        <>
          {poll.poll_type === 'single' ? (
            <SingleChoiceVote
              pollId={poll.id}
              clubId={clubId}
              options={poll.options.map((o) => ({ id: o.id, label: o.label }))}
              currentOptionId={poll.user_votes[0]?.option_id ?? null}
              disabled={false}
            />
          ) : (
            <RankedChoiceVote
              pollId={poll.id}
              clubId={clubId}
              options={poll.options.map((o) => ({ id: o.id, label: o.label }))}
              currentRanks={
                new Map(
                  poll.user_votes
                    .filter((v) => v.rank !== null)
                    .map((v) => [v.option_id, v.rank as number]),
                )
              }
              disabled={false}
            />
          )}
        </>
      )}

      {canModerate && open && (
        <div className="flex justify-end">
          <ClosePollButton pollId={poll.id} clubId={clubId} />
        </div>
      )}
    </article>
  )
}

function countVotes(poll: ClubPoll): Map<string, number> {
  const counts = new Map<string, number>()
  if (poll.poll_type === 'single') {
    for (const v of poll.votes) {
      counts.set(v.option_id, (counts.get(v.option_id) ?? 0) + 1)
    }
    return counts
  }
  // For ranked, show count of first-choice votes per option.
  const byUser = new Map<string, { option_id: string; rank: number | null }[]>()
  for (const v of poll.votes) {
    const list = byUser.get(v.user_id) ?? []
    list.push({ option_id: v.option_id, rank: v.rank })
    byUser.set(v.user_id, list)
  }
  for (const list of byUser.values()) {
    list.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    const top = list[0]
    if (top) counts.set(top.option_id, (counts.get(top.option_id) ?? 0) + 1)
  }
  return counts
}

function ResultRow({
  option: o,
  count,
  total,
  isWinner,
}: {
  option: PollOption
  count: number
  total: number
  isWinner: boolean
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        {o.book?.cover_url && (
          <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded-sm bg-bg-sunken">
            <Image
              src={o.book.cover_url}
              alt=""
              fill
              sizes="32px"
              className="object-cover"
            />
          </span>
        )}
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="font-dm-sans text-sm text-text-primary">
              {o.label}
              {isWinner && (
                <span className="ml-2 rounded-md bg-brand-ui px-1.5 py-0.5 font-dm-mono text-[0.625rem] uppercase tracking-wider text-text-on-amber">
                  Winner
                </span>
              )}
            </span>
            <span className="font-dm-mono text-xs text-text-tertiary">
              {count} vote{count === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-bg-sunken">
            <div
              className="h-1.5 rounded-full bg-brand-subtle"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </li>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchActiveChallenges,
  fetchBooksFinishedThisYear,
  fetchReadingStreak,
  fetchUserGoal,
} from '@/lib/user-queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { appBookDeeplink } from '@/lib/foxing'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reading goals · Foxing',
}

export default async function GoalsPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')

  const year = new Date().getFullYear()
  const [goal, finishedCount, streak, challenges] = await Promise.all([
    fetchUserGoal(userId, year),
    fetchBooksFinishedThisYear(userId),
    fetchReadingStreak(userId),
    fetchActiveChallenges(userId),
  ])

  const target = goal?.target ?? 0
  const pct =
    target > 0
      ? Math.min(100, Math.round((finishedCount / target) * 100))
      : 0

  return (
    <PageWrapper className="py-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Reading goals
      </h1>

      <section className="mt-8 rounded-lg border border-border-subtle bg-bg-surface p-6">
        <h2 className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          {year} goal
        </h2>
        {target > 0 ? (
          <div className="mt-3 flex flex-col gap-3">
            <p className="font-fraunces text-2xl text-text-primary">
              {finishedCount}{' '}
              <span className="font-dm-sans text-base text-text-tertiary">
                of {target} books
              </span>
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-sunken">
              <div
                className="h-full rounded-full bg-brand-ui"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="font-dm-mono text-xs text-text-tertiary">
              {pct}% there
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <p className="font-source-serif-4 text-base text-text-secondary">
              No goal set for {year}. Set one to track progress.
            </p>
            <Link
              href={appBookDeeplink('settings/goals')}
              className="self-start"
            >
              <Button variant="primary" size="sm">
                Set a goal in the app
              </Button>
            </Link>
          </div>
        )}
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StreakCard
          label="Current streak"
          value={streak.current_streak}
          hint="days in a row"
        />
        <StreakCard
          label="Longest streak"
          value={streak.longest_streak}
          hint="all time"
        />
        <StreakCard
          label="Books finished"
          value={streak.total_books_finished}
          hint="all time"
        />
        <StreakCard
          label="Highlights"
          value={streak.total_highlights}
          hint="all time"
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Community challenges
        </h2>
        {challenges.length === 0 ? (
          <p className="font-source-serif-4 text-base text-text-tertiary">
            No active challenges right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {challenges.map((c) => {
              const pctC =
                c.progress !== null && c.target > 0
                  ? Math.min(100, Math.round((c.progress / c.target) * 100))
                  : 0
              const joined = c.joined_at !== null
              return (
                <li
                  key={c.id}
                  className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-fraunces text-base text-text-primary">
                        {c.title}
                      </h3>
                      {c.is_community && <Badge variant="info">Community</Badge>}
                      {c.completed_at && <Badge variant="success">Done</Badge>}
                    </div>
                    {c.description && (
                      <p className="font-dm-sans text-sm text-text-tertiary">
                        {c.description}
                      </p>
                    )}
                    {joined && c.target > 0 && (
                      <p className="font-dm-mono text-xs text-text-tertiary">
                        {c.progress ?? 0} / {c.target} ({pctC}%)
                      </p>
                    )}
                  </div>
                  <Link href={appBookDeeplink(`challenges/${c.id}`)}>
                    <Button
                      variant={joined ? 'secondary' : 'primary'}
                      size="sm"
                    >
                      {joined ? 'Open in app' : 'Join in app'}
                    </Button>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </PageWrapper>
  )
}

function StreakCard({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint: string
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-4">
      <p className="font-fraunces text-2xl text-text-primary">{value}</p>
      <p className="mt-1 font-dm-sans text-xs uppercase tracking-wide text-text-tertiary">
        {label}
      </p>
      <p className="mt-1 font-dm-mono text-[11px] text-text-tertiary">{hint}</p>
    </div>
  )
}

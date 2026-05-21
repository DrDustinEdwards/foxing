import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchActiveChallenges,
  fetchBooksFinishedInRange,
  fetchBooksFinishedThisYear,
  fetchMonthlyGoal,
  fetchReadingActivity,
  fetchReadingStreak,
  fetchUserGoal,
  fetchWeeklyGoal,
} from '@/lib/user-queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { appBookDeeplink } from '@/lib/foxing'
import { currentMonthPeriod, currentWeekPeriod } from '@/lib/goal-periods'
import { StreakHeatmap } from './streak-heatmap'
import { ChallengeToggleButton } from './challenge-toggle-button'
import { GoalSetter } from './goal-setter'
import { PeriodGoalSetter } from './period-goal-setter'
import { UseFreezeButton } from './use-freeze-button'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reading goals · Foxing',
}

export default async function GoalsPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')

  const year = new Date().getFullYear()
  const monthPeriod = currentMonthPeriod()
  const weekPeriod = currentWeekPeriod()
  const [
    goal,
    monthlyGoal,
    weeklyGoal,
    finishedCount,
    monthlyFinished,
    weeklyFinished,
    streak,
    challenges,
    activity,
  ] = await Promise.all([
    fetchUserGoal(userId, year),
    fetchMonthlyGoal(userId, monthPeriod.year, monthPeriod.month),
    fetchWeeklyGoal(userId, weekPeriod.year, weekPeriod.week),
    fetchBooksFinishedThisYear(userId),
    fetchBooksFinishedInRange(userId, monthPeriod.startISO, monthPeriod.endISO),
    fetchBooksFinishedInRange(userId, weekPeriod.startISO, weekPeriod.endISO),
    fetchReadingStreak(userId),
    fetchActiveChallenges(userId),
    fetchReadingActivity(userId),
  ])

  const target = goal?.target ?? 0
  const pct =
    target > 0
      ? Math.min(100, Math.round((finishedCount / target) * 100))
      : 0
  const monthlyTarget = monthlyGoal?.target ?? null
  const weeklyTarget = weeklyGoal?.target ?? null
  const monthlyPct =
    monthlyTarget && monthlyTarget > 0
      ? Math.min(100, Math.round((monthlyFinished / monthlyTarget) * 100))
      : 0
  const weeklyPct =
    weeklyTarget && weeklyTarget > 0
      ? Math.min(100, Math.round((weeklyFinished / weeklyTarget) * 100))
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
            <GoalSetter currentTarget={target} year={year} />
          </div>
        ) : (
          <GoalSetter currentTarget={null} year={year} />
        )}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-bg-surface p-5">
          <h2 className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
            {monthPeriod.label} goal
          </h2>
          {monthlyTarget && monthlyTarget > 0 ? (
            <div className="mt-2 flex flex-col gap-2">
              <p className="font-fraunces text-xl text-text-primary">
                {monthlyFinished}{' '}
                <span className="font-dm-sans text-sm text-text-tertiary">
                  of {monthlyTarget} books
                </span>
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-bg-sunken">
                <div
                  className="h-full rounded-full bg-brand-ui"
                  style={{ width: `${monthlyPct}%` }}
                />
              </div>
              <p className="font-dm-mono text-xs text-text-tertiary">
                {monthlyPct}% there
              </p>
            </div>
          ) : (
            <p className="mt-2 font-source-serif-4 text-sm text-text-secondary">
              Set a goal for this month.
            </p>
          )}
          <PeriodGoalSetter
            period="monthly"
            currentTarget={monthlyTarget}
            periodLabel={monthPeriod.label}
          />
        </div>

        <div className="rounded-lg border border-border-subtle bg-bg-surface p-5">
          <h2 className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
            {weekPeriod.label} goal
          </h2>
          {weeklyTarget && weeklyTarget > 0 ? (
            <div className="mt-2 flex flex-col gap-2">
              <p className="font-fraunces text-xl text-text-primary">
                {weeklyFinished}{' '}
                <span className="font-dm-sans text-sm text-text-tertiary">
                  of {weeklyTarget} books
                </span>
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-bg-sunken">
                <div
                  className="h-full rounded-full bg-brand-ui"
                  style={{ width: `${weeklyPct}%` }}
                />
              </div>
              <p className="font-dm-mono text-xs text-text-tertiary">
                {weeklyPct}% there
              </p>
            </div>
          ) : (
            <p className="mt-2 font-source-serif-4 text-sm text-text-secondary">
              Set a goal for this week.
            </p>
          )}
          <PeriodGoalSetter
            period="weekly"
            currentTarget={weeklyTarget}
            periodLabel={weekPeriod.label}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Reading activity, last 52 weeks
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-bg-surface p-4">
          <StreakHeatmap activity={activity} />
        </div>
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

      <FreezeSection
        credits={streak.streak_freeze_credits}
        currentStreak={streak.current_streak}
        lastRead={streak.last_read_date}
      />

      <section className="mt-10">
        <h2 className="mb-4 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Community challenges
        </h2>
        {challenges.length === 0 ? (
          <p className="font-source-serif-4 text-base text-text-tertiary">
            No active challenges right now. Check back soon for community
            challenges.
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
                  <div className="flex flex-wrap gap-2">
                    <ChallengeToggleButton
                      challengeId={c.id}
                      initiallyJoined={joined}
                    />
                    <Link href={appBookDeeplink(`challenges/${c.id}`)}>
                      <Button variant="ghost" size="sm">
                        Open in app
                      </Button>
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </PageWrapper>
  )
}

function FreezeSection({
  credits,
  currentStreak,
  lastRead,
}: {
  credits: number
  currentStreak: number
  lastRead: string | null
}) {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayISO = yesterday.toISOString().slice(0, 10)
  const atRisk =
    credits > 0 && currentStreak > 0 && lastRead === yesterdayISO
  return (
    <section className="mt-6 flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-5">
      <header>
        <h2 className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Streak freeze
        </h2>
        <p className="mt-1 font-fraunces text-xl text-text-primary">
          {credits} freeze {credits === 1 ? 'credit' : 'credits'} available
        </p>
      </header>
      {credits === 0 ? (
        <p className="font-source-serif-4 text-sm text-text-secondary">
          Earn freeze credits by reading consistently. You earn 1 freeze
          credit for every 7-day streak milestone.
        </p>
      ) : atRisk ? (
        <div className="flex flex-col gap-2">
          <p className="font-source-serif-4 text-sm text-text-secondary">
            Your streak is at risk. Use a freeze to protect it for today.
          </p>
          <UseFreezeButton />
        </div>
      ) : (
        <p className="font-source-serif-4 text-sm text-text-secondary">
          You earn 1 freeze credit for every 7-day streak milestone.
        </p>
      )}
    </section>
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

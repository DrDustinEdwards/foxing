import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchFinishedBooksForStats,
  fetchReadingStreak,
} from '@/lib/user-queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { GenreDonut, MonthlyBooksChart, type MonthlyBucket, type ThemeBucket } from './charts'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reading stats · Foxing',
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export default async function StatsPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')

  const since = new Date()
  since.setMonth(since.getMonth() - 11)
  since.setDate(1)
  since.setHours(0, 0, 0, 0)

  const [finished, streak] = await Promise.all([
    fetchFinishedBooksForStats(userId, since.toISOString()),
    fetchReadingStreak(userId),
  ])

  const monthly: MonthlyBucket[] = buildMonthlyBuckets(since, finished)
  const genres: ThemeBucket[] = buildGenreBuckets(finished)
  const totalBooks = finished.length
  const totalPages = finished.reduce(
    (sum, f) => sum + (f.word_count ? Math.round(f.word_count / 250) : 0),
    0,
  )
  const rated = finished.filter((f): f is typeof f & { rating: number } =>
    typeof f.rating === 'number',
  )
  const avgRating =
    rated.length > 0
      ? rated.reduce((s, f) => s + f.rating, 0) / rated.length
      : null

  return (
    <PageWrapper className="py-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Reading stats
      </h1>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <StatCard label="Books finished" value={totalBooks.toString()} />
        <StatCard
          label="Pages read"
          value={totalPages.toLocaleString()}
          hint="word_count / 250"
        />
        <StatCard
          label="Average rating"
          value={avgRating ? avgRating.toFixed(1) : 'no ratings'}
        />
        <StatCard
          label="Current streak"
          value={`${streak.current_streak}`}
          hint={`longest ${streak.longest_streak}`}
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Books per month, last 12 months
        </h2>
        <div className="rounded-lg border border-border-subtle bg-bg-surface p-4">
          <MonthlyBooksChart data={monthly} />
        </div>
      </section>

      {genres.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
            Genres
          </h2>
          <div className="grid items-center gap-6 rounded-lg border border-border-subtle bg-bg-surface p-4 md:grid-cols-[1fr_auto]">
            <GenreDonut data={genres} />
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1 font-dm-sans text-sm md:grid-cols-1">
              {genres.map((g) => (
                <li
                  key={g.name}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="capitalize text-text-secondary">
                    {g.name}
                  </span>
                  <span className="font-dm-mono text-xs text-text-tertiary">
                    {g.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {totalBooks === 0 && (
        <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
          Finish a book to see stats fill in.
        </p>
      )}
    </PageWrapper>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-4">
      <p className="font-fraunces text-2xl text-text-primary">{value}</p>
      <p className="mt-1 font-dm-sans text-xs uppercase tracking-wide text-text-tertiary">
        {label}
      </p>
      {hint && (
        <p className="mt-1 font-dm-mono text-[11px] text-text-tertiary">
          {hint}
        </p>
      )}
    </div>
  )
}

function buildMonthlyBuckets(
  since: Date,
  finished: Awaited<ReturnType<typeof fetchFinishedBooksForStats>>,
): MonthlyBucket[] {
  const buckets: MonthlyBucket[] = []
  const cursor = new Date(since)
  for (let i = 0; i < 12; i++) {
    buckets.push({
      month: `${MONTH_LABELS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
      count: 0,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  const startYear = since.getFullYear()
  const startMonth = since.getMonth()
  for (const f of finished) {
    const d = new Date(f.finished_at)
    const idx =
      (d.getFullYear() - startYear) * 12 + (d.getMonth() - startMonth)
    if (idx >= 0 && idx < buckets.length) buckets[idx].count++
  }
  return buckets
}

function buildGenreBuckets(
  finished: Awaited<ReturnType<typeof fetchFinishedBooksForStats>>,
): ThemeBucket[] {
  const counts = new Map<string, number>()
  for (const f of finished) {
    if (!f.themes) continue
    for (const t of f.themes) {
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

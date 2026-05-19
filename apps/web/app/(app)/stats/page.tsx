import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchAuthorAndFormatStats,
  fetchFinishedBooksForStats,
  fetchMoodDistribution,
  fetchReadingPace,
  fetchReadingStreak,
  fetchReadingTimeStats,
  fetchRecentSessions,
} from '@/lib/user-queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { cn } from '@/lib/cn'
import {
  GenreDonut,
  MonthlyBooksChart,
  MoodBarChart,
  ReadingPaceLine,
  type MonthlyBucket,
  type ThemeBucket,
} from './charts'

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

const FORMAT_LABELS: Record<string, string> = {
  physical: 'Physical',
  ebook: 'Ebook',
  audiobook: 'Audiobook',
  unknown: 'Unknown',
}

function recentYears(): number[] {
  const y = new Date().getFullYear()
  return [y, y - 1, y - 2]
}

function formatHoursMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0m'
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: { year?: string }
}) {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')

  const years = recentYears()
  const selectedYear =
    years.find((y) => String(y) === searchParams.year) ?? null

  const since = new Date()
  if (selectedYear) {
    since.setFullYear(selectedYear, 0, 1)
  } else {
    since.setMonth(since.getMonth() - 11)
    since.setDate(1)
  }
  since.setHours(0, 0, 0, 0)
  const sinceISO = since.toISOString()
  const until = selectedYear
    ? new Date(selectedYear + 1, 0, 1).toISOString()
    : undefined

  const [finished, streak, timeStats, recentSessions, extra, moods, pace] =
    await Promise.all([
      fetchFinishedBooksForStats(userId, sinceISO, until),
      fetchReadingStreak(userId),
      fetchReadingTimeStats(userId),
      fetchRecentSessions(userId, 10),
      fetchAuthorAndFormatStats(userId),
      fetchMoodDistribution(userId, sinceISO, until),
      fetchReadingPace(userId, sinceISO, until),
    ])

  const monthly: MonthlyBucket[] = buildMonthlyBuckets(since, finished, selectedYear)
  const genres: ThemeBucket[] = buildGenreBuckets(finished)
  const totalBooks = finished.length
  const totalPages = finished.reduce(
    (sum, f) => sum + (f.word_count ? Math.round(f.word_count / 250) : 0),
    0,
  )
  const ratedHalf = finished.filter(
    (f): f is typeof f & { rating_half: number } =>
      typeof f.rating_half === 'number',
  )
  const avgRating =
    ratedHalf.length > 0
      ? ratedHalf.reduce((s, f) => s + f.rating_half / 2, 0) / ratedHalf.length
      : null

  const wordCounts = finished
    .map((f) => f.word_count)
    .filter((n): n is number => typeof n === 'number' && n > 0)
  const avgWordCount =
    wordCounts.length > 0
      ? Math.round(
          wordCounts.reduce((s, n) => s + n, 0) / wordCounts.length,
        )
      : null

  const formatTotal = Object.values(extra.format_counts).reduce(
    (s, n) => s + n,
    0,
  )

  return (
    <PageWrapper className="py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-fraunces text-[2rem] text-text-primary">
          Reading stats
        </h1>
        <YearFilter
          years={years}
          selected={selectedYear}
        />
      </header>

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

      <section className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <StatCard
          label="Total reading time"
          value={formatHoursMinutes(timeStats.total_minutes)}
          hint={
            timeStats.sessions_with_pages > 0
              ? `${timeStats.sessions_with_pages} sessions with pages`
              : undefined
          }
        />
        <StatCard
          label="Avg book length"
          value={
            avgWordCount
              ? `${Math.round(avgWordCount / 1000)}k words`
              : 'no data'
          }
        />
        <StatCard
          label="Longest book"
          value={
            extra.longest_book
              ? `${Math.round(extra.longest_book.word_count / 1000)}k`
              : 'no data'
          }
          hint={extra.longest_book?.title}
          href={
            extra.longest_book
              ? `/book/${extra.longest_book.slug ?? extra.longest_book.id}`
              : undefined
          }
        />
        <StatCard
          label="Most-read author"
          value={extra.top_author?.name ?? 'no data'}
          hint={
            extra.top_author
              ? `${extra.top_author.count} book${extra.top_author.count === 1 ? '' : 's'}`
              : undefined
          }
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          {selectedYear
            ? `Books finished in ${selectedYear}`
            : 'Books per month, last 12 months'}
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

      <section className="mt-10">
        <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Mood distribution
        </h2>
        <div className="rounded-lg border border-border-subtle bg-bg-surface p-4">
          {moods.length > 0 ? (
            <MoodBarChart data={moods.slice(0, 6)} />
          ) : (
            <p className="font-source-serif-4 text-sm text-text-tertiary">
              No mood tags yet. Add mood tags when logging books.
            </p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Reading pace
        </h2>
        <div className="rounded-lg border border-border-subtle bg-bg-surface p-4">
          {pace.sessionCount >= 3 ? (
            <ReadingPaceLine
              data={pace.points.map((p) => ({
                month: p.month,
                wpm: p.avg_wpm,
              }))}
            />
          ) : (
            <p className="font-source-serif-4 text-sm text-text-tertiary">
              Complete reading sessions with page counts to see your reading
              pace.
            </p>
          )}
        </div>
      </section>

      {formatTotal > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
            Format
          </h2>
          <ul className="flex flex-wrap gap-2">
            {Object.entries(extra.format_counts)
              .sort((a, b) => b[1] - a[1])
              .map(([key, count]) => (
                <li
                  key={key}
                  className="rounded-full border border-border-subtle bg-bg-surface px-3 py-1 font-dm-sans text-sm text-text-secondary"
                >
                  {FORMAT_LABELS[key] ?? key} ·{' '}
                  <span className="font-dm-mono text-xs text-text-tertiary">
                    {count}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Recent sessions
        </h2>
        {recentSessions.length === 0 ? (
          <p className="font-source-serif-4 text-sm text-text-tertiary">
            Start a reading session from any book page.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle bg-bg-surface">
            {recentSessions.map((s) => {
              const duration =
                s.ended_at && s.started_at
                  ? Math.max(
                      1,
                      Math.round(
                        (new Date(s.ended_at).getTime() -
                          new Date(s.started_at).getTime()) /
                          60000,
                      ),
                    )
                  : null
              const date = new Date(s.ended_at ?? s.started_at).toLocaleDateString(
                'en-US',
                { month: 'short', day: 'numeric', year: 'numeric' },
              )
              return (
                <li
                  key={s.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2 font-dm-sans text-sm text-text-secondary"
                >
                  <span className="truncate">
                    {s.book ? (
                      <Link
                        href={`/book/${s.book.slug ?? s.book.id}`}
                        className="text-text-primary hover:text-brand-text"
                      >
                        {s.book.title}
                      </Link>
                    ) : (
                      'Unknown book'
                    )}
                  </span>
                  <span className="font-dm-mono text-xs text-text-tertiary">
                    {date}
                  </span>
                  <span className="font-dm-mono text-xs text-text-tertiary">
                    {duration ? `${duration} min` : '-'}
                  </span>
                  <span className="font-dm-mono text-xs text-text-tertiary">
                    {s.pages_read > 0 ? `${s.pages_read} pp` : '-'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {totalBooks === 0 && (
        <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
          Finish a book to see stats fill in.
        </p>
      )}
    </PageWrapper>
  )
}

function YearFilter({
  years,
  selected,
}: {
  years: number[]
  selected: number | null
}) {
  function href(y: number | null): string {
    return y ? `/stats?year=${y}` : '/stats'
  }
  return (
    <div className="flex flex-wrap gap-1">
      <Link
        href={href(null)}
        className={cn(
          'rounded-full px-3 py-1 font-dm-sans text-sm',
          selected === null
            ? 'bg-brand-subtle text-brand-subtle-text'
            : 'bg-bg-sunken text-text-secondary hover:bg-bg-hover',
        )}
      >
        All time
      </Link>
      {years.map((y) => (
        <Link
          key={y}
          href={href(y)}
          className={cn(
            'rounded-full px-3 py-1 font-dm-mono text-xs',
            selected === y
              ? 'bg-brand-subtle text-brand-subtle-text'
              : 'bg-bg-sunken text-text-secondary hover:bg-bg-hover',
          )}
        >
          {y}
        </Link>
      ))}
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string
  value: string
  hint?: string
  href?: string
}) {
  const inner = (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-4">
      <p className="truncate font-fraunces text-2xl text-text-primary">
        {value}
      </p>
      <p className="mt-1 font-dm-sans text-xs uppercase tracking-wide text-text-tertiary">
        {label}
      </p>
      {hint && (
        <p className="mt-1 line-clamp-1 font-dm-mono text-[11px] text-text-tertiary">
          {hint}
        </p>
      )}
    </div>
  )
  if (href) {
    return (
      <Link href={href} className="block hover:opacity-90">
        {inner}
      </Link>
    )
  }
  return inner
}

function buildMonthlyBuckets(
  since: Date,
  finished: Awaited<ReturnType<typeof fetchFinishedBooksForStats>>,
  selectedYear: number | null,
): MonthlyBucket[] {
  const buckets: MonthlyBucket[] = []
  const cursor = new Date(since)
  const months = selectedYear ? 12 : 12
  for (let i = 0; i < months; i++) {
    buckets.push({
      month: selectedYear
        ? MONTH_LABELS[cursor.getMonth()]
        : `${MONTH_LABELS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
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

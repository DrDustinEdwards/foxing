import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { StarRating } from '@/components/ui/star-rating'
import { fetchDiaryEntries } from '@/lib/user-queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { formatRelativeDate } from '@foxing/utils'
import { cn } from '@/lib/cn'
import { LogEntryDialog } from './log-entry-dialog'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reading diary · Foxing',
}

function recentYears(): number[] {
  const currentYear = new Date().getFullYear()
  return [currentYear, currentYear - 1, currentYear - 2]
}

export default async function DiaryPage(
  props: {
    searchParams: Promise<{ year?: string; view?: 'list' | 'calendar' }>
  }
) {
  const searchParams = await props.searchParams;
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')

  const years = recentYears()
  const year = years.find((y) => String(y) === searchParams.year) ?? null
  const view = searchParams.view === 'calendar' ? 'calendar' : 'list'
  const entries = await fetchDiaryEntries(userId, year ?? undefined)

  return (
    <PageWrapper className="py-10">
      <PageHeader title="Reading diary" actions={<LogEntryDialog />} />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ViewToggle
          view={view}
          year={year}
        />
        <YearTabs current={year} view={view} years={years} />
      </div>

      {entries.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            heading="No entries yet."
            action={<LogEntryDialog />}
          />
        </div>
      ) : view === 'list' ? (
        <DiaryList entries={entries} />
      ) : (
        <DiaryCalendar entries={entries} year={year ?? new Date().getFullYear()} />
      )}
    </PageWrapper>
  )
}

function ViewToggle({
  view,
  year,
}: {
  view: 'list' | 'calendar'
  year: number | null
}) {
  function href(target: 'list' | 'calendar'): string {
    const q = new URLSearchParams()
    if (year) q.set('year', String(year))
    if (target === 'calendar') q.set('view', 'calendar')
    const s = q.toString()
    return s ? `/diary?${s}` : '/diary'
  }
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border-subtle">
      <Link
        href={href('list')}
        className={cn(
          'px-3 py-1.5 font-dm-sans text-sm',
          view === 'list'
            ? 'bg-brand-subtle text-brand-subtle-text'
            : 'text-text-tertiary hover:text-text-primary',
        )}
      >
        List
      </Link>
      <Link
        href={href('calendar')}
        className={cn(
          'px-3 py-1.5 font-dm-sans text-sm',
          view === 'calendar'
            ? 'bg-brand-subtle text-brand-subtle-text'
            : 'text-text-tertiary hover:text-text-primary',
        )}
      >
        Calendar
      </Link>
    </div>
  )
}

function YearTabs({
  current,
  view,
  years,
}: {
  current: number | null
  view: 'list' | 'calendar'
  years: number[]
}) {
  function href(year: number | null): string {
    const q = new URLSearchParams()
    if (year) q.set('year', String(year))
    if (view === 'calendar') q.set('view', 'calendar')
    const s = q.toString()
    return s ? `/diary?${s}` : '/diary'
  }
  return (
    <div className="flex gap-1">
      <Link
        href={href(null)}
        className={cn(
          'rounded-full px-3 py-1 font-dm-sans text-sm',
          current === null
            ? 'bg-brand-subtle text-brand-subtle-text'
            : 'bg-bg-sunken text-text-secondary hover:bg-bg-hover',
        )}
      >
        All
      </Link>
      {years.map((y) => (
        <Link
          key={y}
          href={href(y)}
          className={cn(
            'rounded-full px-3 py-1 font-dm-mono text-xs',
            current === y
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

function DiaryList({
  entries,
}: {
  entries: Awaited<ReturnType<typeof fetchDiaryEntries>>
}) {
  return (
    <ol className="mt-6 flex flex-col gap-3">
      {entries.map((e) => (
        <li
          key={e.id}
          className="flex gap-4 rounded-lg border border-border-subtle bg-bg-surface p-4"
        >
          <Link
            href={`/book/${e.book.slug ?? e.book.id}`}
            className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-bg-sunken"
          >
            {e.book.cover_url && (
              <Image
                src={e.book.cover_url}
                alt={e.book.title}
                fill
                sizes="56px"
                className="object-cover"
              />
            )}
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-baseline gap-3">
              <time className="font-dm-mono text-xs text-text-tertiary">
                {e.log_date}
              </time>
              <span className="font-dm-mono text-xs text-text-tertiary">
                {formatRelativeDate(e.log_date)}
              </span>
            </div>
            <Link
              href={`/book/${e.book.slug ?? e.book.id}`}
              className="truncate font-fraunces text-base text-text-primary hover:text-brand-text"
            >
              {e.book.title}
            </Link>
            {typeof e.rating_half === 'number' && (
              <StarRating value={e.rating_half / 2} size="sm" readOnly />
            )}
            {e.review && (
              <p className="line-clamp-2 font-source-serif-4 text-sm text-text-secondary">
                {e.review}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function DiaryCalendar({
  entries,
  year,
}: {
  entries: Awaited<ReturnType<typeof fetchDiaryEntries>>
  year: number
}) {
  const byDate = new Map<string, number>()
  for (const e of entries) {
    byDate.set(e.log_date, (byDate.get(e.log_date) ?? 0) + 1)
  }
  const months = Array.from({ length: 12 }, (_, m) => m)
  return (
    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {months.map((m) => (
        <MonthGrid key={m} year={year} month={m} byDate={byDate} />
      ))}
    </div>
  )
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function MonthGrid({
  year,
  month,
  byDate,
}: {
  year: number
  month: number
  byDate: Map<string, number>
}) {
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells: Array<{ day: number; key: string } | null> = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, key })
  }
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-3">
      <p className="mb-2 font-fraunces text-sm text-text-primary">
        {MONTH_NAMES[month]}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) =>
          c ? (
            <div
              key={c.key}
              className={cn(
                'flex h-7 items-center justify-center rounded text-xs',
                byDate.has(c.key)
                  ? 'bg-brand-subtle font-medium text-brand-subtle-text'
                  : 'text-text-tertiary',
              )}
              title={byDate.has(c.key) ? `${byDate.get(c.key)} entries` : undefined}
            >
              {c.day}
            </div>
          ) : (
            <div key={`pad-${i}`} className="h-7" />
          ),
        )}
      </div>
    </div>
  )
}

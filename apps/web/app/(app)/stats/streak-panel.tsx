import type { ReadingStreak } from '@/lib/user-queries'

function formatDate(dateOnly: string): string {
  // reading_streaks.last_read_date is a DATE; parse as local midnight so it
  // doesn't shift a day in negative timezones.
  const d = new Date(`${dateOnly}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateOnly
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function FlameVisual({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        'flex h-14 w-14 shrink-0 items-center justify-center rounded-full ' +
        (active ? 'bg-brand-subtle text-brand-text' : 'bg-bg-sunken text-text-tertiary')
      }
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1 .3-1.8.7-2.5C9 9 9 7 12 2z" />
        <path d="M8.5 13.5C8.5 17 10 20 12 20s3.5-3 3.5-6.5c0-1.2-.5-2.3-1.2-3.1A4 4 0 0 1 8.5 13.5z" />
      </svg>
    </span>
  )
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <dd className="font-fraunces text-xl text-text-primary">
        {value.toLocaleString()}
      </dd>
      <dt className="font-dm-sans text-xs uppercase tracking-wide text-text-tertiary">
        {label}
      </dt>
    </div>
  )
}

export function StreakPanel({ streak }: { streak: ReadingStreak }) {
  const hasStreak = streak.current_streak > 0
  return (
    <section className="mt-8">
      <div className="rounded-lg border border-border-subtle bg-bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <FlameVisual active={hasStreak} />
            <div className="flex flex-col">
              <p className="font-fraunces text-3xl leading-none text-text-primary">
                {streak.current_streak}
                <span className="ml-1 font-dm-sans text-base text-text-tertiary">
                  day{streak.current_streak === 1 ? '' : 's'}
                </span>
              </p>
              <p className="mt-1 font-dm-sans text-xs uppercase tracking-wide text-text-tertiary">
                Current streak
              </p>
              <p className="mt-1 font-dm-mono text-xs text-text-tertiary">
                Longest {streak.longest_streak} day
                {streak.longest_streak === 1 ? '' : 's'}
                {streak.last_read_date
                  ? ` · last read ${formatDate(streak.last_read_date)}`
                  : ''}
              </p>
            </div>
          </div>
          {streak.streak_freeze_credits > 0 && (
            <span className="rounded-full bg-brand-subtle px-3 py-1 font-dm-mono text-xs text-brand-subtle-text">
              {streak.streak_freeze_credits} freeze
              {streak.streak_freeze_credits === 1 ? '' : 's'} banked
            </span>
          )}
        </div>

        {!hasStreak && (
          <p className="mt-3 font-source-serif-4 text-sm text-text-tertiary">
            Read in the app to start a streak. Your reading days are tracked
            automatically.
          </p>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border-subtle pt-4 sm:grid-cols-4">
          <Total label="Books finished" value={streak.total_books_finished} />
          <Total label="Pages read" value={streak.total_pages_read} />
          <Total label="Highlights" value={streak.total_highlights} />
          <Total label="Words looked up" value={streak.total_words_looked_up} />
        </dl>
      </div>
    </section>
  )
}

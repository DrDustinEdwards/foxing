import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { BookCard } from '@/components/book-card'
import { Button } from '@/components/ui/button'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { SectionEyebrow } from '@/components/ui/section-eyebrow'
import { fetchSimilarBooks } from '@/lib/queries'
import { getAuthedUserId } from '@/lib/nav-user'
import {
  fetchCurrentlyReading,
  fetchProfileBasics,
  fetchProgressProfile,
  fetchReadingStreak,
} from '@/lib/user-queries'
import { LEVEL_LABEL, levelForXp, nextTierForXp } from '@/lib/badges'
import { appBookDeeplink } from '@/lib/foxing'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Home · Foxing',
}

function timeOfDay(hour: number): string {
  if (hour < 5) return 'evening'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function firstName(displayName: string): string {
  return displayName.split(/\s+/)[0] ?? displayName
}

export default async function DashboardHome() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')

  const [profile, currentlyReading, streak, progress] = await Promise.all([
    fetchProfileBasics(userId),
    fetchCurrentlyReading(userId),
    fetchReadingStreak(userId),
    fetchProgressProfile(userId),
  ])

  const greeting = `Good ${timeOfDay(new Date().getHours())}, ${
    profile ? firstName(profile.display_name) : 'reader'
  }.`

  const similar = currentlyReading
    ? await fetchSimilarBooks(currentlyReading.book.id, 3)
    : []

  return (
    <PageWrapper className="flex flex-col gap-10 py-10">
      <h1 className="font-fraunces text-[1.75rem] text-text-primary">
        {greeting}
      </h1>

      {currentlyReading && (
        <CurrentlyReadingCard entry={currentlyReading} />
      )}

      <StreakCard streak={streak} />

      {progress && <XpProgressCard xp={progress.xp_points} />}

      {similar.length > 0 && (
        <section>
          <SectionEyebrow as="h2" className="mb-4">
            Recommended for you
          </SectionEyebrow>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {similar.map((b) => (
              <BookCard key={b.id} book={b} size="md" showRating={false} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionEyebrow as="h2" className="mb-4">
          Recent activity
        </SectionEyebrow>
        <p className="font-source-serif-4 text-base text-text-tertiary">
          Activity from people you follow shows up here once you have follows.{' '}
          <Link
            href="/people/similar"
            className="text-brand-text hover:underline"
          >
            Find similar readers
          </Link>
        </p>
      </section>
    </PageWrapper>
  )
}

function CurrentlyReadingCard({
  entry,
}: {
  entry: NonNullable<Awaited<ReturnType<typeof fetchCurrentlyReading>>>
}) {
  const progress = Math.max(
    0,
    Math.min(100, Math.round(entry.progress_percentage ?? 0)),
  )
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-bg-surface p-5 md:flex-row md:items-start">
      <Link
        href={`/book/${entry.book.slug ?? entry.book.id}`}
        className="relative h-44 w-32 shrink-0 overflow-hidden rounded-md bg-bg-sunken shadow-sm"
      >
        {entry.book.cover_url && (
          <Image
            src={entry.book.cover_url}
            alt={entry.book.title}
            fill
            sizes="128px"
            className="object-cover"
          />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <SectionEyebrow>Currently reading</SectionEyebrow>
          <Link
            href={`/book/${entry.book.slug ?? entry.book.id}`}
            className="mt-1 block font-fraunces text-xl text-text-primary hover:text-brand-text"
          >
            {entry.book.title}
          </Link>
          <p className="font-dm-sans text-sm text-text-tertiary">
            {entry.book.author}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-sunken">
            <div
              className="h-full rounded-full bg-brand-ui"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-dm-mono text-xs text-text-tertiary">
            {progress}% read
          </span>
        </div>
        <div>
          <Link href={appBookDeeplink(entry.book.id)}>
            <Button variant="primary" size="sm">
              Continue reading in the app
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

function StreakCard({
  streak,
}: {
  streak: Awaited<ReturnType<typeof fetchReadingStreak>>
}) {
  const today = new Date().toISOString().slice(0, 10)
  const readToday = streak.last_read_date === today
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-5 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <span className="text-brand-ui" aria-hidden="true">
          <FlameIcon />
        </span>
        <div>
          <p className="font-fraunces text-xl text-text-primary">
            {streak.current_streak}-day streak
          </p>
          <p className="font-dm-sans text-xs text-text-tertiary">
            {readToday
              ? 'Read today. Keep it going tomorrow.'
              : streak.current_streak === 0
                ? 'Open a book to start one.'
                : 'Read today to keep it going.'}
          </p>
        </div>
      </div>
      <div className="flex gap-6 font-dm-mono text-xs text-text-tertiary">
        <span>longest {streak.longest_streak}</span>
        <span>finished {streak.total_books_finished}</span>
      </div>
    </section>
  )
}

function XpProgressCard({ xp }: { xp: number }) {
  const tier = levelForXp(xp)
  const next = nextTierForXp(xp)
  const tierLabel = LEVEL_LABEL[tier.level]
  const percentage = next
    ? Math.round(
        ((xp - tier.threshold) / (next.threshold - tier.threshold)) * 100,
      )
    : 100
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-fraunces text-xl text-text-primary">
            {tierLabel}
          </p>
          <p className="font-dm-mono text-xs text-text-tertiary">{xp} XP</p>
        </div>
        {next && (
          <p className="font-dm-mono text-xs text-text-tertiary">
            {next.threshold - xp} XP to {LEVEL_LABEL[next.level]}
          </p>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-sunken">
        <div
          className="h-1.5 rounded-full bg-brand-ui"
          style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
        />
      </div>
    </section>
  )
}

function FlameIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2c0 4 2 5 2 8a2 2 0 0 1-4 0c0-2-2-2-2-5 0 0-4 3-4 8a8 8 0 0 0 16 0c0-5-5-7-8-11z" />
    </svg>
  )
}

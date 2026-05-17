import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { BookCard } from '@/components/book-card'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { ReviewCard } from '@/components/review-card'
import { BookOpenIcon, ChatIcon, CompassIcon } from '@/components/icons'
import { getNavUser } from '@/lib/nav-user'
import {
  fetchCommunityReviews,
  fetchPopularThisWeek,
  fetchTodaysPick,
} from '@/lib/queries'
import { appBookDeeplink, siteOrigin } from '@/lib/foxing'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Foxing · reading, together.',
  description:
    'A platform for reading classic books with an AI companion, book clubs, and a community of serious readers.',
  alternates: { canonical: siteOrigin() },
  openGraph: {
    title: 'Foxing · reading, together.',
    description:
      'A platform for reading classic books with an AI companion, book clubs, and a community of serious readers.',
    url: siteOrigin(),
    siteName: 'Foxing',
    type: 'website',
  },
}

export default async function HomePage() {
  const [navUser, todaysPick, popular, reviews] = await Promise.all([
    getNavUser(),
    fetchTodaysPick(),
    fetchPopularThisWeek(8),
    fetchCommunityReviews(3),
  ])

  return (
    <div className="flex min-h-screen flex-col">
      <Nav user={navUser} />
      <main className="flex-1">
        <Hero />
        <ValueProps />
        {todaysPick && <TodaysPick book={todaysPick} />}
        <PopularThisWeek books={popular} />
        {reviews.length > 0 && <CommunitySection reviews={reviews} />}
        <DownloadCta />
      </main>
      <Footer />
    </div>
  )
}

function Hero() {
  return (
    <section
      data-mode="dark"
      className="relative isolate overflow-hidden bg-[#16100B] text-[var(--text-on-dark)]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 hidden w-1/2 bg-gradient-to-l from-[#3A2418]/40 via-[#16100B]/80 to-[#16100B] md:block"
      />
      <PageWrapper className="relative z-10 grid gap-10 py-20 md:grid-cols-2 md:py-28">
        <div className="flex max-w-[35rem] flex-col gap-5">
          <h1 className="font-fraunces text-[3.5rem] leading-none text-[#D4622E] md:text-[4rem]">
            Foxing
          </h1>
          <p className="font-source-serif-4 text-[1.375rem] italic text-[#C4AE96]">
            reading, together.
          </p>
          <p className="font-source-serif-4 text-base text-[#A28269]">
            1,400+ classic books, free. An AI companion that reads with you.
            Book clubs, reading diary, and a community of serious readers.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href="#download">
              <Button variant="primary" size="lg">
                Download the app
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button
                size="lg"
                variant="ghost"
                className="border border-[#3A2C22] text-white hover:bg-[#1F1710]"
              >
                Join free on web
              </Button>
            </Link>
          </div>
          <p className="mt-1 font-dm-sans text-xs text-[#A28269]">
            No ads. No algorithms selling you books.
          </p>
        </div>
      </PageWrapper>
    </section>
  )
}

function ValueProps() {
  return (
    <section className="bg-[var(--bg-base)]">
      <PageWrapper className="grid gap-10 py-16 md:grid-cols-3 md:py-20">
        <ValueColumn
          icon={<BookOpenIcon size={28} />}
          heading="1,400+ classic books, free."
        >
          Public domain literature, properly formatted for reading on a phone.
          Tap a word you don&apos;t know and the AI explains it in context,
          without leaving the page.
        </ValueColumn>
        <ValueColumn
          icon={<ChatIcon size={28} />}
          heading="Read with your friends."
        >
          Book clubs that move at a real pace. Inline passage comments tied
          to the line that prompted them. A reading diary that feels like
          yours, not a leaderboard.
        </ValueColumn>
        <ValueColumn
          icon={<CompassIcon size={28} />}
          heading="Find what to read next."
        >
          Community ratings from people who finish books. Mood-based browsing
          when you want a tone, not a genre. See what your friends are
          actually reading.
        </ValueColumn>
      </PageWrapper>
    </section>
  )
}

function ValueColumn({
  icon,
  heading,
  children,
}: {
  icon: React.ReactNode
  heading: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-brand-ui">{icon}</span>
      <h2 className="font-fraunces text-lg text-text-primary">{heading}</h2>
      <p className="font-source-serif-4 text-base text-text-secondary">
        {children}
      </p>
    </div>
  )
}

function TodaysPick({
  book,
}: {
  book: Awaited<ReturnType<typeof fetchTodaysPick>>
}) {
  if (!book) return null
  const description =
    book.description?.trim() ||
    'Open the book to see what readers have been saying about it.'
  const truncated =
    description.length > 320
      ? `${description.slice(0, 320).trimEnd()}...`
      : description
  return (
    <section className="bg-[var(--bg-surface)]">
      <PageWrapper className="py-16 md:py-20">
        <p className="mb-6 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Today&apos;s Pick
        </p>
        <div className="grid gap-8 md:grid-cols-[200px_1fr] md:items-start">
          <Link
            href={`/book/${book.id}`}
            className="block w-[200px] overflow-hidden rounded-md shadow-md"
          >
            <div className="relative aspect-[2/3] w-[200px] bg-bg-sunken">
              {book.cover_url && (
                <Image
                  src={book.cover_url}
                  alt={`Cover of ${book.title}`}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              )}
            </div>
          </Link>
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="font-fraunces text-2xl text-text-primary">
                <Link
                  href={`/book/${book.id}`}
                  className="hover:text-brand-text"
                >
                  {book.title}
                </Link>
              </h3>
              <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
                {book.author}
              </p>
            </div>
            <p className="font-source-serif-4 text-base text-text-secondary">
              {truncated}
            </p>
            <div>
              <Link href={appBookDeeplink(book.id)}>
                <Button variant="primary" size="md">
                  Read free in the Foxing app
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </PageWrapper>
    </section>
  )
}

function PopularThisWeek({
  books,
}: {
  books: Awaited<ReturnType<typeof fetchPopularThisWeek>>
}) {
  if (books.length === 0) {
    // Show a generic shelf so the section doesn't disappear on a quiet week.
    return null
  }
  return (
    <section className="bg-[var(--bg-base)]">
      <PageWrapper className="py-16 md:py-20">
        <div className="mb-6 flex items-end justify-between">
          <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
            Popular this week
          </p>
          <Link
            href="/books"
            className="font-dm-sans text-sm text-brand-text hover:underline"
          >
            All books
          </Link>
        </div>
        <div className="-mx-6 overflow-x-auto px-6 md:mx-0 md:px-0">
          <div className="flex gap-4 pb-2">
            {books.map((book) => (
              <BookCard key={book.id} book={book} size="md" />
            ))}
          </div>
        </div>
      </PageWrapper>
    </section>
  )
}

function CommunitySection({
  reviews,
}: {
  reviews: Awaited<ReturnType<typeof fetchCommunityReviews>>
}) {
  return (
    <section className="bg-[var(--bg-surface)]">
      <PageWrapper className="py-16 md:py-20">
        <p className="mb-6 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          What readers are saying
        </p>
        <div className="grid gap-5 md:grid-cols-3">
          {reviews.map((r) => (
            <div key={r.id} className="flex flex-col gap-3">
              {r.book && (
                <Link
                  href={`/book/${r.book.id}`}
                  className="flex items-center gap-3"
                >
                  <div className="relative h-16 w-12 overflow-hidden rounded bg-bg-sunken">
                    {r.book.cover_url && (
                      <Image
                        src={r.book.cover_url}
                        alt={`Cover of ${r.book.title}`}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-fraunces text-sm text-text-primary">
                      {r.book.title}
                    </span>
                    <span className="truncate font-dm-sans text-xs text-text-tertiary">
                      {r.book.author}
                    </span>
                  </div>
                </Link>
              )}
              <ReviewCard
                review={{
                  id: r.id,
                  user_id: r.user_id,
                  book_id: r.book_id,
                  rating_half: r.rating,
                  review: r.review,
                  mood_tags: null,
                  pacing: null,
                  created_at: r.created_at,
                  author: r.author ?? undefined,
                }}
              />
            </div>
          ))}
        </div>
      </PageWrapper>
    </section>
  )
}

function DownloadCta() {
  return (
    <section
      id="download"
      data-mode="dark"
      className="bg-[linear-gradient(180deg,#8A3610_0%,#16100B_100%)] text-white"
    >
      <PageWrapper className="flex flex-col items-center gap-5 py-20 text-center md:py-24">
        <h2 className="max-w-2xl font-fraunces text-[2.25rem] leading-tight text-white md:text-[2.5rem]">
          Read the classics. Finally understand them.
        </h2>
        <p className="font-source-serif-4 text-base text-white/70">
          Free to join. No credit card.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <StoreBadge label="App Store" sub="Download on the" href="#" />
          <StoreBadge label="Google Play" sub="Get it on" href="#" />
        </div>
      </PageWrapper>
    </section>
  )
}

function StoreBadge({
  label,
  sub,
  href,
}: {
  label: string
  sub: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-12 items-center gap-3 rounded-lg border border-white/30 bg-black/30 px-5 hover:bg-black/50"
    >
      <span className="flex flex-col items-start leading-tight">
        <span className="font-dm-sans text-[10px] uppercase tracking-wider text-white/70">
          {sub}
        </span>
        <span className="font-dm-sans text-sm font-medium text-white">
          {label}
        </span>
      </span>
    </Link>
  )
}

import Image from 'next/image'
import Link from 'next/link'
import { BookCard } from '@/components/book-card'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { ReviewCard } from '@/components/review-card'
import { BookOpenIcon, ChatIcon, CompassIcon } from '@/components/icons'
import {
  fetchCommunityReviews,
  fetchPopularThisWeek,
  fetchTodaysPick,
} from '@/lib/queries'
import {
  fetchPassageOfDay,
  todayISODate,
  type PassageOfDay,
} from '@/lib/missing-pages-queries'
import { Card, CardLabel, CardMeta, CardTitle } from '@/components/ui/card'
import {
  getFeaturedJournalPost,
  getJournalPosts,
  type JournalPostSummary,
} from '@/lib/journal'
import {
  FREE_AI_LOOKUPS_PER_DAY,
  PLUS_PRICE_MONTHLY_LABEL,
  PLUS_TRIAL_LABEL,
} from '@/lib/config'

export const revalidate = 600

// Title and description live in the root layout; the home page renders
// at the canonical site URL so the default metadata is exactly right.

const FAQ_JSONLD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Where can I read classic books for free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Foxing offers 1,400+ public domain classic books completely free, including Frankenstein, Pride and Prejudice, Sherlock Holmes, and Dracula. No subscription is required to read. Foxing is available on iOS, Android, and web at foxing.app.',
      },
    },
    {
      '@type': 'Question',
      name: 'What classic books are available to read online free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Foxing includes all major public domain works: Jane Austen (Pride and Prejudice, Sense and Sensibility, Emma), Charles Dickens, Mary Shelley (Frankenstein), Bram Stoker (Dracula), Arthur Conan Doyle (Sherlock Holmes), Mark Twain, Charlotte Bronte (Jane Eyre), and 1,400+ more titles from Standard Ebooks and Project Gutenberg.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is Foxing?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Foxing is a reading app for classic literature. It offers 1,400+ free public domain books, an AI companion that helps you understand what you are reading, book clubs with chapter-by-chapter discussions, and a reading community. Available on iOS, Android, and web.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is Foxing free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: `Yes. The Foxing reader and all 1,400+ classic books are completely free. Foxing Plus (${PLUS_PRICE_MONTHLY_LABEL}) adds unlimited AI companion features, book clubs, and full reading stats. A ${PLUS_TRIAL_LABEL} is available.`,
      },
    },
    {
      '@type': 'Question',
      name: 'Does Foxing have an AI for reading?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: `Yes. Foxing includes an AI companion powered by Claude. Tap any word for a contextual definition. Tap any passage for analysis, historical context, or a plain English explanation. Ask the AI anything about the book without spoilers. Free users get ${FREE_AI_LOOKUPS_PER_DAY} AI lookups per day. Foxing Plus gives unlimited access.`,
      },
    },
  ],
})

export default async function HomePage() {
  const today = todayISODate()
  const [todaysPick, popular, passage, reviews, journalPosts, featuredPost] =
    await Promise.all([
      fetchTodaysPick(),
      fetchPopularThisWeek(8),
      fetchPassageOfDay(today),
      fetchCommunityReviews(3),
      getJournalPosts(5),
      getFeaturedJournalPost(),
    ])

  const journalCards: JournalPostSummary[] = featuredPost
    ? [
        featuredPost,
        ...journalPosts
          .filter((p) => p.slug !== featuredPost.slug)
          .slice(0, 2),
      ]
    : journalPosts.slice(0, 3)

  return (
    <div className="flex min-h-screen flex-col">
      <NavAuthClient />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: FAQ_JSONLD }}
      />
      <main className="flex-1">
        <Hero />
        <ValueProps />
        {todaysPick && <TodaysPick book={todaysPick} />}
        <PopularThisWeek books={popular} />
        {passage && <PassageOfDaySection passage={passage} />}
        {reviews.length > 0 && <CommunitySection reviews={reviews} />}
        {journalCards.length > 0 && <JournalStrip cards={journalCards} />}
        <DownloadCta />
      </main>
      <Footer />
    </div>
  )
}

function JournalStrip({ cards }: { cards: JournalPostSummary[] }) {
  return (
    <section className="bg-bg-base border-t border-border-subtle">
      <div className="mx-auto w-full max-w-page px-6 py-14">
        <div className="mb-6 flex items-center justify-between">
          <p className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
            From the Journal
          </p>
          <Link
            href="/journal"
            className="font-dm-mono text-[0.6875rem] text-text-tertiary hover:text-text-primary transition-colors"
          >
            All posts →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((post) => {
            const minutes = post.reading_time_minutes ?? null
            return (
              <Card
                key={post.slug}
                variant="content"
                href={`/journal/${post.slug}`}
                className="p-5 gap-2"
              >
                {post.tags[0] && (
                  <CardLabel>{post.tags[0].replace(/-/g, ' ')}</CardLabel>
                )}
                <CardTitle className="line-clamp-2">{post.title}</CardTitle>
                {minutes && minutes > 0 && (
                  <CardMeta className="mt-1">{minutes} min read</CardMeta>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function PassageOfDaySection({ passage }: { passage: PassageOfDay }) {
  return (
    <section className="bg-[var(--bg-surface)]">
      <PageWrapper className="py-16 md:py-20">
        <p className="mb-6 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Passage of the day
        </p>
        <figure className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <blockquote className="font-source-serif-4 text-[17px] italic leading-relaxed text-text-primary">
            &ldquo;{passage.text}&rdquo;
          </blockquote>
          <figcaption className="flex flex-col items-center gap-1">
            <Link
              href={`/book/${passage.book.slug ?? passage.book.id}`}
              className="font-dm-sans text-xs text-text-tertiary hover:text-text-primary"
            >
              <span className="font-medium text-text-secondary">
                {passage.book.title}
              </span>
              <span> · {passage.book.author}</span>
            </Link>
            {passage.author && (
              <span className="font-dm-sans text-[11px] text-text-tertiary">
                Saved by @{passage.author.username}
              </span>
            )}
          </figcaption>
          <Link
            href={`/passage/${passage.date}`}
            className="font-dm-sans text-sm text-brand-text hover:underline"
          >
            See today&apos;s passage
          </Link>
        </figure>
      </PageWrapper>
    </section>
  )
}

function Hero() {
  return (
    <section
      data-mode="dark"
      className="relative isolate overflow-hidden bg-bg-base text-[var(--text-on-dark)]"
    >
      <div
        aria-hidden="true"
        className="home-hero-fade absolute inset-y-0 right-0 hidden w-1/2 md:block"
      />
      <PageWrapper className="relative z-10 grid gap-10 py-20 md:grid-cols-2 md:py-28">
        <div className="flex max-w-[35rem] flex-col gap-5">
          <h1 className="font-fraunces text-[3.5rem] leading-none text-brand-ui md:text-[4rem]">
            Foxing
          </h1>
          <p className="font-source-serif-4 text-[1.375rem] italic text-text-secondary">
            reading, together.
          </p>
          <p className="font-source-serif-4 text-base text-text-tertiary">
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
                className="border border-border-default text-text-on-dark hover:bg-bg-surface"
              >
                Join free on web
              </Button>
            </Link>
          </div>
          <p className="mt-1 font-dm-sans text-xs text-text-tertiary">
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
            href={`/book/${book.slug ?? book.id}`}
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
                  href={`/book/${book.slug ?? book.id}`}
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
              <Link href={`/book/${book.slug ?? book.id}`}>
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
                  href={`/book/${r.book.slug ?? r.book.id}`}
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
      className="bg-[image:var(--gradient-dark)] text-text-on-dark"
    >
      <PageWrapper className="flex flex-col items-center gap-5 py-20 text-center md:py-24">
        <h2 className="max-w-2xl font-fraunces text-[2.25rem] leading-tight text-text-on-dark md:text-[2.5rem]">
          Read the classics. Finally understand them.
        </h2>
        <p className="font-source-serif-4 text-base text-text-secondary">
          Free to join. No credit card.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <StoreBadge
            label="App Store"
            sub="Download on the"
            href="https://apps.apple.com/app/foxing"
          />
          <StoreBadge
            label="Google Play"
            sub="Get it on"
            href="https://play.google.com/store/apps/details?id=app.foxing"
          />
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
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-12 items-center gap-3 rounded-lg border border-white/30 bg-black/30 px-5 hover:bg-black/50"
    >
      <span className="flex flex-col items-start leading-tight">
        <span className="font-dm-sans text-[10px] uppercase tracking-wider text-text-secondary">
          {sub}
        </span>
        <span className="font-dm-sans text-sm font-medium text-text-on-dark">
          {label}
        </span>
      </span>
    </a>
  )
}

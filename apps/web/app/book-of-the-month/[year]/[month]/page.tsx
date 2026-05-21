import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ReviewCard } from '@/components/review-card'
import { StarRating } from '@/components/ui/star-rating'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { WhereToRead } from '@/components/where-to-read'
import {
  fetchAdjacentMonth,
  fetchPicksForMonthWithRatings,
  monthName,
} from '@/lib/botm'
import { fetchBookReviews } from '@/lib/queries'
import { FOXING_BASE_URL, FOXING_SITE_NAME } from '@/lib/metadata'

export const revalidate = 86400

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 3).trimEnd()}...`
}

function parseParams(params: { year: string; month: string }) {
  const year = Number.parseInt(params.year, 10)
  const month = Number.parseInt(params.month, 10)
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 2020 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    return null
  }
  return { year, month }
}

export async function generateMetadata({
  params,
}: {
  params: { year: string; month: string }
}): Promise<Metadata> {
  const parsed = parseParams(params)
  if (!parsed) return { title: 'Book of the Month not found' }
  const picks = await fetchPicksForMonthWithRatings(parsed.year, parsed.month)
  const first = picks[0]
  if (!first) return { title: 'Book of the Month not found' }
  const monthLabel = monthName(first.month)
  const title = truncateText(
    `${monthLabel} ${first.year} Book of the Month`,
    70,
  )
  const description = truncateText(
    first.curator_note
      ? `${first.book.title} by ${first.book.author}. ${first.curator_note.slice(0, 100)}`
      : `${first.book.title} by ${first.book.author}, the Foxing pick for ${monthLabel} ${first.year}.`,
    160,
  )
  const ogParams = new URLSearchParams({
    type: 'book-of-month',
    title: first.book.title,
    author: first.book.author,
    month: monthLabel,
    year: String(first.year),
    ...(first.book.cover_url ? { cover: first.book.cover_url } : {}),
  })
  const url = `${FOXING_BASE_URL}/book-of-the-month/${first.year}/${first.month}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: FOXING_SITE_NAME,
      images: [
        {
          url: `${FOXING_BASE_URL}/og?${ogParams.toString()}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function BookOfMonthDetailPage({
  params,
}: {
  params: { year: string; month: string }
}) {
  const parsed = parseParams(params)
  if (!parsed) notFound()
  const { year, month } = parsed

  const [picks] = await Promise.all([
    fetchPicksForMonthWithRatings(year, month),
  ])
  if (picks.length === 0) notFound()

  const [prev, next] = await Promise.all([
    fetchAdjacentMonth(year, month, 'prev'),
    fetchAdjacentMonth(year, month, 'next'),
  ])

  const reviewsByBook = new Map<
    string,
    Awaited<ReturnType<typeof fetchBookReviews>>
  >()
  await Promise.all(
    picks.map(async (p) => {
      const reviews = await fetchBookReviews(p.book.id, 3)
      reviewsByBook.set(p.book.id, reviews)
    }),
  )

  const breadcrumbJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: FOXING_BASE_URL },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Book of the Month',
        item: `${FOXING_BASE_URL}/book-of-the-month`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${monthName(month)} ${year}`,
        item: `${FOXING_BASE_URL}/book-of-the-month/${year}/${month}`,
      },
    ],
  })

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }}
      />
      <main className="flex-1">
        <PageWrapper className="py-12">
          <nav className="font-dm-sans text-sm">
            <Link
              href="/book-of-the-month"
              className="text-brand-text hover:underline"
            >
              ← All picks
            </Link>
          </nav>
          <header className="mt-4">
            <h1 className="font-fraunces text-[2rem] text-text-primary md:text-[2.5rem]">
              {monthName(month)} {year} Book of the Month
            </h1>
          </header>

          <div className="mt-10 flex flex-col gap-16">
            {picks.map((pick) => (
              <PickBlock
                key={pick.id}
                pick={pick}
                reviews={reviewsByBook.get(pick.book.id) ?? []}
              />
            ))}
          </div>

          <nav className="mt-16 flex items-center justify-between border-t border-border-subtle pt-6 font-dm-sans text-sm">
            {prev ? (
              <Link
                href={`/book-of-the-month/${prev.year}/${prev.month}`}
                className="text-brand-text hover:underline"
              >
                ← {monthName(prev.month)} {prev.year}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/book-of-the-month/${next.year}/${next.month}`}
                className="text-brand-text hover:underline"
              >
                {monthName(next.month)} {next.year} →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function PickBlock({
  pick,
  reviews,
}: {
  pick: Awaited<ReturnType<typeof fetchPicksForMonthWithRatings>>[number]
  reviews: Awaited<ReturnType<typeof fetchBookReviews>>
}) {
  return (
    <article className="grid gap-10 md:grid-cols-[240px_1fr]">
      <div className="relative aspect-[2/3] w-full max-w-[240px] overflow-hidden rounded-lg bg-bg-sunken shadow-md">
        {pick.book.cover_url && (
          <Image
            src={pick.book.cover_url}
            alt={pick.book.title}
            fill
            sizes="240px"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-col gap-4">
        {pick.category && (
          <span className="font-dm-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">
            {pick.category}
          </span>
        )}
        <h2 className="font-fraunces text-3xl text-text-primary">
          <Link href={`/book/${pick.book.slug ?? pick.book.id}`} className="hover:text-brand-text">
            {pick.book.title}
          </Link>
        </h2>
        <p className="font-dm-sans text-base text-text-tertiary">
          by{' '}
          <Link
            href={`/author/${pick.book.author_slug ?? encodeURIComponent(pick.book.author)}`}
            className="text-brand-text hover:underline"
          >
            {pick.book.author}
          </Link>
        </p>
        {typeof pick.avg_rating === 'number' && pick.rating_count > 0 && (
          <div className="flex items-center gap-2">
            <StarRating value={pick.avg_rating} size="md" readOnly />
            <span className="font-dm-sans text-sm text-text-tertiary">
              {pick.avg_rating.toFixed(1)} from {pick.rating_count} ratings
            </span>
          </div>
        )}
        {pick.curator_note && (
          <p className="max-w-prose font-source-serif-4 text-lg italic leading-relaxed text-text-secondary">
            {pick.curator_note}
          </p>
        )}
        <div className="mt-2 flex flex-col gap-3 border-t border-border-subtle pt-5">
          <p className="font-dm-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">
            Where to read
          </p>
          <WhereToRead
            variant="inline"
            book={{
              id: pick.book.id,
              title: pick.book.title,
              author: pick.book.author,
              isbn: pick.book.isbn,
              isbn13: pick.book.isbn13,
              amazon_url: pick.amazon_url ?? null,
              bookshop_url: pick.bookshop_url ?? null,
              source_type: pick.book.source_type,
              epub_url: pick.book.epub_url,
            }}
          />
        </div>

        {reviews.length > 0 && (
          <section className="mt-6">
            <h3 className="font-dm-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">
              What readers said
            </h3>
            <div className="mt-3 flex flex-col gap-3">
              {reviews.map((r) => (
                <ReviewCard
                  key={r.id}
                  review={{
                    id: r.id,
                    user_id: r.user_id,
                    book_id: pick.book.id,
                    rating_half: r.rating,
                    review: r.review,
                    mood_tags: null,
                    pacing: null,
                    created_at: r.created_at,
                    author: r.author ?? undefined,
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  )
}

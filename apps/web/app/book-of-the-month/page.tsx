import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { StarRating } from '@/components/ui/star-rating'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { WhereToRead } from '@/components/where-to-read'
import { fetchPublishedPicksWithRatings } from '@/lib/botm'
import { monthName } from '@/lib/month'
import { FOXING_BASE_URL, FOXING_SITE_NAME } from '@/lib/metadata'
import { safeJsonLd } from '@/lib/structured-data'

export const revalidate = 3600

const SITE_NAME = FOXING_SITE_NAME

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 3).trimEnd()}...`
}

export async function generateMetadata(): Promise<Metadata> {
  const picks = await fetchPublishedPicksWithRatings()
  const current = picks[0]
  const title = 'Book of the Month'
  const description = current
    ? truncateText(
        `${current.book.title} by ${current.book.author} is the Foxing pick for ${monthName(
          current.month,
        )} ${current.year}.${
          current.curator_note ? ` ${current.curator_note.slice(0, 80)}` : ''
        }`,
        160,
      )
    : 'A curated pick each month from the Foxing editors. One book worth slowing down for.'
  const url = `${FOXING_BASE_URL}/book-of-the-month`
  const ogParams = new URLSearchParams({ type: 'book-of-month' })
  if (current) {
    ogParams.set('title', current.book.title)
    ogParams.set('author', current.book.author)
    ogParams.set('month', monthName(current.month))
    ogParams.set('year', String(current.year))
  }
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: SITE_NAME,
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

export default async function BookOfMonthListPage() {
  const [picks] = await Promise.all([
    fetchPublishedPicksWithRatings(),
  ])

  const [current, ...rest] = picks
  const byYear = new Map<number, typeof rest>()
  for (const p of rest) {
    const existing = byYear.get(p.year) ?? []
    existing.push(p)
    byYear.set(p.year, existing)
  }

  const breadcrumbJsonLd = safeJsonLd({
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
    ],
  })

  const currentBookJsonLd = current
    ? safeJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Book',
        name: current.book.title,
        author: { '@type': 'Person', name: current.book.author },
        description:
          current.curator_note ??
          current.book.description ??
          `Foxing pick for ${monthName(current.month)} ${current.year}.`,
        ...(current.book.cover_url ? { image: current.book.cover_url } : {}),
        ...(current.book.isbn ? { isbn: current.book.isbn } : {}),
      })
    : null

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }}
      />
      {currentBookJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: currentBookJsonLd }}
        />
      )}
      <main className="flex-1">
        <PageWrapper className="py-12">
          <header className="max-w-prose">
            <h1 className="font-fraunces text-[2.5rem] leading-tight text-text-primary">
              Book of the Month
            </h1>
            <p className="mt-3 font-source-serif-4 text-base text-text-secondary">
              Foxing&apos;s community-driven monthly pick.
            </p>
          </header>

          {current ? (
            <CurrentPick pick={current} />
          ) : (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              No published picks yet. Check back soon.
            </p>
          )}

          {byYear.size > 0 && (
            <section className="mt-16">
              <h2 className="font-fraunces text-2xl text-text-primary">
                Past picks
              </h2>
              <div className="mt-6 flex flex-col gap-10">
                {[...byYear.entries()]
                  .sort((a, b) => b[0] - a[0])
                  .map(([year, items]) => (
                    <div key={year}>
                      <h3 className="font-dm-mono text-sm uppercase tracking-[0.18em] text-text-tertiary">
                        {year}
                      </h3>
                      <ul className="mt-3 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
                        {items.map((p) => (
                          <li key={p.id}>
                            <Link
                              href={`/book-of-the-month/${p.year}/${p.month}`}
                              className="group flex flex-col gap-2"
                            >
                              <div className="relative aspect-[2/3] w-full overflow-hidden rounded bg-bg-sunken">
                                {p.book.cover_url && (
                                  <Image
                                    src={p.book.cover_url}
                                    alt={p.book.title}
                                    fill
                                    sizes="(min-width: 768px) 200px, 45vw"
                                    className="object-cover transition-transform group-hover:scale-[1.02]"
                                  />
                                )}
                              </div>
                              <p className="font-dm-mono text-xs uppercase tracking-wider text-text-tertiary">
                                {monthName(p.month)}
                              </p>
                              <p className="line-clamp-2 font-fraunces text-base text-text-primary group-hover:text-brand-text">
                                {p.book.title}
                              </p>
                              <p className="truncate font-dm-sans text-sm text-text-tertiary">
                                {p.book.author}
                              </p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function CurrentPick({
  pick,
}: {
  pick: Awaited<ReturnType<typeof fetchPublishedPicksWithRatings>>[number]
}) {
  return (
    <section className="mt-10 grid gap-10 md:grid-cols-[240px_1fr]">
      <div className="relative aspect-[2/3] w-full max-w-[240px] overflow-hidden rounded-lg bg-bg-sunken shadow-md">
        {pick.book.cover_url && (
          <Image
            src={pick.book.cover_url}
            alt={pick.book.title}
            fill
            priority
            sizes="240px"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-col gap-4">
        <span className="inline-flex w-fit items-center rounded-full bg-brand-subtle px-3 py-1 font-dm-mono text-xs uppercase tracking-wider text-brand-subtle-text">
          {monthName(pick.month)} {pick.year} pick
        </span>
        <h2 className="font-fraunces text-[2rem] leading-tight text-text-primary">
          <Link
            href={`/book/${pick.book.slug ?? pick.book.id}`}
            className="hover:text-brand-text"
          >
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
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href={`/clubs?book=${pick.book.id}`}>
            <Button variant="secondary" size="md">
              Join the book club
            </Button>
          </Link>
          <Link href={`/book/${pick.book.slug ?? pick.book.id}`}>
            <Button variant="ghost" size="md">
              Discuss on Foxing
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

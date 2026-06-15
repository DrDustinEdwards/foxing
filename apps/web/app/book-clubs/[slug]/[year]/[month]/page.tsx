import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { BookCoverPlaceholder } from '@/components/book-cover-placeholder'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  clubHasPickForMonth,
  fetchAdjacentPicksForClub,
  fetchAllPickStaticParams,
  fetchClubBySlug,
  fetchPickByClubSlugAndMonth,
  type MonthlyPicksRow,
} from '@/lib/book-clubs'
import { safeJsonLd } from '@/lib/structured-data'
import { monthName, nextMonth, previousMonth } from '@/lib/month'
import { resolveAffiliateLinks } from '@/lib/affiliate'
import { FOXING_BASE_URL, FOXING_SITE_NAME } from '@/lib/metadata'

export const revalidate = 3600

interface PageParams {
  slug: string
  year: string
  month: string
}

function parseParams(
  params: PageParams,
): { year: number; month: number } | null {
  const year = Number(params.year)
  const month = Number(params.month)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, month }
}

function formatMonth(month: number): string {
  return String(month).padStart(2, '0')
}

export async function generateStaticParams(): Promise<PageParams[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return []
  }
  return fetchAllPickStaticParams()
}

export async function generateMetadata(
  props: {
    params: Promise<PageParams>
  }
): Promise<Metadata> {
  const params = await props.params;
  const parsed = parseParams(params)
  if (!parsed) {
    return { title: 'Pick not found', robots: { index: false, follow: true } }
  }
  const { year, month } = parsed
  const pick = await fetchPickByClubSlugAndMonth(params.slug, year, month)
  if (!pick) {
    const club = await fetchClubBySlug(params.slug)
    if (!club) {
      return {
        title: 'Pick not found',
        robots: { index: false, follow: true },
      }
    }
    const title = `${club.name} pick for ${monthName(month)} ${year}`
    return {
      title,
      description: `No ${club.name} pick announced yet for ${monthName(month)} ${year}.`,
      robots: { index: false, follow: true },
    }
  }
  const monthLabel = monthName(month)
  const title = `${pick.club_full.name} Book Club Pick for ${monthLabel} ${year}: ${pick.book.title}`
  const curatorOpener =
    pick.club_full.curator ?? pick.club_full.short_name ?? pick.club_full.name
  const quoteSnippet = pick.curator_quote
    ? ` ${pick.curator_quote.slice(0, 120)}`
    : ''
  const description =
    `${curatorOpener} chose ${pick.book.title} by ${pick.book.author} as the ${pick.club_full.name} pick for ${monthLabel} ${year}.${quoteSnippet}`.replace(
      /\s+/g,
      ' ',
    )
  const url = `${FOXING_BASE_URL}/book-clubs/${pick.club_full.slug}/${year}/${formatMonth(month)}`
  const ogImage = pick.book.cover_url ?? `${FOXING_BASE_URL}/og`
  return {
    title: title.slice(0, 110),
    description: description.slice(0, 160),
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description: description.slice(0, 160),
      url,
      siteName: FOXING_SITE_NAME,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: description.slice(0, 160),
      images: [ogImage],
    },
  }
}

export default async function ClubMonthlyPickPage(
  props: {
    params: Promise<PageParams>
  }
) {
  const params = await props.params;
  const parsed = parseParams(params)
  if (!parsed) notFound()
  const { year, month } = parsed
  const monthLabel = monthName(month)

  const [pick] = await Promise.all([
    fetchPickByClubSlugAndMonth(params.slug, year, month),
  ])

  if (!pick) {
    const club = await fetchClubBySlug(params.slug)
    if (!club) notFound()
    const prev = previousMonth(year, month)
    const hasPrev = await clubHasPickForMonth(club.id, prev.year, prev.month)
    return (
      <div className="flex min-h-screen flex-col bg-bg-base">
        <NavAuthClient />
        <main className="flex-1">
          <PageWrapper className="py-12">
            <nav
              aria-label="Breadcrumb"
              className="font-dm-mono text-xs text-text-tertiary"
            >
              <Link
                href="/book-clubs"
                className="hover:text-text-primary"
              >
                Book Clubs
              </Link>
              <span aria-hidden="true"> &middot; </span>
              <Link
                href={`/book-clubs/${club.slug}`}
                className="hover:text-text-primary"
              >
                {club.name}
              </Link>
              <span aria-hidden="true"> &middot; </span>
              <span className="text-text-secondary">
                {monthLabel} {year}
              </span>
            </nav>
            <h1 className="mt-4 font-fraunces text-[2rem] text-text-primary">
              No {club.name} pick announced yet for {monthLabel} {year}.
            </h1>
            <p className="mt-3 font-source-serif-4 text-base text-text-secondary">
              Foxing auto-publishes new picks shortly after they appear. Check
              the previous month or come back soon.
            </p>
            {hasPrev && (
              <Link
                href={`/book-clubs/${club.slug}/${prev.year}/${formatMonth(prev.month)}`}
                className="mt-6 inline-block font-dm-sans text-sm text-brand-text hover:underline"
              >
                &larr; {monthName(prev.month)} {prev.year} pick
              </Link>
            )}
          </PageWrapper>
        </main>
        <Footer />
      </div>
    )
  }

  const adjacent = await fetchAdjacentPicksForClub(
    pick.club_full.id,
    year,
    month,
    3,
  )
  const prev = previousMonth(year, month)
  const next = nextMonth(year, month)
  const [hasPrevPick, hasNextPick] = await Promise.all([
    clubHasPickForMonth(pick.club_full.id, prev.year, prev.month),
    clubHasPickForMonth(pick.club_full.id, next.year, next.month),
  ])
  const affiliate = resolveAffiliateLinks({
    title: pick.book.title,
    author: pick.book.author,
    isbn: pick.book.isbn,
    isbn13: pick.book.isbn13,
    amazon_url: pick.book.amazon_url,
    bookshop_url: pick.book.bookshop_url,
  })

  const bookJsonLd = safeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: pick.book.title,
    author: {
      '@type': 'Person',
      name: pick.book.author,
      url: pick.book.author_slug
        ? `${FOXING_BASE_URL}/author/${pick.book.author_slug}`
        : undefined,
    },
    description: pick.curator_quote ?? undefined,
    url: `${FOXING_BASE_URL}/book/${pick.book.slug ?? pick.book.id}`,
    image: pick.book.cover_url ?? undefined,
    isbn: pick.book.isbn13 ?? pick.book.isbn ?? undefined,
  })

  const breadcrumbJsonLd = safeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Book Clubs',
        item: `${FOXING_BASE_URL}/book-clubs`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: pick.club_full.name,
        item: `${FOXING_BASE_URL}/book-clubs/${pick.club_full.slug}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${monthLabel} ${year}`,
        item: `${FOXING_BASE_URL}/book-clubs/${pick.club_full.slug}/${year}/${formatMonth(month)}`,
      },
    ],
  })

  const faqJsonLd = safeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What is ${pick.club_full.name}'s book club pick for ${monthLabel} ${year}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: pick.curator_quote
            ? `${pick.book.title} by ${pick.book.author}. ${pick.club_full.curator ?? pick.club_full.short_name ?? pick.club_full.name} said: ${pick.curator_quote.slice(0, 280)}`
            : `${pick.book.title} by ${pick.book.author}.`,
        },
      },
      {
        '@type': 'Question',
        name: `Who picked ${pick.book.title} for ${monthLabel} ${year}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${pick.club_full.curator ?? pick.club_full.short_name ?? pick.club_full.name} chose ${pick.book.title} as the ${pick.club_full.name} pick for ${monthLabel} ${year}.`,
        },
      },
    ],
  })

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: bookJsonLd }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: faqJsonLd }}
      />
      <main className="flex-1">
        <PageWrapper className="max-w-3xl py-10">
          <nav
            aria-label="Breadcrumb"
            className="font-dm-mono text-xs text-text-tertiary"
          >
            <Link
              href="/book-clubs"
              className="hover:text-text-primary"
            >
              Book Clubs
            </Link>
            <span aria-hidden="true"> &middot; </span>
            <Link
              href={`/book-clubs/${pick.club_full.slug}`}
              className="hover:text-text-primary"
            >
              {pick.club_full.name}
            </Link>
            <span aria-hidden="true"> &middot; </span>
            <span className="text-text-secondary">
              {monthLabel} {year}
            </span>
          </nav>

          <h1 className="mt-4 font-fraunces text-[2rem] leading-tight text-text-primary md:text-[2.5rem]">
            {pick.club_full.name} Pick for {monthLabel} {year}
          </h1>

          <section className="mt-8 grid gap-6 md:grid-cols-[200px_1fr]">
            <Link
              href={`/book/${pick.book.slug ?? pick.book.id}`}
              className="relative mx-auto aspect-[2/3] w-[200px] overflow-hidden rounded-md bg-bg-sunken shadow-md md:mx-0"
            >
              {pick.book.cover_url ? (
                <Image
                  src={pick.book.cover_url}
                  alt={`Cover of ${pick.book.title}`}
                  fill
                  sizes="200px"
                  className="object-cover"
                  priority
                />
              ) : (
                <BookCoverPlaceholder
                  title={pick.book.title}
                  author={pick.book.author}
                />
              )}
            </Link>
            <div className="flex flex-col gap-3">
              <h2 className="font-fraunces text-[1.75rem] leading-tight text-text-primary">
                <Link
                  href={`/book/${pick.book.slug ?? pick.book.id}`}
                  className="hover:text-brand-text"
                >
                  {pick.book.title}
                </Link>
              </h2>
              <p className="font-dm-sans text-base text-text-secondary">
                by{' '}
                {pick.book.author_slug ? (
                  <Link
                    href={`/author/${pick.book.author_slug}`}
                    className="text-brand-text hover:underline"
                  >
                    {pick.book.author}
                  </Link>
                ) : (
                  pick.book.author
                )}
              </p>
              {pick.curator_quote && (
                <figure className="mt-4 border-l-[3px] border-brand-ui pl-4">
                  <p className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
                    What {pick.club_full.curator ?? pick.club_full.short_name ?? pick.club_full.name} said
                  </p>
                  <blockquote className="mt-2 font-source-serif-4 text-[1.0625rem] italic leading-[1.8] text-text-primary">
                    {pick.curator_quote}
                  </blockquote>
                  <figcaption className="mt-2 font-dm-sans text-xs text-text-tertiary">
                    {(pick.club_full.curator ?? pick.club_full.short_name ?? pick.club_full.name)},{' '}
                    {pick.club_full.name}
                  </figcaption>
                </figure>
              )}
            </div>
          </section>

          <section className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={`/book/${pick.book.slug ?? pick.book.id}`}
              className="inline-flex h-11 items-center justify-center rounded-md bg-brand-ui px-5 font-dm-sans text-sm font-medium text-text-on-brand hover:brightness-[1.08]"
            >
              Add to your library
            </Link>
            <RetailerLink
              href={affiliate.bookshop}
              label="Find on Bookshop.org"
            />
            <RetailerLink href={affiliate.amazon} label="Amazon" />
            {pick.official_url && (
              <a
                href={pick.official_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-dm-sans text-sm text-brand-text hover:underline"
              >
                Official announcement
              </a>
            )}
          </section>

          <section className="mt-10 rounded-lg bg-bg-selected p-5">
            <p className="font-fraunces text-base text-brand-subtle-text">
              Reading {pick.book.title} with a group? Start a Foxing book club.
            </p>
            <Link
              href={`/clubs/new?book=${pick.book.id}`}
              className="mt-3 inline-flex h-10 items-center rounded-md bg-brand-ui px-4 font-dm-sans text-sm font-medium text-text-on-brand hover:brightness-[1.08]"
            >
              Create a club
            </Link>
          </section>

          {(hasPrevPick || hasNextPick || adjacent.length > 0) && (
            <section className="mt-10">
              <h2 className="mb-4 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
                Other months
              </h2>
              <nav
                aria-label="Other picks from this club"
                className="flex flex-col gap-2 font-dm-sans text-sm"
              >
                {hasPrevPick && (
                  <Link
                    href={`/book-clubs/${pick.club_full.slug}/${prev.year}/${formatMonth(prev.month)}`}
                    className="text-brand-text hover:underline"
                  >
                    &larr; {monthName(prev.month)} {prev.year}
                  </Link>
                )}
                {adjacent.length > 0 && (
                  <ul className="flex flex-col gap-1 font-dm-sans text-sm text-text-tertiary">
                    {adjacent.map((other) => (
                      <li key={other.id}>
                        <Link
                          href={`/book-clubs/${other.club_full.slug}/${other.pick_year}/${formatMonth(other.pick_month ?? 1)}`}
                          className="hover:text-text-primary"
                        >
                          {other.pick_year && other.pick_month
                            ? `${monthName(other.pick_month)} ${other.pick_year}: ${other.book.title}`
                            : other.book.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {hasNextPick && (
                  <Link
                    href={`/book-clubs/${pick.club_full.slug}/${next.year}/${formatMonth(next.month)}`}
                    className="text-brand-text hover:underline"
                  >
                    {monthName(next.month)} {next.year} &rarr;
                  </Link>
                )}
              </nav>
            </section>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function RetailerLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className="inline-flex h-11 items-center justify-center rounded-md border border-border-interactive bg-bg-surface px-4 font-dm-sans text-sm font-medium text-text-primary hover:bg-bg-hover"
    >
      {label}
    </a>
  )
}

import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchPicksForMonth,
  monthLabel,
  nextMonth,
  pickMonthLabel,
  previousMonth,
  type MonthlyPicksRow,
} from '@/lib/book-clubs'
import { getNavUser } from '@/lib/nav-user'
import { FOXING_BASE_URL, FOXING_SITE_NAME } from '@/lib/metadata'

export const revalidate = 3600

interface PageParams {
  year: string
  month: string
}

function parseParams(params: PageParams): { year: number; month: number } | null {
  const year = Number(params.year)
  const month = Number(params.month)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, month }
}

function formatMonth(month: number): string {
  return String(month).padStart(2, '0')
}

// Build-time only. Generates the last 24 months plus the current month so
// SEO catches recent and trailing roundups. Admin client because cookies()
// is not available outside a request scope.
export async function generateStaticParams(): Promise<PageParams[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return []
  }
  const out: PageParams[] = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    out.push({
      year: String(d.getUTCFullYear()),
      month: formatMonth(d.getUTCMonth() + 1),
    })
  }
  return out
}

export async function generateMetadata({
  params,
}: {
  params: PageParams
}): Promise<Metadata> {
  const parsed = parseParams(params)
  if (!parsed) {
    return { title: 'Picks not found', robots: { index: false, follow: true } }
  }
  const { year, month } = parsed
  const picks = await fetchPicksForMonth(year, month)
  const monthName = monthLabel(month)
  const title = `All Celebrity Book Club Picks for ${monthName} ${year}`
  const description =
    picks.length > 0
      ? `Every celebrity book club pick for ${monthName} ${year}: Oprah, Reese Witherspoon, Jenna Bush Hager, GMA, and ${picks.length - 4 > 0 ? `${picks.length - 4} more clubs` : 'more'}, in one place.`
      : `Celebrity book club picks for ${monthName} ${year} on Foxing.`
  const url = `${FOXING_BASE_URL}/book-clubs/picks/${year}/${formatMonth(month)}`
  return {
    title,
    description: description.slice(0, 160),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title,
      description: description.slice(0, 160),
      url,
      siteName: FOXING_SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title,
      description: description.slice(0, 160),
    },
  }
}

export default async function MonthlyRoundupPage({
  params,
}: {
  params: PageParams
}) {
  const parsed = parseParams(params)
  if (!parsed) notFound()
  const { year, month } = parsed
  const monthName = monthLabel(month)
  const label = pickMonthLabel(year, month)

  const [navUser, picks] = await Promise.all([
    getNavUser(),
    fetchPicksForMonth(year, month),
  ])

  const prev = previousMonth(year, month)
  const next = nextMonth(year, month)

  const jsonLd = buildItemListJsonLd(picks, year, month)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(label)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }}
      />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <nav
            aria-label="Breadcrumb"
            className="font-dm-mono text-xs text-text-tertiary"
          >
            <Link href="/book-clubs" className="hover:text-text-primary">
              Book Clubs
            </Link>
            <span aria-hidden="true"> · </span>
            <span className="text-text-secondary">{label}</span>
          </nav>

          <h1 className="mt-4 font-fraunces text-[2.25rem] leading-tight text-text-primary md:text-[2.5rem]">
            Celebrity Book Club Picks, {monthName} {year}
          </h1>
          <p className="mt-2 font-dm-sans text-sm text-text-tertiary">
            {picks.length}{' '}
            {picks.length === 1 ? 'club' : 'clubs'} ·{' '}
            Updated as picks are announced
          </p>

          {picks.length === 0 ? (
            <p className="mt-10 font-source-serif-4 text-base text-text-secondary">
              Picks are announced throughout the month. Check back soon.
            </p>
          ) : (
            <>
              <JumpNav picks={picks} />
              <div className="mt-10 grid gap-6 md:grid-cols-2">
                {picks.map((pick) => (
                  <PickCard key={pick.id} pick={pick} />
                ))}
              </div>
            </>
          )}

          <nav
            aria-label="Adjacent months"
            className="mt-12 flex items-center justify-between border-t border-border-subtle pt-6 font-dm-sans text-sm"
          >
            <Link
              href={`/book-clubs/picks/${prev.year}/${formatMonth(prev.month)}`}
              className="text-brand-text hover:underline"
            >
              ← {monthLabel(prev.month)} {prev.year}
            </Link>
            <Link
              href={`/book-clubs/picks/${next.year}/${formatMonth(next.month)}`}
              className="text-brand-text hover:underline"
            >
              {monthLabel(next.month)} {next.year} →
            </Link>
          </nav>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function clubAnchor(slug: string): string {
  return `club-${slug}`
}

function JumpNav({ picks }: { picks: MonthlyPicksRow[] }) {
  return (
    <nav
      aria-label="Jump to club"
      className="mt-6 flex flex-wrap gap-x-3 gap-y-1 font-dm-sans text-sm text-text-tertiary"
    >
      {picks.map((p, i) => (
        <span key={p.id} className="flex items-center gap-3">
          <Link
            href={`#${clubAnchor(p.club_full.slug)}`}
            className="text-brand-text hover:underline"
          >
            {p.club_full.short_name ?? p.club_full.name}
          </Link>
          {i < picks.length - 1 && <span aria-hidden="true">·</span>}
        </span>
      ))}
    </nav>
  )
}

function truncateText(s: string | null, max: number): string {
  if (!s) return ''
  if (s.length <= max) return s
  return `${s.slice(0, max - 3).trimEnd()}...`
}

function PickCard({ pick }: { pick: MonthlyPicksRow }) {
  const bookHref = `/book/${pick.book.slug ?? pick.book.id}`
  const clubPickHref = `/book-clubs/${pick.club_full.slug}/${pick.pick_year}/${formatMonth(pick.pick_month ?? 1)}`
  return (
    <article
      id={clubAnchor(pick.club_full.slug)}
      className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-bg-surface p-5 scroll-mt-20"
    >
      <header>
        <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          {pick.club_full.name}
        </p>
        {pick.club_full.curator && (
          <p className="font-dm-sans text-xs text-text-tertiary">
            {pick.club_full.curator}
          </p>
        )}
      </header>
      <div className="flex gap-4">
        <Link
          href={bookHref}
          className="relative h-[180px] w-[120px] shrink-0 overflow-hidden rounded-md bg-bg-sunken shadow-sm"
        >
          {pick.book.cover_url && (
            <Image
              src={pick.book.cover_url}
              alt={`Cover of ${pick.book.title}`}
              fill
              sizes="120px"
              className="object-cover"
            />
          )}
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-fraunces text-xl text-text-primary">
            <Link href={bookHref} className="hover:text-brand-text">
              {pick.book.title}
            </Link>
          </h2>
          <p className="font-dm-sans text-[13px] text-text-secondary">
            {pick.book.author}
          </p>
          {pick.curator_quote && (
            <blockquote className="mt-2 font-source-serif-4 text-[14px] italic text-text-secondary">
              {truncateText(pick.curator_quote, 160)}
            </blockquote>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-dm-sans text-sm">
        <Link
          href={clubPickHref}
          className="text-brand-text hover:underline"
        >
          See on Foxing
        </Link>
        {pick.official_announcement_url && (
          <a
            href={pick.official_announcement_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-text hover:underline"
          >
            Official pick
          </a>
        )}
      </div>
    </article>
  )
}

function buildItemListJsonLd(
  picks: MonthlyPicksRow[],
  year: number,
  month: number,
): string {
  const origin = FOXING_BASE_URL
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Celebrity Book Club Picks for ${monthLabel(month)} ${year}`,
    numberOfItems: picks.length,
    itemListElement: picks.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${origin}/book-clubs/${p.club_full.slug}/${p.pick_year}/${formatMonth(p.pick_month ?? 1)}`,
      item: {
        '@type': 'Book',
        name: p.book.title,
        author: { '@type': 'Person', name: p.book.author },
        url: `${origin}/book/${p.book.slug ?? p.book.id}`,
      },
    })),
  }
  return JSON.stringify(data)
}

function buildBreadcrumbJsonLd(label: string): string {
  const origin = FOXING_BASE_URL
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Book Clubs',
        item: `${origin}/book-clubs`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: label,
        item: `${origin}/book-clubs/picks`,
      },
    ],
  }
  return JSON.stringify(data)
}


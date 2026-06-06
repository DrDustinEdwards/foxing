import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  type Era,
  type ExternalPickWithBook,
  fetchAllPicksForClub,
  fetchClubBySlug,
} from '@/lib/book-clubs'
import { monthName } from '@/lib/month'
import { FOXING_BASE_URL, FOXING_SITE_NAME } from '@/lib/metadata'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 86400

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return []
  }
  const admin = createAdminClient()
  const { data } = await admin
    .from('external_book_clubs')
    .select('slug')
  return ((data as { slug: string | null }[] | null) ?? [])
    .filter((r): r is { slug: string } => Boolean(r.slug))
    .map((r) => ({ slug: r.slug }))
}

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 3).trimEnd()}...`
}

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const club = await fetchClubBySlug(params.slug)
  if (!club) return { title: 'Book club not found' }
  const title = truncateText(`${club.name}, Complete List of Picks`, 70)
  const description = truncateText(
    club.description ??
      `Every ${club.name} selection${
        club.curator ? `, curated by ${club.curator}` : ''
      }, with Foxing reader ratings and links to buy each pick.`,
    160,
  )
  const url = `${FOXING_BASE_URL}/book-clubs/${club.slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: FOXING_SITE_NAME,
      ...(club.logo_url
        ? { images: [{ url: club.logo_url, width: 600, height: 600 }] }
        : {}),
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function ExternalBookClubPage(
  props: {
    params: Promise<{ slug: string }>
  }
) {
  const params = await props.params;
  const club = await fetchClubBySlug(params.slug)
  if (!club) notFound()

  const [picks] = await Promise.all([
    fetchAllPicksForClub(club.id),
  ])

  const stats = await buildClubStats(picks)
  const eras = club.eras && club.eras.length > 0 ? club.eras : null

  const breadcrumbJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: FOXING_BASE_URL },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Celebrity Book Club Picks',
        item: `${FOXING_BASE_URL}/book-clubs`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: club.name,
        item: `${FOXING_BASE_URL}/book-clubs/${club.slug}`,
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
              href="/book-clubs"
              className="text-brand-text hover:underline"
            >
              &larr; All celebrity picks
            </Link>
          </nav>

          <header className="mt-6 flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
            {club.logo_url ? (
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-bg-sunken">
                <Image
                  src={club.logo_url}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div
                aria-hidden="true"
                className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-brand-subtle font-fraunces text-3xl text-brand-subtle-text"
              >
                {club.short_name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-fraunces text-[2rem] leading-tight text-text-primary md:text-[2.5rem]">
                {club.name}
              </h1>
              {club.curator && (
                <p className="mt-1 font-dm-sans text-base text-text-tertiary">
                  Curated by {club.curator}
                </p>
              )}
              {club.description && (
                <p className="mt-3 max-w-prose font-source-serif-4 text-base text-text-secondary">
                  {club.description}
                </p>
              )}
              {club.website_url && (
                <a
                  href={club.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block font-dm-sans text-sm text-brand-text hover:underline"
                >
                  Official site
                </a>
              )}
            </div>
          </header>

          {club.is_active === false && (
            <div
              role="note"
              className="mt-8 flex items-center gap-3 rounded-md border border-border-subtle bg-bg-sunken px-4 py-3 font-dm-sans text-sm text-text-tertiary"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 shrink-0"
              >
                <path d="M3 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4Zm1 4h12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm4 3a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Z" />
              </svg>
              <span>This club is no longer active.</span>
            </div>
          )}

          {picks.length === 0 ? (
            <p className="mt-12 font-source-serif-4 text-base text-text-tertiary">
              No published picks yet for this club.
            </p>
          ) : (
            <>
              <ClubStatsBar stats={stats} />
              {eras ? (
                <div className="mt-10 flex flex-col gap-14">
                  {groupPicksByEra(eras, picks).map((bucket) => (
                    <EraSection
                      key={bucket.era.label}
                      clubSlug={club.slug}
                      era={bucket.era}
                      picks={bucket.picks}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-10">
                  <PickTable clubSlug={club.slug} picks={picks} />
                </div>
              )}
            </>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

interface EraBucket {
  era: Era
  picks: ExternalPickWithBook[]
}

function groupPicksByEra(
  eras: Era[],
  picks: ExternalPickWithBook[],
): EraBucket[] {
  return eras.map((era) => ({
    era,
    picks: picks.filter((p) => {
      const year = p.pick_year ?? new Date(p.picked_at).getUTCFullYear()
      if (year < era.start_year) return false
      if (era.end_year !== null && year > era.end_year) return false
      return true
    }),
  }))
}

function EraSection({
  clubSlug,
  era,
  picks,
}: {
  clubSlug: string
  era: Era
  picks: ExternalPickWithBook[]
}) {
  const yearRange =
    era.end_year === null
      ? `${era.start_year}, present`
      : `${era.start_year}, ${era.end_year}`
  return (
    <section>
      <h2 className="font-fraunces text-2xl text-text-primary">{era.label}</h2>
      <p className="mt-1 font-dm-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">
        {yearRange} &middot; {picks.length} {picks.length === 1 ? 'pick' : 'picks'}
      </p>
      <p className="mt-3 max-w-prose font-source-serif-4 text-base text-text-secondary">
        {era.description}
      </p>
      <div className="mt-6">
        {picks.length === 0 ? (
          <p className="font-source-serif-4 text-sm text-text-tertiary">
            No picks recorded for this era.
          </p>
        ) : (
          <PickTable clubSlug={clubSlug} picks={picks} />
        )}
      </div>
    </section>
  )
}

function PickTable({
  clubSlug,
  picks,
}: {
  clubSlug: string
  picks: ExternalPickWithBook[]
}) {
  return (
    <ul className="flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
      {picks.map((pick) => {
        const year =
          pick.pick_year ?? new Date(pick.picked_at).getUTCFullYear()
        const monthHref =
          pick.pick_month && pick.pick_year
            ? `/book-clubs/${clubSlug}/${pick.pick_year}/${String(pick.pick_month).padStart(2, '0')}`
            : null
        const monthString = pick.pick_month
          ? `${monthName(pick.pick_month)} ${year}`
          : String(year)
        const innerRow = (
          <div className="grid grid-cols-[3.5rem_2.75rem_1fr] items-center gap-3 py-3 sm:grid-cols-[5.5rem_2.75rem_1fr_auto]">
            <span className="font-dm-mono text-xs uppercase tracking-wider text-text-tertiary">
              {monthString}
            </span>
            <span className="relative h-10 w-7 overflow-hidden rounded-sm bg-bg-sunken">
              {pick.book.cover_url && (
                <Image
                  src={pick.book.cover_url}
                  alt=""
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              )}
            </span>
            <span className="flex flex-col">
              <span className="font-fraunces text-base text-text-primary">
                {pick.book.title}
              </span>
              <span className="font-dm-sans text-sm text-text-tertiary">
                {pick.book.author}
              </span>
            </span>
            <span className="hidden font-dm-mono text-xs text-text-tertiary sm:inline">
              {pick.rating_count > 0 && typeof pick.avg_rating === 'number'
                ? `${pick.avg_rating.toFixed(1)} from ${pick.rating_count}`
                : ''}
            </span>
          </div>
        )
        return (
          <li key={pick.id}>
            {monthHref ? (
              <Link
                href={monthHref}
                className="block hover:bg-bg-sunken"
              >
                {innerRow}
              </Link>
            ) : (
              innerRow
            )}
          </li>
        )
      })}
    </ul>
  )
}

interface ClubStats {
  totalPicks: number
  firstYear: number | null
  topTheme: string | null
  avgRating: number | null
  ratingCount: number
  mostRecent: { month: number; year: number } | null
}

async function buildClubStats(
  picks: Awaited<ReturnType<typeof fetchAllPicksForClub>>,
): Promise<ClubStats> {
  if (picks.length === 0) {
    return {
      totalPicks: 0,
      firstYear: null,
      topTheme: null,
      avgRating: null,
      ratingCount: 0,
      mostRecent: null,
    }
  }
  let firstYear: number | null = null
  let mostRecent: { month: number; year: number } | null = null
  for (const p of picks) {
    const y = p.pick_year ?? new Date(p.picked_at).getUTCFullYear()
    if (firstYear == null || y < firstYear) firstYear = y
    const m = p.pick_month ?? new Date(p.picked_at).getUTCMonth() + 1
    if (
      !mostRecent ||
      y > mostRecent.year ||
      (y === mostRecent.year && m > mostRecent.month)
    ) {
      mostRecent = { month: m, year: y }
    }
  }
  let ratingSum = 0
  let ratingCount = 0
  for (const p of picks) {
    if (typeof p.avg_rating === 'number' && p.rating_count > 0) {
      ratingSum += p.avg_rating * p.rating_count
      ratingCount += p.rating_count
    }
  }
  const avgRating = ratingCount > 0 ? ratingSum / ratingCount : null

  let topTheme: string | null = null
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    const admin = createAdminClient()
    const ids = picks.map((p) => p.book.id)
    const { data } = await admin
      .from('books')
      .select('themes')
      .in('id', ids)
    const counts = new Map<string, number>()
    for (const row of (data as { themes: string[] | null }[] | null) ?? []) {
      if (!row.themes) continue
      for (const t of row.themes) {
        counts.set(t, (counts.get(t) ?? 0) + 1)
      }
    }
    let bestCount = 0
    for (const [theme, count] of counts) {
      if (count > bestCount) {
        bestCount = count
        topTheme = theme
      }
    }
  }

  return {
    totalPicks: picks.length,
    firstYear,
    topTheme,
    avgRating,
    ratingCount,
    mostRecent,
  }
}

function ClubStatsBar({ stats }: { stats: ClubStats }) {
  const parts: string[] = []
  if (stats.firstYear) {
    parts.push(`${stats.totalPicks} picks since ${stats.firstYear}`)
  } else {
    parts.push(`${stats.totalPicks} picks`)
  }
  if (stats.mostRecent) {
    parts.push(
      `Most recent: ${monthName(stats.mostRecent.month)} ${stats.mostRecent.year}`,
    )
  }
  if (stats.topTheme) {
    parts.push(`Most picked theme: ${stats.topTheme}`)
  }
  if (stats.avgRating != null) {
    parts.push(`Avg Foxing rating: ${stats.avgRating.toFixed(1)}/5`)
  }
  return (
    <p className="mt-10 font-dm-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">
      {parts.join(' \u00B7 ')}
    </p>
  )
}

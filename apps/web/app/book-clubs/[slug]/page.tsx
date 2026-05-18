import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { StarRating } from '@/components/ui/star-rating'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { WhereToRead } from '@/components/where-to-read'
import {
  fetchAllPicksForClub,
  fetchClubBySlug,
  monthLabel,
} from '@/lib/book-clubs'
import { getNavUser } from '@/lib/nav-user'
import { FOXING_BASE_URL, FOXING_SITE_NAME } from '@/lib/metadata'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 3600

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 3).trimEnd()}...`
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
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

export default async function ExternalBookClubPage({
  params,
}: {
  params: { slug: string }
}) {
  const club = await fetchClubBySlug(params.slug)
  if (!club) notFound()

  const [navUser, picks] = await Promise.all([
    getNavUser(),
    fetchAllPicksForClub(club.id),
  ])

  const stats = await buildClubStats(picks)

  const groupedByYear = new Map<number, typeof picks>()
  for (const pick of picks) {
    const year = pick.pick_year ?? new Date(pick.picked_at).getUTCFullYear()
    const existing = groupedByYear.get(year) ?? []
    existing.push(pick)
    groupedByYear.set(year, existing)
  }

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
      <Nav user={navUser} />
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
              ← All celebrity picks
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

          {picks.length === 0 ? (
            <p className="mt-12 font-source-serif-4 text-base text-text-tertiary">
              No published picks yet for this club.
            </p>
          ) : (
            <>
              <ClubStatsBar stats={stats} />
              <section className="mt-10 flex flex-col gap-12">
                {[...groupedByYear.entries()]
                .sort((a, b) => b[0] - a[0])
                .map(([year, items]) => (
                  <div key={year}>
                    <h2 className="font-fraunces text-2xl text-text-primary">
                      {year}
                    </h2>
                    <ul className="mt-4 flex flex-col gap-6">
                      {items.map((pick) => {
                        const monthHref =
                          pick.pick_month && pick.pick_year
                            ? `/book-clubs/${club.slug}/${pick.pick_year}/${String(pick.pick_month).padStart(2, '0')}`
                            : null
                        const monthString = pick.pick_month
                          ? `${monthLabel(pick.pick_month)} ${pick.pick_year ?? year}`
                          : pick.picked_at.slice(0, 10)
                        return (
                        <li
                          key={pick.id}
                          className="grid gap-4 rounded-lg border border-border-subtle bg-bg-surface p-4 md:grid-cols-[120px_1fr]"
                        >
                          <Link
                            href={`/book/${pick.book.slug ?? pick.book.id}`}
                            className="relative aspect-[2/3] w-[120px] overflow-hidden rounded bg-bg-sunken"
                          >
                            {pick.book.cover_url && (
                              <Image
                                src={pick.book.cover_url}
                                alt={pick.book.title}
                                fill
                                sizes="120px"
                                className="object-cover"
                              />
                            )}
                          </Link>
                          <div className="flex flex-col gap-3">
                            <div>
                              <p className="font-dm-mono text-xs uppercase tracking-wider text-text-tertiary">
                                {monthHref ? (
                                  <Link
                                    href={monthHref}
                                    className="hover:text-text-primary"
                                  >
                                    {monthString}
                                  </Link>
                                ) : (
                                  monthString
                                )}
                                {pick.category ? ` · ${pick.category}` : ''}
                              </p>
                              <h3 className="mt-1 font-fraunces text-xl text-text-primary">
                                <Link
                                  href={`/book/${pick.book.slug ?? pick.book.id}`}
                                  className="hover:text-brand-text"
                                >
                                  {pick.book.title}
                                </Link>
                              </h3>
                              <p className="font-dm-sans text-sm text-text-tertiary">
                                {pick.book.author}
                              </p>
                            </div>
                            {typeof pick.avg_rating === 'number' &&
                              pick.rating_count > 0 && (
                                <div className="flex items-center gap-2">
                                  <StarRating
                                    value={pick.avg_rating}
                                    size="sm"
                                    readOnly
                                  />
                                  <span className="font-dm-mono text-xs text-text-tertiary">
                                    {pick.avg_rating.toFixed(1)} from{' '}
                                    {pick.rating_count} ratings
                                  </span>
                                </div>
                              )}
                            {pick.notes && (
                              <p className="font-source-serif-4 text-sm text-text-secondary">
                                {pick.notes}
                              </p>
                            )}
                            <WhereToRead
                              variant="inline"
                              book={{
                                id: pick.book.id,
                                title: pick.book.title,
                                author: pick.book.author,
                                isbn: pick.book.isbn,
                                isbn13: pick.book.isbn13,
                                amazon_url: pick.book.amazon_url,
                                bookshop_url: pick.book.bookshop_url,
                                source_type: pick.book.source_type,
                                epub_url: pick.book.epub_url,
                              }}
                            />
                          </div>
                        </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </section>
            </>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

interface ClubStats {
  totalPicks: number
  firstYear: number | null
  topTheme: string | null
  avgRating: number | null
  ratingCount: number
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
    }
  }
  let firstYear: number | null = null
  for (const p of picks) {
    const y = p.pick_year ?? new Date(p.picked_at).getUTCFullYear()
    if (firstYear == null || y < firstYear) firstYear = y
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

  // Pull themes for top-genre. createAdminClient ensures the read succeeds
  // regardless of the visitor's session.
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
  }
}

function ClubStatsBar({ stats }: { stats: ClubStats }) {
  const parts: string[] = []
  if (stats.firstYear) {
    parts.push(`${stats.totalPicks} picks since ${stats.firstYear}`)
  } else {
    parts.push(`${stats.totalPicks} picks`)
  }
  if (stats.topTheme) {
    parts.push(`Most picked theme: ${stats.topTheme}`)
  }
  if (stats.avgRating != null) {
    parts.push(`Avg Foxing rating: ${stats.avgRating.toFixed(1)}/5`)
  }
  return (
    <p className="mt-10 font-dm-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">
      {parts.join(' · ')}
    </p>
  )
}

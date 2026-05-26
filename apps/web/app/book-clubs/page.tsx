import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Card, CardBody, CardTitle } from '@/components/ui/card'
import { StarRating } from '@/components/ui/star-rating'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { cn } from '@/lib/cn'
import {
  type ExternalClub,
  fetchActiveClubs,
  fetchCurrentMonthPicks,
  monthLabel,
} from '@/lib/book-clubs'
import { FOXING_BASE_URL, FOXING_SITE_NAME } from '@/lib/metadata'

export const revalidate = 3600

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 3).trimEnd()}...`
}

export async function generateMetadata(): Promise<Metadata> {
  const picks = await fetchCurrentMonthPicks()
  const now = new Date()
  const month = monthLabel(now.getUTCMonth() + 1)
  const year = now.getUTCFullYear()
  const title = 'Celebrity Book Club Picks, Oprah, Reese, Jenna and more'
  const lead = picks
    .slice(0, 3)
    .map((p) => `${p.book.title} (${p.club.short_name})`)
    .join(', ')
  const description = lead
    ? truncateText(
        `${month} ${year}: ${lead}. Every major book club pick with community ratings.`,
        160,
      )
    : 'Every major book club’s picks, rated by Foxing readers. Oprah, Reese, Jenna, GMA, and more.'
  const url = `${FOXING_BASE_URL}/book-clubs`
  return {
    title: truncateText(title, 70),
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: FOXING_SITE_NAME,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function BookClubsPage() {
  const [clubs, currentMonthPicks] = await Promise.all([
    fetchActiveClubs(),
    fetchCurrentMonthPicks(),
  ])

  const picksByClub = new Map<string, typeof currentMonthPicks>()
  for (const p of currentMonthPicks) {
    const existing = picksByClub.get(p.club_id) ?? []
    existing.push(p)
    picksByClub.set(p.club_id, existing)
  }

  const activeClubs = clubs.filter((c) => c.is_active !== false)
  const archivedClubs = clubs.filter((c) => c.is_active === false)

  const now = new Date()
  const month = monthLabel(now.getUTCMonth() + 1)

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
          <header className="max-w-prose">
            <h1 className="font-fraunces text-[2.5rem] leading-tight text-text-primary">
              Celebrity Book Club Picks
            </h1>
            <p className="mt-3 font-source-serif-4 text-base text-text-secondary">
              Every major book club&apos;s picks, rated by Foxing readers.
            </p>
          </header>

          {currentMonthPicks.length > 0 && (
            <section className="mt-12">
              <h2 className="font-fraunces text-2xl text-text-primary">
                {month} picks
              </h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {currentMonthPicks.map((pick) => (
                  <article
                    key={pick.id}
                    className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
                  >
                    <Link
                      href={`/book/${pick.book.slug ?? pick.book.id}`}
                      className="relative aspect-[2/3] w-full overflow-hidden rounded bg-bg-sunken"
                    >
                      {pick.book.cover_url && (
                        <Image
                          src={pick.book.cover_url}
                          alt={pick.book.title}
                          fill
                          sizes="(min-width: 1024px) 320px, 50vw"
                          className="object-cover"
                        />
                      )}
                    </Link>
                    <div>
                      <Link
                        href={`/book-clubs/${pick.club.slug}`}
                        className="font-dm-mono text-xs uppercase tracking-wider text-brand-text hover:underline"
                      >
                        {pick.club.short_name}
                      </Link>
                      <p className="mt-1 line-clamp-2 font-fraunces text-lg text-text-primary">
                        <Link
                          href={`/book/${pick.book.slug ?? pick.book.id}`}
                          className="hover:text-brand-text"
                        >
                          {pick.book.title}
                        </Link>
                      </p>
                      <p className="truncate font-dm-sans text-sm text-text-tertiary">
                        {pick.book.author}
                      </p>
                    </div>
                    {typeof pick.avg_rating === 'number' && pick.rating_count > 0 && (
                      <div className="flex items-center gap-2">
                        <StarRating value={pick.avg_rating} size="sm" readOnly />
                        <span className="font-dm-mono text-xs text-text-tertiary">
                          {pick.avg_rating.toFixed(1)} ({pick.rating_count})
                        </span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="mt-16">
            <h2 className="font-fraunces text-2xl text-text-primary">
              All clubs
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {activeClubs.map((club) => (
                <li key={club.id}>
                  <ClubCard club={club} />
                </li>
              ))}
            </ul>
          </section>

          {archivedClubs.length > 0 && (
            <section className="mt-16">
              <h2 className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                Archived Clubs
              </h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {archivedClubs.map((club) => (
                  <li key={club.id}>
                    <ClubCard club={club} archived />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function ClubCard({
  club,
  archived = false,
}: {
  club: ClubCardData
  archived?: boolean
}) {
  return (
    <Card
      variant="content"
      href={`/book-clubs/${club.slug}`}
      className={cn('p-5 gap-3', archived && 'opacity-75')}
    >
      <div className="flex items-start gap-4">
        {club.logo_url ? (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-bg-sunken">
            <Image
              src={club.logo_url}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded bg-brand-subtle font-fraunces text-xl text-brand-subtle-text"
          >
            {club.short_name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CardTitle>{club.name}</CardTitle>
            {archived && (
              <span className="rounded-sm border border-border-subtle px-1.5 py-0.5 font-dm-mono text-[0.625rem] uppercase tracking-wider text-text-tertiary">
                Archived
              </span>
            )}
          </div>
          {club.curator && (
            <p className="font-dm-sans text-sm text-text-tertiary">
              Curated by {club.curator}
            </p>
          )}
          {club.description && (
            <CardBody className="mt-2 line-clamp-2">{club.description}</CardBody>
          )}
        </div>
      </div>
    </Card>
  )
}

type ClubCardData = Pick<
  ExternalClub,
  'id' | 'slug' | 'name' | 'short_name' | 'curator' | 'description' | 'logo_url'
>

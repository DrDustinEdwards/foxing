import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { ShareButton } from '@/components/share-button'
import { fetchYearStats } from '@/lib/missing-pages-queries'
import { buildYearInReadingMetadata } from '@/lib/metadata'
import { getAuthedUserId } from '@/lib/nav-user'
import { siteOrigin } from '@/lib/foxing'

export const dynamic = 'force-dynamic'

const MIN_YEAR = 2000
const MAX_YEAR = new Date().getUTCFullYear()
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export async function generateMetadata(
  props: {
    params: Promise<{ year: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const year = Number(params.year)
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return { title: 'Year in reading', robots: { index: false, follow: false } }
  }
  return buildYearInReadingMetadata({ year })
}

export default async function YearInReadingPage(
  props: {
    params: Promise<{ year: string }>
  }
) {
  const params = await props.params;
  const year = Number(params.year)
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    notFound()
  }
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const stats = await fetchYearStats(userId, year)
  const shareUrl = `${siteOrigin()}/year/${year}`

  if (stats.books_count === 0) {
    return (
      <PageWrapper className="py-16">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <h1 className="font-fraunces text-3xl text-text-primary">
            Your {year} in reading
          </h1>
          <p className="font-source-serif-4 text-base text-text-secondary">
            Finish a book in {year} to start your recap.
          </p>
          <Link href="/library">
            <Button variant="primary" size="md">
              Go to library
            </Button>
          </Link>
        </div>
      </PageWrapper>
    )
  }

  return (
    <div className="bg-[#16100B] text-white">
      <PageWrapper className="py-16 md:py-24">
        <header className="flex flex-col gap-2 text-center">
          <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-white/60">
            Your year in reading
          </p>
          <h1 className="font-fraunces text-[3rem] leading-none text-white md:text-[4rem]">
            {year}
          </h1>
        </header>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Stat label="Books finished" value={stats.books_count.toString()} />
          <Stat
            label="Pages read"
            value={stats.pages_count.toLocaleString()}
          />
          <Stat
            label="Highlights"
            value={stats.highlight_count.toString()}
          />
          <Stat
            label="Average rating"
            value={
              stats.average_rating
                ? `${stats.average_rating.toFixed(1)}★`
                : 'No ratings'
            }
          />
          <Stat label="Top genre" value={stats.top_genre ?? 'Mixed'} />
          <Stat label="Top author" value={stats.top_author ?? 'Various'} />
        </div>

        {(stats.longest_book || stats.shortest_book) && (
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {stats.longest_book && (
              <DetailCard
                label="Longest"
                heading={stats.longest_book.title}
                sub={`${stats.longest_book.pages.toLocaleString()} pages`}
              />
            )}
            {stats.shortest_book && (
              <DetailCard
                label="Shortest"
                heading={stats.shortest_book.title}
                sub={`${stats.shortest_book.pages.toLocaleString()} pages`}
              />
            )}
          </div>
        )}

        {stats.most_active_month && (
          <div className="mt-10 rounded-lg border border-white/10 bg-white/5 p-6 text-center">
            <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-white/60">
              Most active month
            </p>
            <p className="mt-2 font-fraunces text-2xl text-white">
              {MONTH_NAMES[stats.most_active_month.month]}
            </p>
            <p className="mt-1 font-source-serif-4 text-sm text-white/70">
              {stats.most_active_month.count} books finished
            </p>
          </div>
        )}

        {stats.finished_books.length > 0 && (
          <section className="mt-12">
            <p className="mb-4 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-white/60">
              What you read
            </p>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {stats.finished_books.map((b) => (
                <li key={b.book_id}>
                  <Link href={`/book/${b.book_id}`} className="block">
                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded shadow-md">
                      {b.cover_url ? (
                        <Image
                          src={b.cover_url}
                          alt={b.title}
                          fill
                          sizes="120px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-white/10 p-2 text-center font-fraunces text-xs text-white/70">
                          {b.title}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <ShareButton url={shareUrl} text={`My ${year} in reading on Foxing`} />
          <Link href="/stats">
            <Button variant="secondary" size="md">
              See all-time stats
            </Button>
          </Link>
        </div>
      </PageWrapper>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-5">
      <p className="font-fraunces text-3xl text-white">{value}</p>
      <p className="mt-1 font-dm-sans text-xs uppercase tracking-wide text-white/60">
        {label}
      </p>
    </div>
  )
}

function DetailCard({
  label,
  heading,
  sub,
}: {
  label: string
  heading: string
  sub: string
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-5">
      <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-white/60">
        {label}
      </p>
      <p className="mt-2 font-fraunces text-lg text-white">{heading}</p>
      <p className="mt-1 font-source-serif-4 text-sm text-white/70">{sub}</p>
    </div>
  )
}

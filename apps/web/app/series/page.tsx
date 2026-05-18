import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchSeriesIndex } from '@/lib/missing-pages-queries'
import { buildSeriesIndexMetadata } from '@/lib/metadata-extras'
import { getNavUser } from '@/lib/nav-user'

export const revalidate = 3600

export const metadata: Metadata = buildSeriesIndexMetadata()

export default async function SeriesIndexPage() {
  const [navUser, series] = await Promise.all([
    getNavUser(),
    fetchSeriesIndex(),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-col gap-2">
            <h1 className="font-fraunces text-[2rem] text-text-primary">
              Series
            </h1>
            <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
              Multi-book series available on Foxing, in reading order.
            </p>
          </header>

          {series.length === 0 ? (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              No series cataloged yet.
            </p>
          ) : (
            <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {series.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/series/${s.slug}`}
                    className="flex h-full flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4 transition-shadow hover:shadow-md"
                  >
                    <SeriesCovers covers={s.covers} title={s.name} />
                    <div className="flex flex-col gap-1">
                      <h2 className="font-fraunces text-base text-text-primary">
                        {s.name}
                      </h2>
                      <p className="font-dm-mono text-[11px] text-text-tertiary">
                        {s.book_count} {s.book_count === 1 ? 'book' : 'books'}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function SeriesCovers({
  covers,
  title,
}: {
  covers: Array<string | null>
  title: string
}) {
  const filled = covers.slice(0, 3)
  while (filled.length < 3) filled.push(null)
  return (
    <div className="relative flex h-32 items-center">
      {filled.map((url, i) => (
        <div
          key={i}
          className="relative h-28 w-20 shrink-0 overflow-hidden rounded-sm bg-bg-sunken shadow-sm"
          style={{
            marginLeft: i === 0 ? 0 : '-1.25rem',
            zIndex: filled.length - i,
            transform: `rotate(${(i - 1) * 2}deg)`,
          }}
        >
          {url && (
            <Image
              src={url}
              alt={`${title} cover ${i + 1}`}
              fill
              sizes="80px"
              className="object-cover"
            />
          )}
        </div>
      ))}
    </div>
  )
}

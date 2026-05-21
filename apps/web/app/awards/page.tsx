import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  AWARD_CATEGORIES,
  fetchAwardWinners,
  type AwardCategory,
  type AwardBookHit,
} from '@/lib/missing-pages-queries'
import { buildAwardsMetadata } from '@/lib/metadata'

export const revalidate = 86400

export const metadata: Metadata = buildAwardsMetadata()

export default async function AwardsPage() {
  const sections = await Promise.all(
    AWARD_CATEGORIES.map(async (cat) => ({
      cat,
      books: await fetchAwardWinners(cat, 8),
    })),
  )

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-col gap-2">
            <h1 className="font-fraunces text-[2.25rem] text-text-primary">
              Award-winning classics
            </h1>
            <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
              Nobel, Pulitzer, and other major literary awards represented in
              the Foxing catalog.
            </p>
          </header>

          <div className="mt-10 flex flex-col gap-12">
            {sections.map(({ cat, books }) => (
              <AwardSection key={cat.slug} category={cat} books={books} />
            ))}
          </div>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function AwardSection({
  category,
  books,
}: {
  category: AwardCategory
  books: AwardBookHit[]
}) {
  const searchHref = `/search?q=${encodeURIComponent(category.searchTerms[0] ?? category.name)}`
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-fraunces text-xl text-text-primary">
            {category.name}
          </h2>
          <p className="mt-1 max-w-prose font-source-serif-4 text-sm text-text-tertiary">
            {category.blurb}
          </p>
        </div>
        <Link
          href={searchHref}
          className="shrink-0 font-dm-sans text-sm text-brand-text hover:underline"
        >
          Search all
        </Link>
      </div>
      {books.length === 0 ? (
        <p className="font-source-serif-4 text-sm italic text-text-tertiary">
          No winners cataloged yet, search the catalog for {category.name}.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {books.map((b) => (
            <li key={b.id}>
              <Link
                href={`/book/${b.slug ?? b.id}`}
                className="group flex flex-col gap-2"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-bg-sunken shadow-sm transition-shadow group-hover:shadow-md">
                  {b.cover_url && (
                    <Image
                      src={b.cover_url}
                      alt={b.title}
                      fill
                      sizes="(max-width: 768px) 45vw, 18vw"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-col">
                  <p className="truncate font-fraunces text-sm text-text-primary">
                    {b.title}
                  </p>
                  <p className="truncate font-dm-sans text-xs text-text-tertiary">
                    {b.author}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

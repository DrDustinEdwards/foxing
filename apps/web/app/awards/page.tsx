import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { BookCover } from '@/components/ui/book-cover'
import {
  AWARD_BLURBS,
  fetchAwardWinners,
  fetchPresentAwards,
  type AwardBookHit,
  type PresentAward,
} from '@/lib/missing-pages-queries'
import { buildAwardsMetadata } from '@/lib/metadata'

export const revalidate = 86400

export const metadata: Metadata = buildAwardsMetadata()

export default async function AwardsPage() {
  const awards = await fetchPresentAwards()
  const sections = await Promise.all(
    awards.map(async (award) => ({
      award,
      books: await fetchAwardWinners(award.award_slug),
    })),
  )

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <PageHeader
            title="Award-winning classics"
            subtitle="Nobel, Pulitzer, and other major literary awards represented in the Foxing catalog."
            subtitleVariant="description"
          />

          <div className="mt-10 flex flex-col gap-12">
            {sections
              .filter(({ books }) => books.length > 0)
              .map(({ award, books }) => (
                <AwardSection
                  key={award.award_slug}
                  award={award}
                  books={books}
                />
              ))}
          </div>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function AwardSection({
  award,
  books,
}: {
  award: PresentAward
  books: AwardBookHit[]
}) {
  const heading =
    award.scope === 'author' ? 'Books by Nobel laureates' : award.award_name
  const blurb = AWARD_BLURBS[award.award_slug]
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-fraunces text-xl text-text-primary">{heading}</h2>
        {blurb && (
          <p className="mt-1 max-w-prose font-source-serif-4 text-sm text-text-tertiary">
            {blurb}
          </p>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {books.map((b) => (
          <li key={`${b.id}-${b.year}`}>
            <Link
              href={`/book/${b.slug ?? b.id}`}
              className="group flex flex-col gap-2"
            >
              <BookCover>
                {b.cover_url && (
                  <Image
                    src={b.cover_url}
                    alt={b.title}
                    fill
                    sizes="(max-width: 768px) 45vw, 18vw"
                    className="object-cover"
                  />
                )}
              </BookCover>
              <div className="flex flex-col">
                <p className="truncate font-fraunces text-sm text-text-primary">
                  {b.title}
                </p>
                <p className="truncate font-dm-sans text-xs text-text-tertiary">
                  {b.author}
                </p>
                <p className="mt-0.5 truncate font-dm-sans text-xs text-brand-text">
                  {award.scope === 'author'
                    ? `Nobel Prize in Literature ${b.year}`
                    : `Winner ${b.year}`}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

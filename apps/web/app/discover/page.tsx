import Image from 'next/image'
import Link from 'next/link'
import { BookCard } from '@/components/book-card'
import { BookCoverPlaceholder } from '@/components/book-cover-placeholder'
import { Button } from '@/components/ui/button'
import { ClubCard } from '@/components/club-card'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { SearchBar } from '@/components/search-bar'
import { CollapsibleSection } from '@/components/collapsible-section'
import {
  fetchActiveClubs,
  fetchPopularThisWeek,
  fetchTodaysPick,
} from '@/lib/queries'
import { ERAS, LENGTHS, MOODS, appBookDeeplink } from '@/lib/foxing'
import { buildDiscoverMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const popular = await fetchPopularThisWeek(2)
  return buildDiscoverMetadata(popular.map((b) => b.title))
}

export default async function DiscoverPage() {
  const [todaysPick, popular, clubs] = await Promise.all([
    fetchTodaysPick(),
    fetchPopularThisWeek(8),
    fetchActiveClubs(3),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="flex flex-col gap-10 py-10">
          <SearchBar />

          {todaysPick && <TodaysPickCard book={todaysPick} />}

          <MoodPromptCard />

          <MoodChips />

          {popular.length > 0 && (
            <section>
              <h2 className="mb-4 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
                Popular this week
              </h2>
              <div className="-mx-6 overflow-x-auto px-6 md:mx-0 md:px-0">
                <div className="flex gap-4 pb-2">
                  {popular.map((b) => (
                    <BookCard key={b.id} book={b} size="md" />
                  ))}
                </div>
              </div>
            </section>
          )}

          <BrowseBy />

          {clubs.length > 0 && (
            <section>
              <h2 className="mb-4 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
                Clubs looking for readers
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                {clubs.map((c) => (
                  <ClubCard
                    key={c.id}
                    club={{ id: c.id, name: c.name, cover_url: c.cover_url }}
                    currentBook={
                      c.current_book
                        ? {
                            title: c.current_book.title,
                            cover_url: c.current_book.cover_url,
                          }
                        : null
                    }
                    memberCount={c.member_count}
                  />
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

function TodaysPickCard({
  book,
}: {
  book: Awaited<ReturnType<typeof fetchTodaysPick>> & object
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-bg-surface p-5">
      <p className="mb-4 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
        Today&apos;s pick
      </p>
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <Link
          href={`/book/${book.slug ?? book.id}`}
          className="relative aspect-[2/3] w-[140px] shrink-0 overflow-hidden rounded-md bg-bg-sunken shadow-sm"
        >
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={book.title}
              fill
              sizes="140px"
              className="object-cover"
            />
          ) : (
            <BookCoverPlaceholder title={book.title} author={book.author} />
          )}
        </Link>
        <div className="flex flex-col gap-2">
          <Link
            href={`/book/${book.slug ?? book.id}`}
            className="font-fraunces text-xl text-text-primary hover:text-brand-text"
          >
            {book.title}
          </Link>
          <p className="font-dm-sans text-sm text-text-tertiary">{book.author}</p>
          {book.description && (
            <p className="font-source-serif-4 text-sm text-text-secondary">
              {book.description.length > 220
                ? `${book.description.slice(0, 220).trimEnd()}...`
                : book.description}
            </p>
          )}
          <div className="mt-2">
            <Link href={appBookDeeplink(book.id)}>
              <Button variant="primary" size="sm">
                Read in Foxing
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function MoodPromptCard() {
  return (
    <Link
      href="/find-next-book"
      className="block rounded-lg bg-brand-subtle p-5 transition-colors hover:bg-bg-selected"
    >
      <p className="font-fraunces text-lg text-brand-subtle-text">
        Not sure what to read?
      </p>
      <p className="mt-1 font-dm-sans text-sm font-medium text-brand-text">
        Find your next book →
      </p>
    </Link>
  )
}

function MoodChips() {
  return (
    <section>
      <h2 className="mb-3 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
        Browse by mood
      </h2>
      <div className="flex flex-wrap gap-2">
        {MOODS.map((mood) => (
          <Link
            key={mood}
            href={`/books?mood=${mood}`}
            className="rounded-full bg-brand-subtle px-3 py-1.5 font-dm-sans text-sm capitalize text-brand-subtle-text hover:bg-bg-hover"
          >
            {mood}
          </Link>
        ))}
      </div>
    </section>
  )
}

function BrowseBy() {
  return (
    <CollapsibleSection heading="Browse by">
      <div className="flex flex-col gap-5">
        <div>
          <p className="mb-2 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
            Era
          </p>
          <div className="flex flex-wrap gap-2">
            {ERAS.map((era) => (
              <Link
                key={era.value}
                href={`/books?era=${era.value}`}
                className="rounded-full bg-bg-sunken px-3 py-1.5 font-dm-sans text-sm text-text-secondary hover:bg-bg-hover"
              >
                {era.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
            Length
          </p>
          <div className="flex flex-wrap gap-2">
            {LENGTHS.map((l) => (
              <Link
                key={l.value}
                href={`/books?length=${l.value}`}
                className="rounded-full bg-bg-sunken px-3 py-1.5 font-dm-sans text-sm text-text-secondary hover:bg-bg-hover"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  )
}

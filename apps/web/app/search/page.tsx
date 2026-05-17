import Link from 'next/link'
import type { Metadata } from 'next'
import { BookCard } from '@/components/book-card'
import { ClubCard } from '@/components/club-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { SearchBar } from '@/components/search-bar'
import { UserCard } from '@/components/user-card'
import { searchAll } from '@/lib/queries'
import { getNavUser } from '@/lib/nav-user'
import { cn } from '@/lib/cn'
import { siteOrigin } from '@/lib/foxing'

export const dynamic = 'force-dynamic'

type Tab = 'books' | 'people' | 'clubs'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { q?: string }
}): Promise<Metadata> {
  const q = searchParams.q ?? ''
  return {
    title: q ? `Search: ${q} · Foxing` : 'Search · Foxing',
    alternates: { canonical: `${siteOrigin()}/search` },
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: Tab }
}) {
  const navUser = await getNavUser()
  const q = (searchParams.q ?? '').trim()
  const tab: Tab = searchParams.type ?? 'books'
  const results = q
    ? await searchAll(q)
    : { books: [], people: [], clubs: [] }

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <SearchBar defaultValue={q} />
          {q ? (
            <>
              <TabBar
                tab={tab}
                q={q}
                counts={{
                  books: results.books.length,
                  people: results.people.length,
                  clubs: results.clubs.length,
                }}
              />
              <Results tab={tab} results={results} q={q} />
            </>
          ) : (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              Search books, readers, and clubs.
            </p>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function TabBar({
  tab,
  q,
  counts,
}: {
  tab: Tab
  q: string
  counts: { books: number; people: number; clubs: number }
}) {
  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'books', label: 'Books', count: counts.books },
    { id: 'people', label: 'People', count: counts.people },
    { id: 'clubs', label: 'Clubs', count: counts.clubs },
  ]
  return (
    <nav
      aria-label="Search categories"
      className="mt-8 flex gap-2 border-b border-border-subtle"
    >
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={`/search?q=${encodeURIComponent(q)}&type=${t.id}`}
          className={cn(
            '-mb-px border-b-2 px-4 py-2 font-dm-sans text-sm transition-colors',
            tab === t.id
              ? 'border-brand-ui text-text-primary'
              : 'border-transparent text-text-tertiary hover:text-text-primary',
          )}
        >
          {t.label}
          <span className="ml-2 font-dm-mono text-xs text-text-tertiary">
            {t.count}
          </span>
        </Link>
      ))}
    </nav>
  )
}

function Results({
  tab,
  results,
  q,
}: {
  tab: Tab
  results: Awaited<ReturnType<typeof searchAll>>
  q: string
}) {
  if (tab === 'books') {
    if (results.books.length === 0) return <NoResults q={q} kind="books" />
    return (
      <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
        {results.books.map((b) => (
          <BookCard key={b.id} book={b} size="md" />
        ))}
      </div>
    )
  }
  if (tab === 'people') {
    if (results.people.length === 0) return <NoResults q={q} kind="people" />
    return (
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {results.people.map((p) => (
          <UserCard
            key={p.id}
            profile={{
              username: p.username,
              display_name: p.display_name,
              avatar_url: p.avatar_url,
              reading_personality: p.reading_personality,
            }}
          />
        ))}
      </div>
    )
  }
  if (results.clubs.length === 0) return <NoResults q={q} kind="clubs" />
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-3">
      {results.clubs.map((c) => (
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
  )
}

function NoResults({ q, kind }: { q: string; kind: Tab }) {
  return (
    <div className="mt-10">
      <EmptyState
        heading={`No ${kind} match “${q}”.`}
        action={
          <Link
            href="/books"
            className="font-dm-sans text-sm text-brand-text hover:underline"
          >
            Browse all books
          </Link>
        }
      />
    </div>
  )
}

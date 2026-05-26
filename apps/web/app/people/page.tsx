import Link from 'next/link'
import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Card, CardMeta } from '@/components/ui/card'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchPublicPeople, type PeopleSort } from '@/lib/missing-pages-queries'
import { buildPeopleMetadata } from '@/lib/metadata'
import { cn } from '@/lib/cn'

export const revalidate = 600

const SORTS: Array<{ id: PeopleSort; label: string }> = [
  { id: 'most_books', label: 'Most books' },
  { id: 'most_active', label: 'Most active' },
  { id: 'newest', label: 'New members' },
]

export const metadata: Metadata = buildPeopleMetadata()

export default async function PeoplePage(
  props: {
    searchParams: Promise<{ sort?: PeopleSort; q?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const sort = SORTS.find((s) => s.id === searchParams.sort)?.id ?? 'most_books'
  const search = searchParams.q?.trim() || undefined
  const people = await fetchPublicPeople({ sort, search, limit: 48 })

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <h1 className="font-fraunces text-[2rem] text-text-primary">
                Readers
              </h1>
              <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
                People reading classic literature on Foxing.
              </p>
            </div>
            <Link
              href="/people/similar"
              className="inline-flex h-9 items-center rounded-md border border-border-interactive bg-bg-surface px-3 font-dm-sans text-sm text-text-primary hover:bg-bg-hover"
            >
              Find similar readers
            </Link>
          </header>

          <form
            action="/people"
            method="get"
            className="mt-6 flex w-full max-w-md items-center gap-2 rounded-lg border border-border-interactive bg-bg-surface px-3 py-2"
          >
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Search by name or username"
              className="flex-1 bg-transparent font-dm-sans text-base text-text-primary placeholder:text-text-tertiary focus:outline-none"
              autoComplete="off"
            />
            {sort !== 'most_books' && (
              <input type="hidden" name="sort" value={sort} />
            )}
          </form>

          <nav
            aria-label="Sort"
            className="mt-6 flex flex-wrap gap-1 border-b border-border-subtle"
          >
            {SORTS.map((s) => {
              const params = new URLSearchParams()
              if (s.id !== 'most_books') params.set('sort', s.id)
              if (search) params.set('q', search)
              const href = `/people${params.toString() ? `?${params}` : ''}`
              return (
                <Link
                  key={s.id}
                  href={href}
                  className={cn(
                    '-mb-px border-b-2 px-4 py-2 font-dm-sans text-sm transition-colors',
                    sort === s.id
                      ? 'border-brand-ui text-text-primary'
                      : 'border-transparent text-text-tertiary hover:text-text-primary',
                  )}
                >
                  {s.label}
                </Link>
              )
            })}
          </nav>

          {people.length === 0 ? (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              No public readers match that yet.
            </p>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {people.map((p) => (
                <Card
                  key={p.id}
                  variant="entity"
                  href={`/u/${p.username}`}
                  className="p-4 gap-3"
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={p.avatar_url}
                      name={p.display_name}
                      size="md"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-dm-sans text-sm font-medium text-text-primary">
                        {p.display_name}
                      </span>
                      <span className="truncate font-dm-sans text-xs text-text-tertiary">
                        @{p.username}
                      </span>
                    </div>
                  </div>
                  {p.reading_personality && (
                    <p className="line-clamp-2 font-source-serif-4 text-sm italic text-text-tertiary">
                      {p.reading_personality}
                    </p>
                  )}
                  <CardMeta>
                    {p.books_count} books · {p.highlight_count} highlights
                  </CardMeta>
                </Card>
              ))}
            </div>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

import Link from 'next/link'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { Card } from '@/components/ui/card'
import { LikeListButton } from '@/components/ui/like-list-button'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchPublicLists,
  type ListsSort,
  type PublicListRow,
} from '@/lib/missing-pages-queries'
import { buildListsIndexMetadata } from '@/lib/metadata'
import { getAuthedUserId } from '@/lib/nav-user'
import { cn } from '@/lib/cn'

export const revalidate = 600

const SORTS: Array<{ id: ListsSort; label: string }> = [
  { id: 'most_liked', label: 'Most liked' },
  { id: 'newest', label: 'Newest' },
  { id: 'featured', label: 'Featured' },
]

export const metadata: Metadata = buildListsIndexMetadata()

export default async function PublicListsPage(
  props: {
    searchParams: Promise<{ sort?: ListsSort }>
  }
) {
  const searchParams = await props.searchParams;
  const sort = SORTS.find((s) => s.id === searchParams.sort)?.id ?? 'most_liked'
  const [userId] = await Promise.all([
    getAuthedUserId(),
  ])
  const lists = await fetchPublicLists({ sort, limit: 48, userId })

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-col gap-2">
            <h1 className="font-fraunces text-[2rem] text-text-primary">
              Reading lists
            </h1>
            <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
              Curated reading lists from the Foxing community.
            </p>
          </header>

          <nav
            aria-label="Sort"
            className="mt-6 flex flex-wrap gap-1 border-b border-border-subtle"
          >
            {SORTS.map((s) => {
              const href =
                s.id === 'most_liked' ? '/lists' : `/lists?sort=${s.id}`
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

          {lists.length === 0 ? (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              No public lists yet.
            </p>
          ) : (
            <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {lists.map((l) => (
                <li key={l.id} className="flex flex-col gap-2">
                  <PublicListCard list={l} />
                  <LikeListButton
                    listId={l.id}
                    initialLiked={l.liked_by_me}
                    initialCount={l.like_count}
                    userId={userId}
                    className="px-1"
                  />
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

function PublicListCard({ list }: { list: PublicListRow }) {
  const href = list.creator
    ? `/u/${list.creator.username}/lists/${list.id}`
    : `/lists`
  return (
    <Card variant="entity" href={href} className="gap-3 p-4">
      <h2 className="font-fraunces text-base text-text-primary">{list.title}</h2>
      {list.description && (
        <p className="line-clamp-3 font-source-serif-4 text-sm text-text-secondary">
          {list.description}
        </p>
      )}
      <p className="mt-auto font-dm-mono text-[0.6875rem] text-text-tertiary">
        {list.creator ? `@${list.creator.username} · ` : ''}
        {list.book_count} books
        {list.like_count > 0 && ` · ${list.like_count} likes`}
      </p>
    </Card>
  )
}

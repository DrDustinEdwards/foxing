import Link from 'next/link'
import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { Card } from '@/components/ui/card'
import { LikeListButton } from '@/components/ui/like-list-button'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { FilterBar } from '@/components/search/filter-bar'
import { SearchPagination } from '@/components/search/search-pagination'
import { LISTS_FILTER_CONFIG } from '@/lib/search/configs'
import { searchPageData } from '@/lib/search/server'
import { fetchLikedReadingListIds } from '@/lib/missing-pages-queries'
import { buildListsIndexMetadata } from '@/lib/metadata'
import { getAuthedUserId } from '@/lib/nav-user'

export const revalidate = 600

export const metadata: Metadata = buildListsIndexMetadata()

// Per-viewer page: it consumes the shared search QUERY layer (search + sort +
// pagination via FilterBar + searchPageData) but renders its OWN card with a
// per-viewer like button. Pages with per-viewer UI keep their cards and enrich
// the base hits (here: liked_by_me); only pages without per-viewer state
// (/books, /clubs) use the shared result renderer. Do not "consolidate" this
// onto the shared card -- the like button would be lost.

interface ListHit {
  id: string
  slug: string | null
  title: string
  description: string | null
  like_count: number | null
  creator: { username: string; display_name: string } | null
}

export default async function PublicListsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const [userId, { result, page, totalPages }] = await Promise.all([
    getAuthedUserId(),
    searchPageData('list', LISTS_FILTER_CONFIG, searchParams, { pageSize: 48 }),
  ])

  const rows = result.hits.map((hit) => hit.data as ListHit)
  const likedIds = await fetchLikedReadingListIds(
    userId,
    rows.map((r) => r.id),
  )

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <PageHeader
            title="Reading lists"
            subtitle="Curated reading lists from the Foxing community."
            subtitleVariant="description"
          />

          <div className="mt-6">
            <FilterBar config={LISTS_FILTER_CONFIG} />
          </div>

          {rows.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                heading="No lists match those filters."
                action={
                  <Link
                    href="/lists"
                    className="font-dm-sans text-sm text-brand-text hover:underline"
                  >
                    See all lists
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {rows.map((l) => (
                  <li key={l.id} className="flex flex-col gap-2">
                    <PublicListCard list={l} />
                    <LikeListButton
                      listId={l.id}
                      initialLiked={likedIds.has(l.id)}
                      initialCount={l.like_count ?? 0}
                      userId={userId}
                      className="px-1"
                    />
                  </li>
                ))}
              </ul>
              <SearchPagination
                basePath="/lists"
                page={page}
                totalPages={totalPages}
                searchParams={searchParams}
              />
            </>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function PublicListCard({ list }: { list: ListHit }) {
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
        {list.creator ? `@${list.creator.username}` : ''}
        {(list.like_count ?? 0) > 0 && `${list.creator ? ' · ' : ''}${list.like_count} likes`}
      </p>
    </Card>
  )
}

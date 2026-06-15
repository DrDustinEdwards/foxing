import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { FilterBar } from '@/components/search/filter-bar'
import { SearchPagination } from '@/components/search/search-pagination'
import { SearchResultItem } from '@/components/search/search-result-item'
import { buildClubsFilterConfig } from '@/lib/search/configs'
import { fetchClubGenreOptions } from '@/lib/search/facets'
import { searchPageData } from '@/lib/search/server'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'
import { StartClubButton } from './start-club-button'

export const revalidate = 60

export const metadata = STATIC_PAGE_METADATA['/clubs']

export default async function ClubsIndexPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const genreOptions = await fetchClubGenreOptions()
  const config = buildClubsFilterConfig(genreOptions)
  const { result, page, totalPages, facetCounts } = await searchPageData(
    'club',
    config,
    searchParams,
    { pageSize: 24 },
  )

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-fraunces text-[2rem] text-text-primary">
              Reading clubs
            </h1>
            <StartClubButton />
          </div>
          <p className="mt-2 font-dm-sans text-sm text-text-tertiary">
            {result.total.toLocaleString()} {result.total === 1 ? 'club' : 'clubs'}
          </p>

          <div className="mt-6">
            <FilterBar config={config} facetCounts={facetCounts} />
          </div>

          {result.hits.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                heading="No clubs match those filters."
                action={
                  <Link
                    href="/clubs"
                    className="font-dm-sans text-sm text-brand-text hover:underline"
                  >
                    See all clubs
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {result.hits.map((hit) => (
                  <SearchResultItem key={hit.id} hit={hit} />
                ))}
              </div>
              <SearchPagination
                basePath="/clubs"
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

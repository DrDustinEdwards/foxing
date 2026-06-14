import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { FilterBar } from '@/components/search/filter-bar'
import { SearchPagination } from '@/components/search/search-pagination'
import { SearchResultItem } from '@/components/search/search-result-item'
import { buildPicksFilterConfig } from '@/lib/search/configs'
import { fetchPickClubOptions, fetchPickYearOptions } from '@/lib/search/facets'
import { searchPageData } from '@/lib/search/server'
import { buildPicksIndexMetadata } from '@/lib/metadata'

export const revalidate = 3600

export const metadata = buildPicksIndexMetadata()

export default async function PicksIndexPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const [yearOptions, clubOptions] = await Promise.all([
    fetchPickYearOptions(),
    fetchPickClubOptions(),
  ])
  const config = buildPicksFilterConfig(yearOptions, clubOptions)
  const { result, page, totalPages } = await searchPageData(
    'pick',
    config,
    searchParams,
    { pageSize: 36 },
  )

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-col gap-2">
            <h1 className="font-fraunces text-[2rem] text-text-primary">
              Book club picks
            </h1>
            <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
              Every celebrity book club pick, searchable by title, year, club,
              and era.
            </p>
          </header>

          <p className="mt-4 font-dm-sans text-sm text-text-tertiary">
            {result.total.toLocaleString()}{' '}
            {result.total === 1 ? 'pick' : 'picks'}
          </p>

          <div className="mt-6">
            <FilterBar config={config} />
          </div>

          {result.hits.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                heading="No picks match those filters."
                action={
                  <Link
                    href="/book-clubs/picks"
                    className="font-dm-sans text-sm text-brand-text hover:underline"
                  >
                    See all picks
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {result.hits.map((hit) => (
                  <SearchResultItem key={hit.id} hit={hit} />
                ))}
              </div>
              <SearchPagination
                basePath="/book-clubs/picks"
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

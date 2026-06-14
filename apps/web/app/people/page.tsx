import Link from 'next/link'
import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { FilterBar } from '@/components/search/filter-bar'
import { SearchPagination } from '@/components/search/search-pagination'
import { SearchResultItem } from '@/components/search/search-result-item'
import { PEOPLE_FILTER_CONFIG } from '@/lib/search/configs'
import { searchPageData } from '@/lib/search/server'
import { buildPeopleMetadata } from '@/lib/metadata'

export const revalidate = 600

export const metadata: Metadata = buildPeopleMetadata()

export default async function PeoplePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const { result, page, totalPages } = await searchPageData(
    'person',
    PEOPLE_FILTER_CONFIG,
    searchParams,
    { pageSize: 48 },
  )

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

          <div className="mt-6">
            <FilterBar config={PEOPLE_FILTER_CONFIG} />
          </div>

          {result.hits.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                heading="No public readers match those filters."
                action={
                  <Link
                    href="/people"
                    className="font-dm-sans text-sm text-brand-text hover:underline"
                  >
                    See all readers
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {result.hits.map((hit) => (
                  <SearchResultItem key={hit.id} hit={hit} />
                ))}
              </div>
              <SearchPagination
                basePath="/people"
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

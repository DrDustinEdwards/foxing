import Link from 'next/link'
import { BookCard, type BookCardBook } from '@/components/book-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { FilterBar } from '@/components/search/filter-bar'
import { SearchPagination } from '@/components/search/search-pagination'
import { BOOKS_FILTER_CONFIG } from '@/lib/search/configs'
import { searchPageData } from '@/lib/search/server'
import { buildBooksListingMetadata } from '@/lib/metadata'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 60

interface BooksSearchParams {
  mood?: string
  search?: string
  era?: string
  length?: string
  q?: string
  genre?: string
  sort?: string
  page?: string
}

function pageTitle(params: BooksSearchParams): string {
  if (params.mood) return `${capitalize(params.mood)} books`
  if (params.era) return `${params.era} books`
  if (params.length) return `${capitalize(params.length)} books`
  if (params.search || params.q) return 'Search results'
  return 'All books'
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

async function getBookCount(): Promise<number | undefined> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return undefined
  }
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('books')
    .select('id', { count: 'exact', head: true })
  return count ?? undefined
}

export async function generateMetadata(props: {
  searchParams: Promise<BooksSearchParams>
}) {
  const searchParams = await props.searchParams
  const count = await getBookCount()
  return buildBooksListingMetadata({
    mood: searchParams.mood,
    era: searchParams.era,
    length: searchParams.length,
    genre: searchParams.genre,
    search: searchParams.search ?? searchParams.q,
    count,
  })
}

export default async function BooksPage(props: {
  searchParams: Promise<BooksSearchParams>
}) {
  const searchParams = await props.searchParams
  const spRecord = searchParams as Record<string, string | string[] | undefined>
  const { result, page, totalPages } = await searchPageData(
    'book',
    BOOKS_FILTER_CONFIG,
    spRecord,
    { pageSize: 24 },
  )
  const title = pageTitle(searchParams)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <h1 className="font-fraunces text-[2rem] text-text-primary">{title}</h1>
          <p className="mt-2 font-dm-sans text-sm text-text-tertiary">
            {result.total.toLocaleString()} {result.total === 1 ? 'book' : 'books'}
          </p>

          <div className="mt-6">
            <FilterBar config={BOOKS_FILTER_CONFIG} />
          </div>

          {result.hits.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                heading="No books match those filters."
                action={
                  <Link
                    href="/books"
                    className="font-dm-sans text-sm text-brand-text hover:underline"
                  >
                    See all books
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
                {result.hits.map((hit, i) => (
                  <BookCard
                    key={hit.id}
                    book={hit.data as BookCardBook}
                    size="md"
                    priority={i < 8}
                  />
                ))}
              </div>
              <SearchPagination
                basePath="/books"
                page={page}
                totalPages={totalPages}
                searchParams={spRecord}
              />
            </>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

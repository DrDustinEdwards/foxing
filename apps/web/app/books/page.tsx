import Link from 'next/link'
import { BookCard } from '@/components/book-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchBooksList } from '@/lib/queries'
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
  page?: string
}

function pageTitle(params: BooksSearchParams): string {
  if (params.mood) return `${capitalize(params.mood)} books`
  if (params.era) return `${params.era} books`
  if (params.length) return `${capitalize(params.length)} books`
  if (params.search || params.q) return `Search results`
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

export async function generateMetadata(
  props: {
    searchParams: Promise<BooksSearchParams>
  }
) {
  const searchParams = await props.searchParams;
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

export default async function BooksPage(
  props: {
    searchParams: Promise<BooksSearchParams>
  }
) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, Number(searchParams.page) || 1)
  const search = searchParams.search ?? searchParams.q
  const { items, total } = await fetchBooksList({
    mood: searchParams.mood,
    search,
    era: searchParams.era,
    page,
    pageSize: 24,
  })
  const totalPages = Math.max(1, Math.ceil(total / 24))
  const title = pageTitle(searchParams)
  const activeFilters: { key: string; label: string }[] = []
  if (searchParams.mood)
    activeFilters.push({ key: 'mood', label: `Mood: ${searchParams.mood}` })
  if (searchParams.era)
    activeFilters.push({ key: 'era', label: `Era: ${searchParams.era}` })
  if (searchParams.length)
    activeFilters.push({
      key: 'length',
      label: `Length: ${searchParams.length}`,
    })
  if (search) activeFilters.push({ key: 'search', label: `“${search}”` })

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <h1 className="font-fraunces text-[2rem] text-text-primary">
            {title}
          </h1>
          <p className="mt-2 font-dm-sans text-sm text-text-tertiary">
            {total.toLocaleString()} {total === 1 ? 'book' : 'books'}
          </p>

          {activeFilters.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {activeFilters.map((f) => (
                <span
                  key={f.key}
                  className="rounded-full bg-brand-subtle px-3 py-1 font-dm-sans text-xs text-brand-subtle-text"
                >
                  {f.label}
                </span>
              ))}
              <Link
                href="/books"
                className="font-dm-sans text-xs text-brand-text hover:underline"
              >
                Clear
              </Link>
            </div>
          )}

          {items.length === 0 ? (
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
                {items.map((b, i) => (
                  <BookCard
                    key={b.id}
                    book={b}
                    size="md"
                    priority={i < 8}
                  />
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                params={searchParams}
              />
            </>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number
  totalPages: number
  params: BooksSearchParams
}) {
  if (totalPages <= 1) return null
  function hrefFor(target: number): string {
    const q = new URLSearchParams()
    if (params.mood) q.set('mood', params.mood)
    if (params.era) q.set('era', params.era)
    if (params.length) q.set('length', params.length)
    if (params.search) q.set('search', params.search)
    if (params.q) q.set('q', params.q)
    if (target > 1) q.set('page', String(target))
    const s = q.toString()
    return s ? `/books?${s}` : '/books'
  }
  const hasPrev = page > 1
  const hasNext = page < totalPages
  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-between gap-3"
    >
      {hasPrev ? (
        <Link
          href={hrefFor(page - 1)}
          className="font-dm-sans text-sm text-brand-text hover:underline"
        >
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="font-dm-mono text-xs text-text-tertiary">
        Page {page} of {totalPages}
      </span>
      {hasNext ? (
        <Link
          href={hrefFor(page + 1)}
          className="font-dm-sans text-sm text-brand-text hover:underline"
        >
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}

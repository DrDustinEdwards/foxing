import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { HighlightCard } from '@/components/highlight-card'
import { LikeHighlightButton } from '@/components/ui/like-highlight-button'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { FilterBar } from '@/components/search/filter-bar'
import { SearchPagination } from '@/components/search/search-pagination'
import { QUOTES_FILTER_CONFIG } from '@/lib/search/configs'
import { searchPageData } from '@/lib/search/server'
import { fetchLikedHighlightIds } from '@/lib/queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'

export const revalidate = 300

export const metadata = STATIC_PAGE_METADATA['/quotes']

// Per-viewer page: it consumes the shared search QUERY layer (search + sort +
// pagination via FilterBar + searchPageData) but renders its OWN HighlightCard
// with a per-viewer like button. It enriches the base hits with liked_by_me the
// same way /people enriches counts. Do not "consolidate" this onto the shared
// result renderer -- the like button would be lost.

interface QuoteAuthor {
  username: string
  display_name: string
  avatar_url: string | null
}

interface QuoteHit {
  id: string
  text: string
  like_count: number | null
  book: { id: string; slug: string | null; title: string; author: string } | null
  author: QuoteAuthor | null
}

export default async function QuotesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const [userId, { result, page, totalPages }] = await Promise.all([
    getAuthedUserId(),
    searchPageData('quote', QUOTES_FILTER_CONFIG, searchParams, { pageSize: 24 }),
  ])

  const rows = result.hits.map((hit) => hit.data as QuoteHit)
  const likedIds = await fetchLikedHighlightIds(
    userId,
    rows.map((r) => r.id),
  )

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <h1 className="font-fraunces text-[2rem] text-text-primary">
            Passages readers saved
          </h1>
          <p className="mt-2 font-dm-sans text-sm text-text-tertiary">
            {result.total.toLocaleString()} public highlights
          </p>

          <div className="mt-6">
            <FilterBar config={QUOTES_FILTER_CONFIG} />
          </div>

          {rows.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                heading="No highlights match those filters."
                action={
                  <Link
                    href="/quotes"
                    className="font-dm-sans text-sm text-brand-text hover:underline"
                  >
                    See all highlights
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((q) => (
                  <div key={q.id} className="flex flex-col gap-2">
                    <Link href={`/quotes/${q.id}`} className="block">
                      <HighlightCard
                        text={q.text}
                        book={
                          q.book
                            ? {
                                title: q.book.title,
                                author: q.book.author,
                                id: q.book.id,
                                slug: q.book.slug,
                              }
                            : { title: '', author: '', id: '' }
                        }
                        author={q.author}
                      />
                    </Link>
                    <LikeHighlightButton
                      highlightId={q.id}
                      initialLiked={likedIds.has(q.id)}
                      initialCount={q.like_count ?? 0}
                      userId={userId}
                      className="px-1"
                    />
                  </div>
                ))}
              </div>
              <SearchPagination
                basePath="/quotes"
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

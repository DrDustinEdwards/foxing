import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { HighlightCard } from '@/components/highlight-card'
import { LikeHighlightButton } from '@/components/ui/like-highlight-button'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchPublicQuotes } from '@/lib/queries'
import { getAuthedUserId, getNavUser } from '@/lib/nav-user'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'

export const revalidate = 300

export const metadata = STATIC_PAGE_METADATA['/quotes']

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const [navUser, userId] = await Promise.all([getNavUser(), getAuthedUserId()])
  const page = Math.max(1, Number(searchParams.page) || 1)
  const { items, total } = await fetchPublicQuotes(page, 24, userId)
  const totalPages = Math.max(1, Math.ceil(total / 24))

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <h1 className="font-fraunces text-[2rem] text-text-primary">
            Passages readers saved
          </h1>
          <p className="mt-2 font-dm-sans text-sm text-text-tertiary">
            {total.toLocaleString()} public highlights
          </p>

          {items.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                heading="No public highlights yet."
                action={
                  <Link
                    href="/books"
                    className="font-dm-sans text-sm text-brand-text hover:underline"
                  >
                    Browse books
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((q) => (
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
                            }
                          : { title: '', author: '', id: '' }
                      }
                      author={q.author}
                    />
                  </Link>
                  <LikeHighlightButton
                    highlightId={q.id}
                    initialLiked={q.liked_by_me}
                    initialCount={q.like_count}
                    userId={userId}
                    className="px-1"
                  />
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-10 flex items-center justify-between"
            >
              <Link
                href={page > 1 ? `/quotes?page=${page - 1}` : '#'}
                aria-disabled={page === 1}
                className={
                  page === 1
                    ? 'pointer-events-none font-dm-sans text-sm text-text-disabled'
                    : 'font-dm-sans text-sm text-brand-text hover:underline'
                }
              >
                ← Previous
              </Link>
              <span className="font-dm-mono text-xs text-text-tertiary">
                Page {page} of {totalPages}
              </span>
              <Link
                href={
                  page < totalPages ? `/quotes?page=${page + 1}` : '#'
                }
                aria-disabled={page === totalPages}
                className={
                  page === totalPages
                    ? 'pointer-events-none font-dm-sans text-sm text-text-disabled'
                    : 'font-dm-sans text-sm text-brand-text hover:underline'
                }
              >
                Next →
              </Link>
            </nav>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

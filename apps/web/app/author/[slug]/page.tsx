import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { BookCard } from '@/components/book-card'
import { Footer } from '@/components/layout/footer'
import { HighlightCard } from '@/components/highlight-card'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchAiCache,
  fetchBooksByAuthor,
  fetchHighlightsByAuthor,
} from '@/lib/queries'
import { getNavUser } from '@/lib/nav-user'
import { siteOrigin } from '@/lib/foxing'

export const revalidate = 86_400

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const author = decodeURIComponent(params.slug)
  const origin = siteOrigin()
  return {
    title: `${author} · Foxing`,
    alternates: { canonical: `${origin}/author/${params.slug}` },
    openGraph: {
      title: `${author} on Foxing`,
      type: 'profile',
      url: `${origin}/author/${params.slug}`,
    },
  }
}

export default async function AuthorPage({
  params,
}: {
  params: { slug: string }
}) {
  const authorName = decodeURIComponent(params.slug)
  const [navUser, books, highlights] = await Promise.all([
    getNavUser(),
    fetchBooksByAuthor(authorName),
    fetchHighlightsByAuthor(authorName, 3),
  ])
  if (books.length === 0) notFound()

  const aiBio = books[0] ? await fetchAiCache(books[0].id, 'author_bio') : null

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="py-12">
          <h1 className="font-fraunces text-[2.5rem] leading-tight text-text-primary">
            {authorName}
          </h1>
          {aiBio && (
            <p className="mt-4 max-w-prose font-source-serif-4 text-base text-text-secondary">
              {aiBio}
            </p>
          )}
          <section className="mt-10">
            <h2 className="mb-4 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
              Books in Foxing
            </h2>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {books.map((b) => (
                <BookCard key={b.id} book={b} size="md" showRating={false} />
              ))}
            </div>
          </section>
          {highlights.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-4 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                Most saved passages
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {highlights.map((h) => (
                  <HighlightCard
                    key={h.id}
                    text={h.text}
                    book={
                      h.book
                        ? {
                            title: h.book.title,
                            author: h.book.author,
                            id: h.book.id,
                          }
                        : { title: '', author: '', id: '' }
                    }
                    author={h.author}
                  />
                ))}
              </div>
            </section>
          )}
          <p className="mt-12 font-dm-sans text-sm text-text-tertiary">
            <Link href="/books" className="text-brand-text hover:underline">
              Back to all books
            </Link>
          </p>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

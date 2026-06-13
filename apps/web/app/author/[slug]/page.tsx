import { cache } from 'react'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { BookCard } from '@/components/book-card'
import { Footer } from '@/components/layout/footer'
import { HighlightCard } from '@/components/highlight-card'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchAiCache,
  fetchAuthorSlugByName,
  fetchBooksByAuthorSlug,
  fetchHighlightsByAuthorSlug,
} from '@/lib/queries'
import { buildAuthorMetadata, FOXING_BASE_URL } from '@/lib/metadata'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchVerifiedAuthorByName } from '@/lib/author-claims'
import { safeJsonLd } from '@/lib/structured-data'
import { fetchAnsweredQuestions } from '@/lib/author-qa'
import { AuthorQuestionsSection } from './author-questions-section'

export const revalidate = 86_400

// generateMetadata and the page both list the author's books; cache() runs
// the query once per request.
const fetchBooksByAuthorOnce = cache(fetchBooksByAuthorSlug)

// Build-time only. Pulls every distinct author_slug so each author page
// can be statically generated. Uses the admin client because cookies()
// is not available outside a request scope.
export async function generateStaticParams() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return []
  }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('books')
    .select('author_slug')
    .not('author_slug', 'is', null)
    .limit(5000)
  const seen = new Set<string>()
  for (const row of (data as { author_slug: string | null }[] | null) ?? []) {
    if (row.author_slug) seen.add(row.author_slug)
  }
  return [...seen].map((slug) => ({ slug }))
}

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const books = await fetchBooksByAuthorOnce(params.slug)
  if (books.length === 0) {
    return { title: 'Author not found', robots: { index: false, follow: true } }
  }
  const authorName = books[0].author
  return buildAuthorMetadata(
    authorName,
    params.slug,
    books.map((b) => b.title),
  )
}

export default async function AuthorPage(
  props: {
    params: Promise<{ slug: string }>
  }
) {
  const params = await props.params;
  const books = await fetchBooksByAuthorOnce(params.slug)

  // Legacy URL fallback: when the request looks like an encoded display
  // name, resolve to a canonical author_slug and 301 to that URL.
  if (books.length === 0) {
    const decoded = decodeURIComponent(params.slug)
    if (decoded !== params.slug || /\s/.test(decoded)) {
      const canonicalSlug = await fetchAuthorSlugByName(decoded)
      if (canonicalSlug) {
        permanentRedirect(`/author/${canonicalSlug}`)
      }
    }
    notFound()
  }

  const authorName = books[0].author
  const [highlights, aiBio, verifiedAuthor] = await Promise.all([
    fetchHighlightsByAuthorSlug(params.slug, 3),
    fetchAiCache(books[0].id, 'author_bio'),
    fetchVerifiedAuthorByName(authorName),
  ])
  const authorProfile = verifiedAuthor
    ? await (async () => {
        const admin = createAdminClient()
        const { data } = await admin
          .from('profiles')
          .select('id')
          .eq('username', verifiedAuthor.username)
          .maybeSingle()
        return (data as { id: string } | null) ?? null
      })()
    : null
  const answeredQuestions = authorProfile
    ? await fetchAnsweredQuestions(authorProfile.id, null)
    : []

  // Themes the author works in, sampled from their books.
  const themeSet = new Set<string>()
  for (const b of books) {
    for (const t of b.themes ?? []) themeSet.add(t)
  }
  const knowsAbout = [...themeSet].slice(0, 8)

  const personJsonLdStr = safeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${FOXING_BASE_URL}/author/${params.slug}`,
    name: authorName,
    url: `${FOXING_BASE_URL}/author/${params.slug}`,
    description:
      aiBio ??
      `${authorName}, read their complete works free on Foxing.`,
    sameAs: [] as string[],
    jobTitle: 'Author',
    knowsAbout,
  })

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: personJsonLdStr }}
      />
      <main className="flex-1">
        <PageWrapper className="py-12">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-fraunces text-[2.5rem] leading-tight text-text-primary">
              {authorName}
            </h1>
            {verifiedAuthor && (
              <a
                href={`/u/${verifiedAuthor.username}`}
                className="inline-flex items-center rounded-full bg-success-bg px-2.5 py-1 font-dm-mono text-[0.625rem] uppercase tracking-wider text-success hover:underline"
              >
                Verified author
              </a>
            )}
          </div>
          {aiBio && (
            <p className="mt-4 max-w-prose font-source-serif-4 text-base text-text-secondary">
              {aiBio}
            </p>
          )}
          <section className="mt-10">
            <h2 className="mb-4 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
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
              <h2 className="mb-4 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
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
          {authorProfile && (
            <AuthorQuestionsSection
              authorUserId={authorProfile.id}
              authorName={authorName}
              initial={answeredQuestions}
            />
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

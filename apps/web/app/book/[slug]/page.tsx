import Image from 'next/image'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { BookCard } from '@/components/book-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StarRating } from '@/components/ui/star-rating'
import { ClubCard } from '@/components/club-card'
import { CollapsibleSection } from '@/components/collapsible-section'
import { Footer } from '@/components/layout/footer'
import { HighlightCard } from '@/components/highlight-card'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { ReviewCard } from '@/components/review-card'
import { WhereToRead } from '@/components/where-to-read'
import { getNavUser } from '@/lib/nav-user'
import {
  fetchAiCache,
  fetchBookById,
  fetchBookBySlug,
  fetchBookHighlights,
  fetchBookReviews,
  fetchPublicClubsForBook,
  fetchSimilarBooks,
  isUuid,
} from '@/lib/queries'
import { appBookDeeplink } from '@/lib/foxing'
import { fetchDiscussionGuide } from '@/lib/discussion-guide'
import { buildBookMetadata, FOXING_BASE_URL } from '@/lib/metadata'
import { createAdminClient } from '@/lib/supabase/admin'
import { ReadingTimerWidget } from '@/components/reading-timer-widget'
import { DiscussionGuideSection } from './discussion-guide-section'

export const revalidate = 3600

// Build-time only. Uses the admin client because the server client calls
// next/headers cookies(), which fails outside a request scope. The books
// table is public catalog data, so service-role reads here are safe.
export async function generateStaticParams() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return []
  }
  const supabase = createAdminClient()
  const { data: books } = await supabase
    .from('books')
    .select('slug')
    .not('slug', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)
  return ((books as { slug: string }[] | null) ?? [])
    .filter((b) => Boolean(b.slug))
    .map((b) => ({ slug: b.slug }))
}

async function resolveBook(slugOrId: string) {
  let book = await fetchBookBySlug(slugOrId)
  if (!book && isUuid(slugOrId)) {
    book = await fetchBookById(slugOrId)
  }
  return book
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const book = await resolveBook(params.slug)
  if (!book) return { title: 'Book not found' }
  const aiDesc = await fetchAiCache(book.id, 'book_description')
  const description = aiDesc ?? book.description ?? null
  return buildBookMetadata({
    id: book.id,
    slug: book.slug,
    title: book.title,
    author: book.author,
    description,
    themes: book.themes,
    word_count: book.word_count,
    cover_url: book.cover_url,
  })
}

export default async function BookPage({
  params,
}: {
  params: { slug: string }
}) {
  const [navUser, book] = await Promise.all([
    getNavUser(),
    resolveBook(params.slug),
  ])
  if (!book) notFound()

  // If the visitor arrived via a legacy UUID URL, send them to the
  // canonical slug-based one with a permanent redirect for SEO equity.
  if (isUuid(params.slug) && book.slug && book.slug !== params.slug) {
    permanentRedirect(`/book/${book.slug}`)
  }

  const [
    reviews,
    highlights,
    similar,
    clubs,
    aiDescription,
    aiAuthorBio,
    discussionGuide,
  ] = await Promise.all([
    fetchBookReviews(book.id, 5),
    fetchBookHighlights(book.id, 3),
    fetchSimilarBooks(book.id, 5),
    fetchPublicClubsForBook(book.id, 3),
    fetchAiCache(book.id, 'book_description'),
    fetchAiCache(book.id, 'author_bio'),
    fetchDiscussionGuide(book.id),
  ])

  const description = aiDescription || book.description || null
  const authorBioExcerpt = aiAuthorBio
    ? aiAuthorBio.split('\n').filter(Boolean).slice(0, 2).join(' ')
    : null

  const isCommunityBook = book.source_type === 'community' || !book.epub_url

  const bookPath = book.slug ?? book.id
  const authorPath = book.author_slug ?? encodeURIComponent(book.author)
  const bookJsonLdStr = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Book',
    '@id': `${FOXING_BASE_URL}/book/${bookPath}`,
    name: book.title,
    author: {
      '@type': 'Person',
      name: book.author,
      url: `${FOXING_BASE_URL}/author/${authorPath}`,
    },
    description:
      description ??
      (isCommunityBook
        ? `${book.title} by ${book.author}, on Foxing.`
        : `Read ${book.title} by ${book.author} free on Foxing.`),
    url: `${FOXING_BASE_URL}/book/${bookPath}`,
    inLanguage: book.language ?? 'en',
    genre: book.themes?.[0] ?? 'Fiction',
    ...(book.isbn13 ? { isbn: book.isbn13 } : book.isbn ? { isbn: book.isbn } : {}),
    ...(book.publisher
      ? { publisher: { '@type': 'Organization', name: book.publisher } }
      : { publisher: { '@type': 'Organization', name: 'Foxing', url: FOXING_BASE_URL } }),
    ...(book.publication_year ? { datePublished: String(book.publication_year) } : {}),
    numberOfPages: book.word_count
      ? Math.round(book.word_count / 250)
      : undefined,
    ...(isCommunityBook
      ? {}
      : {
          isAccessibleForFree: true,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            url: `${FOXING_BASE_URL}/book/${bookPath}`,
          },
        }),
    ...(book.rating_count >= 3 && typeof book.avg_rating === 'number'
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: book.avg_rating.toFixed(1),
            ratingCount: book.rating_count,
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {}),
  })

  const breadcrumbJsonLdStr = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: FOXING_BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Books',
        item: `${FOXING_BASE_URL}/books`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: book.title,
        item: `${FOXING_BASE_URL}/book/${bookPath}`,
      },
    ],
  })

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: bookJsonLdStr }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLdStr }}
      />
      <main className="flex-1">
        <BookHero book={book} />
        <PageWrapper className="grid gap-10 py-10 md:grid-cols-[1fr_320px] md:py-12">
          <div className="flex flex-col">
            <BookHeader book={book} />
            <ActionBar bookId={book.id} hasEpub={Boolean(book.epub_url)} />
            <WhereToRead
              book={{
                id: book.id,
                title: book.title,
                author: book.author,
                isbn: book.isbn,
                isbn13: book.isbn13,
                amazon_url: book.amazon_url,
                bookshop_url: book.bookshop_url,
                source_type: book.source_type,
                epub_url: book.epub_url,
              }}
            />
            {navUser && (
              <ReadingTimerWidget
                bookId={book.id}
                bookSlug={book.slug}
                bookTitle={book.title}
                wordCount={book.word_count}
              />
            )}
            <ReviewsSection
              reviews={reviews}
              total={book.rating_count}
              bookId={book.id}
            />
            {highlights.length > 0 && <HighlightsSection highlights={highlights} />}
            {description && (
              <CollapsibleSection heading="About this book">
                <p className="font-source-serif-4 text-base text-text-secondary">
                  {description}
                </p>
              </CollapsibleSection>
            )}
            <DiscussionGuideSection
              bookId={book.id}
              bookSlug={book.slug}
              initialQuestions={discussionGuide?.questions ?? null}
            />
            <CollapsibleSection heading="Deep Dive">
              <DeepDivePreview bookId={book.id} />
            </CollapsibleSection>
            {clubs.length > 0 && <ClubsSection clubs={clubs} />}
          </div>
          <Sidebar
            similar={similar}
            authorName={book.author}
            authorSlug={book.author_slug}
            authorBio={authorBioExcerpt}
          />
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function BookHero({
  book,
}: {
  book: Awaited<ReturnType<typeof fetchBookById>> & object
}) {
  return (
    <section className="relative h-[40vh] min-h-[280px] w-full overflow-hidden bg-[#16100B]">
      {book.cover_url && (
        <Image
          src={book.cover_url}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-30"
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-transparent via-[#16100B]/40 to-[#16100B]"
      />
      <PageWrapper className="relative z-10 flex h-full items-end pb-8">
        <h1 className="font-fraunces text-[2.25rem] leading-tight text-white md:text-[2.5rem]">
          {book.title}
        </h1>
      </PageWrapper>
    </section>
  )
}

function BookHeader({
  book,
}: {
  book: Awaited<ReturnType<typeof fetchBookById>> & object
}) {
  const year =
    typeof book.created_at === 'string' ? null : null /* publication year is not on the schema */
  return (
    <header className="flex flex-col gap-3 pb-6">
      <h2 className="font-fraunces text-3xl text-text-primary md:text-[2rem]">
        {book.title}
      </h2>
      <p className="font-dm-sans text-base text-text-secondary">
        by{' '}
        <Link
          href={`/author/${book.author_slug ?? encodeURIComponent(book.author)}`}
          className="text-brand-text hover:underline"
        >
          {book.author}
        </Link>
        {book.series_name && (
          <Badge variant="neutral" className="ml-3">
            {book.series_name}
            {book.series_order ? ` #${book.series_order}` : ''}
          </Badge>
        )}
        {year && (
          <span className="ml-3 font-dm-mono text-sm text-text-tertiary">
            {year}
          </span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {typeof book.avg_rating === 'number' && (
          <div className="flex items-center gap-2">
            <StarRating value={book.avg_rating} size="md" readOnly />
            <span className="font-dm-sans text-sm text-text-tertiary">
              {book.avg_rating.toFixed(1)} from {book.rating_count} ratings
            </span>
          </div>
        )}
      </div>
      {book.themes && book.themes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {book.themes.slice(0, 6).map((tag) => (
            <Link
              key={tag}
              href={`/books?mood=${encodeURIComponent(tag)}`}
              className="rounded-full bg-brand-subtle px-2.5 py-0.5 font-dm-sans text-xs text-brand-subtle-text hover:bg-bg-hover"
            >
              {tag}
            </Link>
          ))}
        </div>
      )}
    </header>
  )
}

function ActionBar({ bookId, hasEpub }: { bookId: string; hasEpub: boolean }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle pt-6">
      {hasEpub && (
        <Link href={appBookDeeplink(bookId)} className="block">
          <Button variant="primary" size="lg" fullWidth>
            Read in Foxing app
          </Button>
        </Link>
      )}
      <p className="font-dm-sans text-xs text-text-tertiary">
        Sign in on the web to track this book and write a review.{' '}
        <Link href="/sign-in" className="text-brand-text hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}

function ReviewsSection({
  reviews,
  total,
  bookId,
}: {
  reviews: Awaited<ReturnType<typeof fetchBookReviews>>
  total: number
  bookId: string
}) {
  if (reviews.length === 0) {
    return (
      <section className="border-t border-border-subtle py-6">
        <h2 className="mb-3 font-fraunces text-xl text-text-primary">
          What readers say
        </h2>
        <p className="font-dm-sans text-sm text-text-tertiary">
          No public reviews yet. Be the first to write one in the app.
        </p>
      </section>
    )
  }
  return (
    <section className="border-t border-border-subtle py-6">
      <h2 className="mb-4 font-fraunces text-xl text-text-primary">
        What readers say
      </h2>
      <div className="flex flex-col gap-4">
        {reviews.map((r) => (
          <ReviewCard
            key={r.id}
            review={{
              id: r.id,
              user_id: r.user_id,
              book_id: bookId,
              rating_half: r.rating,
              review: r.review,
              mood_tags: null,
              pacing: null,
              created_at: r.created_at,
              author: r.author ?? undefined,
            }}
          />
        ))}
      </div>
      {total > reviews.length && (
        <p className="mt-3 font-dm-sans text-sm text-text-tertiary">
          {total - reviews.length} more in the app.
        </p>
      )}
    </section>
  )
}

function HighlightsSection({
  highlights,
}: {
  highlights: Awaited<ReturnType<typeof fetchBookHighlights>>
}) {
  return (
    <section className="border-t border-border-subtle py-6">
      <h2 className="mb-4 font-fraunces text-xl text-text-primary">
        Passages readers saved
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {highlights.map((h) => (
          <HighlightCard
            key={h.id}
            text={h.text}
            book={
              h.book
                ? { title: h.book.title, author: h.book.author, id: h.book.id }
                : { title: '', author: '', id: '' }
            }
            author={h.author}
          />
        ))}
      </div>
    </section>
  )
}

function DeepDivePreview({ bookId }: { bookId: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative rounded-lg border border-border-subtle bg-bg-surface p-5">
        <p className="font-source-serif-4 text-base text-text-secondary blur-[2px]">
          A full literary analysis. Character relationships, motif tracking,
          historical context, and what to look for in the next chapter. Read
          in the Foxing app with a Plus subscription.
        </p>
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-bg-surface/60">
          <Link href={appBookDeeplink(bookId)}>
            <Button variant="primary" size="md">
              Unlock with Foxing Plus
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

function ClubsSection({
  clubs,
}: {
  clubs: Awaited<ReturnType<typeof fetchPublicClubsForBook>>
}) {
  return (
    <section className="border-t border-border-subtle py-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-fraunces text-xl text-text-primary">
          Reading clubs
        </h2>
        <Link
          href="/clubs"
          className="font-dm-sans text-sm text-brand-text hover:underline"
        >
          More clubs
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {clubs.map((c) => (
          <ClubCard
            key={c.id}
            club={{ id: c.id, name: c.name, cover_url: c.cover_url }}
            currentBook={
              c.current_book
                ? { title: c.current_book.title, cover_url: c.current_book.cover_url }
                : null
            }
            memberCount={c.member_count}
          />
        ))}
      </div>
    </section>
  )
}

function Sidebar({
  similar,
  authorName,
  authorSlug,
  authorBio,
}: {
  similar: Awaited<ReturnType<typeof fetchSimilarBooks>>
  authorName: string
  authorSlug: string | null
  authorBio: string | null
}) {
  const authorHref = `/author/${authorSlug ?? encodeURIComponent(authorName)}`
  return (
    <aside className="flex flex-col gap-8">
      {similar.length > 0 && (
        <section>
          <h3 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
            Readers also liked
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {similar.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                size="sm"
                showRating={false}
                showMood={false}
              />
            ))}
          </div>
        </section>
      )}
      <section>
        <h3 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          About the author
        </h3>
        <p className="font-fraunces text-base text-text-primary">
          <Link
            href={authorHref}
            className="hover:text-brand-text"
          >
            {authorName}
          </Link>
        </p>
        {authorBio && (
          <p className="mt-2 font-source-serif-4 text-sm text-text-secondary">
            {authorBio}
          </p>
        )}
        <Link
          href={authorHref}
          className="mt-2 inline-block font-dm-sans text-sm text-brand-text hover:underline"
        >
          More by {authorName}
        </Link>
      </section>
    </aside>
  )
}

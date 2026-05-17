import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
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
import { bookshopUrl, worldcatUrl } from '@foxing/utils'
import { getNavUser } from '@/lib/nav-user'
import {
  fetchAiCache,
  fetchBookById,
  fetchBookHighlights,
  fetchBookReviews,
  fetchPublicClubsForBook,
  fetchSimilarBooks,
} from '@/lib/queries'
import { appBookDeeplink, siteOrigin } from '@/lib/foxing'
import { bookJsonLd } from '@/lib/structured-data'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 3600

export async function generateStaticParams() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return []
  }
  const sb = createClient()
  const { data } = await sb
    .from('books')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(200)
  return ((data as { id: string }[] | null) ?? []).map((b) => ({
    slug: b.id,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const book = await fetchBookById(params.slug)
  if (!book) return { title: 'Book not found · Foxing' }
  const aiDesc = await fetchAiCache(book.id, 'book_description')
  const fallback = book.description ?? ''
  const description = (aiDesc || fallback).slice(0, 160)
  const origin = siteOrigin()
  return {
    title: `${book.title} by ${book.author} · Foxing`,
    description: description || undefined,
    alternates: { canonical: `${origin}/book/${book.id}` },
    openGraph: {
      title: `${book.title} by ${book.author}`,
      description: description || undefined,
      url: `${origin}/book/${book.id}`,
      images: book.cover_url ? [{ url: book.cover_url }] : undefined,
      type: 'book',
    },
  }
}

export default async function BookPage({
  params,
}: {
  params: { slug: string }
}) {
  const [navUser, book] = await Promise.all([
    getNavUser(),
    fetchBookById(params.slug),
  ])
  if (!book) notFound()

  const [reviews, highlights, similar, clubs, aiDescription, aiAuthorBio] =
    await Promise.all([
      fetchBookReviews(book.id, 5),
      fetchBookHighlights(book.id, 3),
      fetchSimilarBooks(book.id, 5),
      fetchPublicClubsForBook(book.id, 3),
      fetchAiCache(book.id, 'book_description'),
      fetchAiCache(book.id, 'author_bio'),
    ])

  const description = aiDescription || book.description || null
  const authorBioExcerpt = aiAuthorBio
    ? aiAuthorBio.split('\n').filter(Boolean).slice(0, 2).join(' ')
    : null

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: bookJsonLd(book) }}
      />
      <main className="flex-1">
        <BookHero book={book} />
        <PageWrapper className="grid gap-10 py-10 md:grid-cols-[1fr_320px] md:py-12">
          <div className="flex flex-col">
            <BookHeader book={book} />
            <ActionBar bookId={book.id} hasEpub={Boolean(book.epub_url)} />
            <WhereToRead book={book} />
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
            <CollapsibleSection heading="Deep Dive">
              <DeepDivePreview bookId={book.id} />
            </CollapsibleSection>
            {clubs.length > 0 && <ClubsSection clubs={clubs} />}
          </div>
          <Sidebar
            similar={similar}
            authorName={book.author}
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
          href={`/author/${encodeURIComponent(book.author)}`}
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

function WhereToRead({
  book,
}: {
  book: Awaited<ReturnType<typeof fetchBookById>> & object
}) {
  return (
    <section className="border-t border-border-subtle py-6">
      <h2 className="mb-4 font-fraunces text-xl text-text-primary">
        Where to read this
      </h2>
      <ul className="flex flex-col gap-2">
        {book.epub_url && (
          <li>
            <Link
              href={appBookDeeplink(book.id)}
              className="font-dm-sans text-sm text-brand-text hover:underline"
            >
              Read free in Foxing
            </Link>
          </li>
        )}
        <li>
          <Link
            href={worldcatUrl(book.title, book.author)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-dm-sans text-sm text-brand-text hover:underline"
          >
            Find in a library
          </Link>
        </li>
        <li>
          <Link
            href={bookshopUrl(book.title, book.author)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-dm-sans text-sm text-brand-text hover:underline"
          >
            Buy a copy
          </Link>
        </li>
      </ul>
    </section>
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
  authorBio,
}: {
  similar: Awaited<ReturnType<typeof fetchSimilarBooks>>
  authorName: string
  authorBio: string | null
}) {
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
            href={`/author/${encodeURIComponent(authorName)}`}
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
          href={`/author/${encodeURIComponent(authorName)}`}
          className="mt-2 inline-block font-dm-sans text-sm text-brand-text hover:underline"
        >
          More by {authorName}
        </Link>
      </section>
    </aside>
  )
}

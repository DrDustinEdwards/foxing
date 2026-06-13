import { cache } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { ShareButton } from '@/components/share-button'
import { formatRelativeDate } from '@foxing/utils'
import { fetchQuoteById } from '@/lib/queries'
import { siteOrigin } from '@/lib/foxing'
import { buildQuoteMetadata } from '@/lib/metadata'
import { QuoteLikeButton } from './quote-like-button'

export const revalidate = 3600

// generateMetadata and the page both load the quote; cache() dedupes it.
const fetchQuoteOnce = cache(fetchQuoteById)

export async function generateMetadata(
  props: {
    params: Promise<{ id: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const quote = await fetchQuoteOnce(params.id)
  if (!quote || !quote.book) return { title: 'Passage not found' }
  return buildQuoteMetadata({
    id: quote.id,
    text: quote.text,
    book_title: quote.book.title,
    book_author: quote.book.author,
    username: quote.author?.username ?? 'reader',
  })
}

export default async function QuotePage(
  props: {
    params: Promise<{ id: string }>
  }
) {
  const params = await props.params;
  const quote = await fetchQuoteOnce(params.id)
  if (!quote) notFound()
  const shareUrl = `${siteOrigin()}/quotes/${quote.id}`

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="max-w-prose py-12">
          <figure className="rounded-xl border-l-[4px] border-brand-ui bg-bg-surface p-8 shadow-sm">
            <blockquote className="font-source-serif-4 text-xl italic leading-relaxed text-text-primary">
              {quote.text}
            </blockquote>
            {quote.note && (
              <p className="mt-4 font-source-serif-4 text-base text-text-secondary">
                {quote.note}
              </p>
            )}
            {quote.book && (
              <figcaption className="mt-6 flex items-center gap-3 border-t border-border-subtle pt-4">
                {quote.book.cover_url && (
                  <Link
                    href={`/book/${quote.book.slug ?? quote.book.id}`}
                    className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-bg-sunken"
                  >
                    <Image
                      src={quote.book.cover_url}
                      alt={quote.book.title}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </Link>
                )}
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={`/book/${quote.book.slug ?? quote.book.id}`}
                    className="truncate font-fraunces text-sm text-text-primary hover:text-brand-text"
                  >
                    {quote.book.title}
                  </Link>
                  <span className="truncate font-dm-sans text-xs text-text-tertiary">
                    {quote.book.author}
                  </span>
                </div>
              </figcaption>
            )}
          </figure>

          <div className="mt-6 flex items-center justify-between">
            {quote.author ? (
              <Link
                href={`/u/${quote.author.username}`}
                className="flex items-center gap-2 hover:text-brand-text"
              >
                <Avatar
                  src={quote.author.avatar_url}
                  name={quote.author.display_name}
                  size="sm"
                />
                <span className="font-dm-sans text-sm text-text-secondary">
                  Saved by @{quote.author.username}
                </span>
              </Link>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              <QuoteLikeButton
                quoteId={quote.id}
                initialCount={quote.like_count}
              />
              <span className="font-dm-mono text-xs text-text-tertiary">
                {formatRelativeDate(quote.created_at)}
              </span>
              <ShareButton url={shareUrl} text={quote.text.slice(0, 200)} />
            </div>
          </div>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

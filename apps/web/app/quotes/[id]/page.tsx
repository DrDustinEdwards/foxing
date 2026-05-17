import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { ShareButton } from '@/components/share-button'
import { formatRelativeDate } from '@foxing/utils'
import { fetchQuoteById } from '@/lib/queries'
import { getNavUser } from '@/lib/nav-user'
import { siteOrigin } from '@/lib/foxing'

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const quote = await fetchQuoteById(params.id)
  if (!quote) return { title: 'Passage not found · Foxing' }
  const origin = siteOrigin()
  const passage =
    quote.text.length > 200
      ? `${quote.text.slice(0, 200).trimEnd()}...`
      : quote.text
  const bookTitle = quote.book?.title ?? ''
  return {
    title: bookTitle
      ? `${bookTitle} passage · Foxing`
      : 'Passage · Foxing',
    description: passage,
    alternates: { canonical: `${origin}/quotes/${params.id}` },
    openGraph: {
      title: bookTitle ? `From ${bookTitle}` : 'A passage from Foxing',
      description: passage,
      url: `${origin}/quotes/${params.id}`,
      type: 'article',
    },
  }
}

export default async function QuotePage({
  params,
}: {
  params: { id: string }
}) {
  const [navUser, quote] = await Promise.all([
    getNavUser(),
    fetchQuoteById(params.id),
  ])
  if (!quote) notFound()
  const shareUrl = `${siteOrigin()}/quotes/${quote.id}`

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
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
                    href={`/book/${quote.book.id}`}
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
                    href={`/book/${quote.book.id}`}
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

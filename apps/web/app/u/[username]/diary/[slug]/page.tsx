import Image from 'next/image'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PrivateProfileNotice } from '@/components/private-profile-notice'
import { ShareButton } from '@/components/share-button'
import { StarRating } from '@/components/ui/star-rating'
import { fetchProfileByUsername, isUuid } from '@/lib/queries'
import { fetchPublicDiaryEntry } from '@/lib/missing-pages-queries'
import { buildDiaryEntryMetadata } from '@/lib/metadata'
import { getNavUser } from '@/lib/nav-user'
import { appBookDeeplink, siteOrigin } from '@/lib/foxing'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: { username: string; slug: string }
}): Promise<Metadata> {
  const profile = await fetchProfileByUsername(params.username)
  if (!profile || !profile.is_public) {
    return { title: 'Entry not found', robots: { index: false, follow: true } }
  }
  const entry = await fetchPublicDiaryEntry({
    userId: profile.id,
    slugOrId: params.slug,
  })
  if (!entry) {
    return { title: 'Entry not found', robots: { index: false, follow: true } }
  }
  return buildDiaryEntryMetadata({
    id: entry.id,
    slug: entry.slug,
    username: profile.username,
    display_name: profile.display_name,
    book_title: entry.book.title,
    book_author: entry.book.author,
    log_date: entry.log_date,
    rating: entry.rating,
    review: entry.review,
    book_cover_url: entry.book.cover_url,
  })
}

export default async function UserDiaryEntryPage({
  params,
}: {
  params: { username: string; slug: string }
}) {
  const [navUser, profile] = await Promise.all([
    getNavUser(),
    fetchProfileByUsername(params.username),
  ])
  if (!profile) notFound()
  if (!profile.is_public) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-base">
        <Nav user={navUser} />
        <main className="flex-1">
          <PrivateProfileNotice username={profile.username} />
        </main>
        <Footer />
      </div>
    )
  }
  const entry = await fetchPublicDiaryEntry({
    userId: profile.id,
    slugOrId: params.slug,
  })
  if (!entry) notFound()
  if (isUuid(params.slug) && entry.slug && entry.slug !== params.slug) {
    permanentRedirect(`/u/${profile.username}/diary/${entry.slug}`)
  }

  const origin = siteOrigin()
  const entryPath = entry.slug ?? entry.id
  const url = `${origin}/u/${profile.username}/diary/${entryPath}`
  const bookPath = entry.book.slug ?? entry.book.id
  const reviewJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': 'Book',
      name: entry.book.title,
      author: { '@type': 'Person', name: entry.book.author },
    },
    author: { '@type': 'Person', name: profile.display_name },
    datePublished: entry.log_date,
    url,
  }
  if (typeof entry.rating === 'number') {
    reviewJsonLd.reviewRating = {
      '@type': 'Rating',
      ratingValue: entry.rating,
      bestRating: 5,
    }
  }
  if (entry.review) reviewJsonLd.reviewBody = entry.review

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewJsonLd) }}
      />
      <main className="flex-1">
        <PageWrapper className="py-12">
          <Link
            href={`/u/${profile.username}/diary`}
            className="font-dm-sans text-sm text-text-tertiary hover:text-text-primary"
          >
            ← @{profile.username}&apos;s diary
          </Link>
          <article className="mt-6 flex flex-col gap-6">
            <header className="flex items-start gap-5">
              <Link
                href={`/book/${bookPath}`}
                className="relative h-36 w-24 shrink-0 overflow-hidden rounded bg-bg-sunken shadow-sm"
              >
                {entry.book.cover_url && (
                  <Image
                    src={entry.book.cover_url}
                    alt={entry.book.title}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                )}
              </Link>
              <div className="flex min-w-0 flex-col gap-1">
                <time className="font-dm-mono text-xs text-text-tertiary">
                  {entry.log_date}
                </time>
                <h1 className="font-fraunces text-[1.75rem] text-text-primary">
                  <Link
                    href={`/book/${bookPath}`}
                    className="hover:text-brand-text"
                  >
                    {entry.book.title}
                  </Link>
                </h1>
                <p className="font-dm-sans text-sm text-text-tertiary">
                  {entry.book.author}
                </p>
                {typeof entry.rating === 'number' && (
                  <div className="mt-1">
                    <StarRating value={entry.rating} size="md" readOnly />
                  </div>
                )}
              </div>
            </header>

            {entry.review && (
              <div className="max-w-prose font-source-serif-4 text-lg leading-relaxed text-text-primary">
                {entry.review.split(/\n\n+/).map((para, i) => (
                  <p key={i} className="mt-4 first:mt-0">
                    {para}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <a href={appBookDeeplink(entry.book.id)}>
                <Button variant="primary" size="md">
                  Read this book free
                </Button>
              </a>
              <ShareButton url={url} text={entry.book.title} />
            </div>
          </article>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

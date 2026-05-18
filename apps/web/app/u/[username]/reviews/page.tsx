import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PrivateProfileNotice } from '@/components/private-profile-notice'
import { StarRating } from '@/components/ui/star-rating'
import { UserSubpageHeader } from '@/components/user-subpage-header'
import { fetchProfileByUsername } from '@/lib/queries'
import {
  fetchPublicUserReviews,
  fetchUserCounts,
} from '@/lib/missing-pages-queries'
import { buildUserReviewsMetadata } from '@/lib/metadata'
import { getNavUser } from '@/lib/nav-user'
import { cn } from '@/lib/cn'

export const revalidate = 300

const RATING_FILTERS = [0, 5, 4, 3] as const

export async function generateMetadata({
  params,
}: {
  params: { username: string }
}): Promise<Metadata> {
  const profile = await fetchProfileByUsername(params.username)
  if (!profile || !profile.is_public) {
    return { title: 'Profile not found', robots: { index: false, follow: true } }
  }
  const counts = await fetchUserCounts(profile.id)
  return buildUserReviewsMetadata({
    display_name: profile.display_name,
    username: profile.username,
    review_count: counts.review_count,
  })
}

export default async function UserReviewsPage({
  params,
  searchParams,
}: {
  params: { username: string }
  searchParams: { rating?: string }
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
  const minRating = Number(searchParams.rating) || undefined
  const reviews = await fetchPublicUserReviews(profile.id, minRating)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <UserSubpageHeader
            username={profile.username}
            displayName={profile.display_name}
            section="reviews"
          />

          <div className="mt-6 flex flex-wrap gap-1">
            {RATING_FILTERS.map((r) => {
              const href =
                r === 0
                  ? `/u/${profile.username}/reviews`
                  : `/u/${profile.username}/reviews?rating=${r}`
              const active = (minRating ?? 0) === r
              return (
                <Link
                  key={r}
                  href={href}
                  className={cn(
                    'rounded-full px-3 py-1 font-dm-mono text-xs',
                    active
                      ? 'bg-brand-subtle text-brand-subtle-text'
                      : 'bg-bg-sunken text-text-secondary hover:bg-bg-hover',
                  )}
                >
                  {r === 0 ? 'All' : `${r}★ and up`}
                </Link>
              )
            })}
          </div>

          {reviews.length === 0 ? (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              No public reviews yet.
            </p>
          ) : (
            <ul className="mt-8 flex flex-col gap-5">
              {reviews.map((r) => (
                <li
                  key={r.id}
                  className="flex gap-4 rounded-lg border border-border-subtle bg-bg-surface p-5"
                >
                  <Link
                    href={`/book/${r.book.slug ?? r.book.id}`}
                    className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-bg-sunken"
                  >
                    {r.book.cover_url && (
                      <Image
                        src={r.book.cover_url}
                        alt={r.book.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Link
                      href={`/book/${r.book.slug ?? r.book.id}`}
                      className="truncate font-fraunces text-base text-text-primary hover:text-brand-text"
                    >
                      {r.book.title}
                    </Link>
                    <p className="font-dm-sans text-xs text-text-tertiary">
                      {r.book.author}
                    </p>
                    {typeof r.rating === 'number' && (
                      <StarRating value={r.rating} size="sm" readOnly />
                    )}
                    <p className="font-source-serif-4 text-sm text-text-secondary">
                      {r.review}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

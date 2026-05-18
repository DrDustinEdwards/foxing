import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { ReviewCard } from '@/components/review-card'
import {
  fetchIsFollowing,
  fetchProfileByUsername,
  fetchProfileReviews,
  fetchProfileStats,
  fetchTasteCompatibility,
  fetchUserFavorites,
} from '@/lib/queries'
import { getAuthedUserId, getNavUser } from '@/lib/nav-user'
import { profileJsonLd } from '@/lib/structured-data'
import { buildProfileMetadata } from '@/lib/metadata'
import { Badge } from '@/components/ui/badge'
import { FollowButton } from './follow-button'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: { username: string }
}): Promise<Metadata> {
  const profile = await fetchProfileByUsername(params.username)
  if (!profile) return { title: 'Profile not found' }
  if (!profile.is_public) {
    return { title: `@${profile.username}`, robots: { index: false, follow: false } }
  }
  const stats = await fetchProfileStats(profile.id)
  return buildProfileMetadata({
    display_name: profile.display_name,
    username: profile.username,
    reading_personality: profile.reading_personality,
    books_count: stats.books_finished,
  })
}

export default async function ProfilePage({
  params,
}: {
  params: { username: string }
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
        <main className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <h1 className="font-fraunces text-2xl text-text-primary">
              @{profile.username}
            </h1>
            <p className="mt-2 font-source-serif-4 text-base text-text-tertiary">
              This profile is private.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const viewerId = await getAuthedUserId()
  const isOwnProfile = viewerId === profile.id
  const [favorites, stats, reviews, isFollowing, taste] = await Promise.all([
    fetchUserFavorites(profile.id),
    fetchProfileStats(profile.id),
    fetchProfileReviews(profile.id, 3),
    viewerId && !isOwnProfile
      ? fetchIsFollowing({ followerId: viewerId, followingId: profile.id })
      : Promise.resolve(false),
    viewerId && !isOwnProfile
      ? fetchTasteCompatibility({ viewerId, profileId: profile.id })
      : Promise.resolve(null),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: profileJsonLd({
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            reading_personality: profile.reading_personality,
            bio: profile.bio,
          }),
        }}
      />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
              <Avatar
                src={profile.avatar_url}
                name={profile.display_name}
                size="lg"
              />
              <div className="flex flex-col gap-1">
                <h1 className="font-fraunces text-[1.75rem] leading-none text-text-primary">
                  {profile.display_name}
                </h1>
                <span className="font-dm-sans text-sm text-text-tertiary">
                  @{profile.username}
                </span>
                {profile.reading_personality && (
                  <p className="mt-1 max-w-prose font-source-serif-4 italic text-text-tertiary">
                    {profile.reading_personality}
                  </p>
                )}
                {taste && (
                  <Badge variant="brand" className="mt-2 w-fit">
                    {taste.shared === 0
                      ? 'No book overlap yet'
                      : `${taste.percent}% taste match`}
                  </Badge>
                )}
              </div>
            </div>
            {viewerId && !isOwnProfile && (
              <FollowButton
                targetUserId={profile.id}
                username={profile.username}
                initiallyFollowing={isFollowing}
              />
            )}
          </header>

          <section className="mt-10">
            <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
              5 books
            </h2>
            <FavoritesRow favorites={favorites} />
          </section>

          <StatsRow stats={stats} username={profile.username} />

          {reviews.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                Recent reviews
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {reviews.map((r) => (
                  <div key={r.id} className="flex flex-col gap-2">
                    {r.book && (
                      <Link
                        href={`/book/${r.book.slug ?? r.book.id}`}
                        className="font-fraunces text-sm text-text-primary hover:text-brand-text"
                      >
                        {r.book.title}
                      </Link>
                    )}
                    <ReviewCard
                      review={{
                        id: r.id,
                        user_id: r.user_id,
                        book_id: r.book?.id ?? '',
                        rating_half: r.rating,
                        review: r.review,
                        mood_tags: null,
                        pacing: null,
                        created_at: r.created_at,
                        author: r.author ?? undefined,
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function FavoritesRow({
  favorites,
}: {
  favorites: Awaited<ReturnType<typeof fetchUserFavorites>>
}) {
  const slots = [1, 2, 3, 4, 5]
  const byPos = new Map(favorites.map((f) => [f.position, f.book]))
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {slots.map((pos) => {
        const book = byPos.get(pos)
        if (!book) {
          return (
            <div
              key={pos}
              className="flex h-[108px] w-[72px] shrink-0 items-center justify-center rounded-md border border-dashed border-border-default bg-bg-sunken"
              aria-label="empty favorite slot"
            />
          )
        }
        return (
          <Link
            key={pos}
            href={`/book/${book.slug ?? book.id}`}
            className="relative h-[108px] w-[72px] shrink-0 overflow-hidden rounded-md bg-bg-sunken"
          >
            {book.cover_url && (
              <Image
                src={book.cover_url}
                alt={book.title}
                fill
                sizes="72px"
                className="object-cover"
              />
            )}
          </Link>
        )
      })}
    </div>
  )
}

function StatsRow({
  stats,
  username,
}: {
  stats: Awaited<ReturnType<typeof fetchProfileStats>>
  username: string
}) {
  const items = [
    { label: 'Books read', value: stats.books_finished, href: `/u/${username}` },
    { label: 'Highlights', value: stats.highlights, href: `/u/${username}` },
    { label: 'Following', value: stats.following, href: `/u/${username}` },
    { label: 'Followers', value: stats.followers, href: `/u/${username}` },
  ]
  return (
    <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-border-subtle bg-bg-surface px-4 py-3"
        >
          <p className="font-fraunces text-2xl text-text-primary">{s.value}</p>
          <p className="font-dm-sans text-xs uppercase tracking-wide text-text-tertiary">
            {s.label}
          </p>
        </div>
      ))}
    </section>
  )
}

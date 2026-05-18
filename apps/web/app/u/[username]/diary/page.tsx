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
  fetchPublicDiary,
  fetchUserCounts,
} from '@/lib/missing-pages-queries'
import { buildUserDiaryMetadata } from '@/lib/metadata'
import { getNavUser } from '@/lib/nav-user'
import { cn } from '@/lib/cn'

export const revalidate = 300

const YEARS = [2024, 2025, 2026]

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
  return buildUserDiaryMetadata({
    display_name: profile.display_name,
    username: profile.username,
    entry_count: counts.diary_count,
  })
}

export default async function UserDiaryPage({
  params,
  searchParams,
}: {
  params: { username: string }
  searchParams: { year?: string }
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
  const year = YEARS.find((y) => String(y) === searchParams.year) ?? null
  const entries = await fetchPublicDiary(profile.id, year ?? undefined)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <UserSubpageHeader
            username={profile.username}
            displayName={profile.display_name}
            section="diary"
          />

          <div className="mt-6 flex flex-wrap gap-1">
            <YearTab username={profile.username} year={null} current={year} />
            {YEARS.map((y) => (
              <YearTab
                key={y}
                username={profile.username}
                year={y}
                current={year}
              />
            ))}
          </div>

          {entries.length === 0 ? (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              No public diary entries.
            </p>
          ) : (
            <ol className="mt-6 flex flex-col gap-3">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex gap-4 rounded-lg border border-border-subtle bg-bg-surface p-4"
                >
                  <Link
                    href={`/book/${e.book.slug ?? e.book.id}`}
                    className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-bg-sunken"
                  >
                    {e.book.cover_url && (
                      <Image
                        src={e.book.cover_url}
                        alt={e.book.title}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <time className="font-dm-mono text-xs text-text-tertiary">
                      {e.log_date}
                    </time>
                    <Link
                      href={`/u/${profile.username}/diary/${e.slug ?? e.id}`}
                      className="truncate font-fraunces text-base text-text-primary hover:text-brand-text"
                    >
                      {e.book.title}
                    </Link>
                    {typeof e.rating === 'number' && (
                      <StarRating value={e.rating} size="sm" readOnly />
                    )}
                    {e.review && (
                      <p className="line-clamp-2 font-source-serif-4 text-sm text-text-secondary">
                        {e.review}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function YearTab({
  username,
  year,
  current,
}: {
  username: string
  year: number | null
  current: number | null
}) {
  const href =
    year === null
      ? `/u/${username}/diary`
      : `/u/${username}/diary?year=${year}`
  const label = year === null ? 'All' : String(year)
  const active = current === year
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full px-3 py-1 font-dm-mono text-xs',
        active
          ? 'bg-brand-subtle text-brand-subtle-text'
          : 'bg-bg-sunken text-text-secondary hover:bg-bg-hover',
      )}
    >
      {label}
    </Link>
  )
}

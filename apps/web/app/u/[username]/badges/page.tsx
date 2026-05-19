import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { formatRelativeDate } from '@foxing/utils'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchAllBadges, fetchUserBadges, type BadgeRow, type EarnedBadge } from '@/lib/badges'
import { fetchProfileByUsername } from '@/lib/queries'
import { getNavUser } from '@/lib/nav-user'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

const CATEGORY_LABEL: Record<string, string> = {
  reading: 'Reading',
  social: 'Social',
  streak: 'Streaks',
  club: 'Clubs',
  milestone: 'Milestones',
}

export async function generateMetadata({
  params,
}: {
  params: { username: string }
}): Promise<Metadata> {
  const profile = await fetchProfileByUsername(params.username)
  if (!profile) return { title: 'Profile not found' }
  return {
    title: `${profile.display_name}'s badges · Foxing`,
    alternates: {
      canonical: `${FOXING_BASE_URL}/u/${params.username}/badges`,
    },
    robots: { index: profile.is_public, follow: true },
  }
}

export default async function UserBadgesPage({
  params,
}: {
  params: { username: string }
}) {
  const [navUser, profile] = await Promise.all([
    getNavUser(),
    fetchProfileByUsername(params.username),
  ])
  if (!profile) notFound()

  const [earned, all] = await Promise.all([
    fetchUserBadges(profile.id),
    fetchAllBadges(),
  ])
  const earnedBySlug = new Map<string, EarnedBadge>()
  for (const b of earned) earnedBySlug.set(b.slug, b)

  const grouped = new Map<string, BadgeRow[]>()
  for (const b of all) {
    const key = b.category ?? 'other'
    const list = grouped.get(key) ?? []
    list.push(b)
    grouped.set(key, list)
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <Link
            href={`/u/${profile.username}`}
            className="font-dm-sans text-sm text-text-tertiary hover:text-text-primary"
          >
            ← {profile.display_name}
          </Link>
          <h1 className="mt-4 font-fraunces text-[2rem] text-text-primary">
            Badges
          </h1>
          <p className="mt-1 font-source-serif-4 text-base text-text-secondary">
            {earned.length} of {all.length} earned.
          </p>

          <div className="mt-8 flex flex-col gap-10">
            {[...grouped.entries()].map(([category, badges]) => (
              <section key={category}>
                <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                  {CATEGORY_LABEL[category] ?? category}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {badges.map((b) => {
                    const e = earnedBySlug.get(b.slug)
                    const isEarned = Boolean(e)
                    return (
                      <li
                        key={b.id}
                        className={`flex gap-3 rounded-lg border p-4 ${
                          isEarned
                            ? 'border-border-subtle bg-bg-surface'
                            : 'border-border-subtle bg-bg-sunken opacity-60'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-brand-subtle text-2xl"
                        >
                          {b.icon ?? (isEarned ? '★' : '🔒')}
                        </span>
                        <div className="flex flex-col gap-1">
                          <p className="font-fraunces text-base text-text-primary">
                            {b.name}
                          </p>
                          {b.description && (
                            <p className="font-source-serif-4 text-sm text-text-secondary">
                              {b.description}
                            </p>
                          )}
                          {isEarned && e ? (
                            <p className="font-dm-mono text-[11px] text-text-tertiary">
                              Earned {formatRelativeDate(e.earned_at)}
                            </p>
                          ) : (
                            <p className="font-dm-mono text-[11px] text-text-tertiary">
                              Keep reading to unlock
                            </p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

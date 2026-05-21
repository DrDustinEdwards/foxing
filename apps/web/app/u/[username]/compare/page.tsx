import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { getAuthedUserId, getNavUser } from '@/lib/nav-user'
import { fetchProfileByUsername } from '@/lib/queries'
import { fetchCompareStats, type UserCompareStats } from '@/lib/compare-stats'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: { username: string }
}): Promise<Metadata> {
  return {
    title: `Compare with @${params.username} · Foxing`,
    robots: { index: false, follow: false },
  }
}

export default async function ComparePage({
  params,
}: {
  params: { username: string }
}) {
  const viewerId = await getAuthedUserId()
  if (!viewerId) redirect(`/sign-in?next=/u/${params.username}/compare`)

  const [profile, navUser] = await Promise.all([
    fetchProfileByUsername(params.username),
    getNavUser(),
  ])
  if (!profile || !profile.is_public) notFound()
  if (profile.id === viewerId) redirect(`/u/${params.username}`)

  const compare = await fetchCompareStats(viewerId, profile.id)

  const viewerLabel =
    navUser?.display_name ?? navUser?.username ?? 'You'

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-col gap-2">
            <p className="font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
              Reading comparison
            </p>
            <h1 className="font-fraunces text-[2rem] text-text-primary">
              {viewerLabel} vs {profile.display_name}
            </h1>
            <Badge variant="brand" className="w-fit">
              {compare.shared_count === 0
                ? 'No book overlap yet'
                : `${compare.taste_percent}% taste match`}
            </Badge>
          </header>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <UserColumn
              name={viewerLabel}
              avatarUrl={navUser?.avatar_url ?? null}
              stats={compare.viewer}
              href="/stats"
            />
            <UserColumn
              name={profile.display_name}
              avatarUrl={profile.avatar_url}
              stats={compare.other}
              href={`/u/${profile.username}`}
            />
          </div>

          <section className="mt-10">
            <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
              Books in common ({compare.shared_count})
            </h2>
            {compare.shared_books.length === 0 ? (
              <p className="font-source-serif-4 text-base text-text-tertiary">
                You have not finished any of the same books yet.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                {compare.shared_books.map((b) => (
                  <li key={b.id} className="flex flex-col gap-2">
                    <Link
                      href={`/book/${b.slug ?? b.id}`}
                      className="group"
                    >
                      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-bg-sunken shadow-sm">
                        {b.cover_url && (
                          <Image
                            src={b.cover_url}
                            alt={b.title}
                            fill
                            sizes="(max-width: 768px) 45vw, 18vw"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <p className="mt-2 truncate font-fraunces text-sm text-text-primary group-hover:text-brand-text">
                        {b.title}
                      </p>
                      <p className="truncate font-dm-sans text-xs text-text-tertiary">
                        {b.author}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function UserColumn({
  name,
  avatarUrl,
  stats,
  href,
}: {
  name: string
  avatarUrl: string | null
  stats: UserCompareStats
  href: string
}) {
  return (
    <article className="rounded-lg border border-border-subtle bg-bg-surface p-5">
      <Link href={href} className="flex items-center gap-3">
        <Avatar src={avatarUrl} name={name} size="md" />
        <p className="font-fraunces text-lg text-text-primary hover:text-brand-text">
          {name}
        </p>
      </Link>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Finished" value={stats.books_finished.toString()} />
        <Stat
          label="Avg rating"
          value={stats.avg_rating ? `${stats.avg_rating.toFixed(1)}/5` : '–'}
        />
        <Stat label="Streak" value={`${stats.current_streak} days`} />
        <Stat
          label="Longest streak"
          value={`${stats.longest_streak} days`}
        />
      </dl>
      <Section title="Top themes" items={stats.top_themes} />
      <Section title="Top moods" items={stats.top_moods} />
      <div className="mt-4">
        <p className="font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Most-read author
        </p>
        <p className="mt-1 font-fraunces text-base text-text-primary">
          {stats.most_read_author ?? 'No data yet'}
        </p>
      </div>
    </article>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-dm-mono text-[10px] uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd className="mt-0.5 font-fraunces text-xl text-text-primary">
        {value}
      </dd>
    </div>
  )
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-1 font-source-serif-4 text-sm text-text-tertiary">
          Not enough data yet.
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((t) => (
            <li
              key={t}
              className="rounded-full bg-brand-subtle px-2.5 py-1 font-dm-sans text-xs capitalize text-brand-subtle-text"
            >
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

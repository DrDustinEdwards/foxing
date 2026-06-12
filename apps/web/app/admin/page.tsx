import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatRelativeDate } from '@foxing/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin overview · Foxing',
}

interface RecentSignup {
  id: string
  display_name: string
  username: string
  created_at: string
  subscription_tier: string | null
}

interface ActiveClub {
  id: string
  name: string
  post_count: number
}

interface TopBook {
  id: string
  slug: string | null
  title: string
  author: string
  cover_url: string | null
  reader_count: number
}

export default async function AdminOverviewPage() {
  const admin = createAdminClient()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    totalUsersRes,
    newTodayRes,
    activeSubsRes,
    finishedThisWeekRes,
    recentSignupsRes,
    clubPostsRes,
    currentlyReadingRes,
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', since24h),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('subscription_tier', 'plus'),
    admin
      .from('user_books')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'finished')
      .gt('finished_at', since7d),
    admin
      .from('profiles')
      .select('id, display_name, username, created_at, subscription_tier')
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('club_posts')
      .select('id, thread_id, club_threads!inner(club_id, clubs!inner(id, name))')
      .gt('created_at', since7d)
      .limit(500),
    admin
      .from('user_books')
      .select('book_id, books:book_id(id, slug, title, author, cover_url)')
      .eq('status', 'reading')
      .limit(500),
  ])

  const totalUsers = totalUsersRes.count ?? 0
  const newToday = newTodayRes.count ?? 0
  const activeSubs = activeSubsRes.count ?? 0
  const finishedThisWeek = finishedThisWeekRes.count ?? 0
  const recentSignups = (recentSignupsRes.data as RecentSignup[] | null) ?? []

  // Aggregate club posts -> top clubs
  const clubCounts = new Map<string, ActiveClub>()
  for (const row of (clubPostsRes.data as unknown as Array<{
    id: string
    club_threads: { club_id: string; clubs: { id: string; name: string } | null } | null
  }> | null) ?? []) {
    const club = row.club_threads?.clubs
    if (!club) continue
    const existing = clubCounts.get(club.id)
    if (existing) existing.post_count++
    else clubCounts.set(club.id, { id: club.id, name: club.name, post_count: 1 })
  }
  const topClubs = [...clubCounts.values()]
    .sort((a, b) => b.post_count - a.post_count)
    .slice(0, 5)

  // Aggregate user_books reading -> top books
  const bookCounts = new Map<string, TopBook>()
  for (const row of (currentlyReadingRes.data as unknown as Array<{
    book_id: string
    books: {
      id: string
      slug: string | null
      title: string
      author: string
      cover_url: string | null
    } | null
  }> | null) ?? []) {
    if (!row.books) continue
    const existing = bookCounts.get(row.books.id)
    if (existing) existing.reader_count++
    else
      bookCounts.set(row.books.id, {
        id: row.books.id,
        slug: row.books.slug,
        title: row.books.title,
        author: row.books.author,
        cover_url: row.books.cover_url,
        reader_count: 1,
      })
  }
  const topBooks = [...bookCounts.values()]
    .sort((a, b) => b.reader_count - a.reader_count)
    .slice(0, 5)

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">Overview</h1>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <StatCard label="Total users" value={totalUsers.toLocaleString()} />
        <StatCard label="New in 24h" value={newToday.toLocaleString()} />
        <StatCard label="Plus" value={activeSubs.toLocaleString()} />
        <StatCard
          label="Finished this week"
          value={finishedThisWeek.toLocaleString()}
        />
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Panel heading="Recent signups">
          {recentSignups.length === 0 ? (
            <EmptyRow>No signups yet.</EmptyRow>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {recentSignups.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <Link
                    href={`/admin/users/${s.id}`}
                    className="flex min-w-0 flex-col"
                  >
                    <span className="truncate font-dm-sans text-sm text-text-primary hover:text-brand-text">
                      {s.display_name}
                    </span>
                    <span className="truncate font-dm-mono text-xs text-text-tertiary">
                      @{s.username}
                    </span>
                  </Link>
                  <div className="flex items-center gap-3 font-dm-mono text-xs text-text-tertiary">
                    <span className="capitalize">
                      {s.subscription_tier ?? 'free'}
                    </span>
                    <span>{formatRelativeDate(s.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel heading="Most active clubs (last 7 days)">
          {topClubs.length === 0 ? (
            <EmptyRow>No club activity this week.</EmptyRow>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {topClubs.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <Link
                    href={`/admin/clubs/${c.id}/posts`}
                    className="truncate font-dm-sans text-sm text-text-primary hover:text-brand-text"
                  >
                    {c.name}
                  </Link>
                  <span className="font-dm-mono text-xs text-text-tertiary">
                    {c.post_count} posts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <section className="mt-10">
        <Panel heading="Top books being read right now">
          {topBooks.length === 0 ? (
            <EmptyRow>Nobody is mid-book at the moment.</EmptyRow>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {topBooks.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-col gap-2 rounded-md border border-border-subtle p-3"
                >
                  <Link
                    href={`/book/${b.slug ?? b.id}`}
                    className="relative aspect-[2/3] w-full overflow-hidden rounded bg-bg-sunken"
                  >
                    {b.cover_url && (
                      <Image
                        src={b.cover_url}
                        alt={b.title}
                        fill
                        sizes="120px"
                        className="object-cover"
                      />
                    )}
                  </Link>
                  <p className="line-clamp-2 font-fraunces text-sm text-text-primary">
                    {b.title}
                  </p>
                  <p className="truncate font-dm-sans text-xs text-text-tertiary">
                    {b.author}
                  </p>
                  <p className="font-dm-mono text-xs text-text-tertiary">
                    {b.reader_count} reading
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-4">
      <p className="font-fraunces text-2xl text-text-primary">{value}</p>
      <p className="mt-1 font-dm-sans text-xs uppercase tracking-wide text-text-tertiary">
        {label}
      </p>
    </div>
  )
}

function Panel({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-bg-surface p-5">
      <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        {heading}
      </h2>
      {children}
    </section>
  )
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-source-serif-4 text-sm text-text-tertiary">{children}</p>
  )
}

import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { CountBarChart, DonutChart, SignupsLine } from './charts'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Analytics, Foxing admin',
}

interface TopBookRow {
  book_id: string
  books: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  } | null
}

export default async function AdminAnalyticsPage() {
  const admin = createAdminClient()
  const now = Date.now()
  const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000)
  since30.setUTCHours(0, 0, 0, 0)
  const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const sinceMonth = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    profilesRes,
    tiersRes,
    cacheRes,
    sourcesRes,
    themesRes,
    totalUsersRes,
    dauRes,
    mauRes,
    subscribedRes,
    bookCountRes,
    topBooksRes,
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('created_at')
      .gte('created_at', since30.toISOString()),
    admin.from('profiles').select('subscription_tier'),
    admin.from('book_ai_cache').select('action'),
    admin.from('books').select('source'),
    admin.from('books').select('themes').limit(2000),
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin
      .from('user_books')
      .select('user_id', { count: 'exact', head: true })
      .gt('created_at', since24h),
    admin
      .from('user_books')
      .select('user_id', { count: 'exact', head: true })
      .gt('created_at', sinceMonth),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('subscription_tier', ['plus', 'patron']),
    admin.from('books').select('id', { count: 'exact', head: true }),
    admin
      .from('user_books')
      .select('book_id, books:book_id(id, slug, title, author, cover_url)')
      .gt('created_at', since7)
      .limit(500),
  ])

  const signups = bucketByDay(
    ((profilesRes.data as { created_at: string }[] | null) ?? []).map(
      (p) => p.created_at,
    ),
    since30,
    30,
  )

  const tierCounts = countField<{ subscription_tier: string | null }>(
    (tiersRes.data as { subscription_tier: string | null }[] | null) ?? [],
    (r) => r.subscription_tier ?? 'free',
  )
  const tierData = [...tierCounts.entries()].map(([name, value]) => ({
    name,
    value,
  }))

  const cacheCounts = countField<{ action: string | null }>(
    (cacheRes.data as { action: string | null }[] | null) ?? [],
    (r) => r.action ?? 'unknown',
  )
  const aiUsage = [...cacheCounts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  const sourceCounts = countField<{ source: string | null }>(
    (sourcesRes.data as { source: string | null }[] | null) ?? [],
    (r) => r.source ?? 'unknown',
  )
  const sources = [...sourceCounts.entries()].map(([name, value]) => ({
    name,
    value,
  }))

  const themeCounts = new Map<string, number>()
  for (const row of (themesRes.data as { themes: string[] | null }[] | null) ??
    []) {
    if (!row.themes) continue
    for (const t of row.themes) {
      themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1)
    }
  }
  const topThemes = [...themeCounts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  const topBookCounts = new Map<
    string,
    {
      id: string
      slug: string | null
      title: string
      author: string
      cover_url: string | null
      readers: number
    }
  >()
  for (const row of (topBooksRes.data as unknown as TopBookRow[] | null) ?? []) {
    if (!row.books) continue
    const existing = topBookCounts.get(row.books.id)
    if (existing) {
      existing.readers++
    } else {
      topBookCounts.set(row.books.id, {
        id: row.books.id,
        slug: row.books.slug,
        title: row.books.title,
        author: row.books.author,
        cover_url: row.books.cover_url,
        readers: 1,
      })
    }
  }
  const topBooks = [...topBookCounts.values()]
    .sort((a, b) => b.readers - a.readers)
    .slice(0, 10)

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Analytics
      </h1>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-5">
        <StatCard
          label="Total users"
          value={(totalUsersRes.count ?? 0).toLocaleString()}
        />
        <StatCard
          label="DAU (last 24h)"
          value={(dauRes.count ?? 0).toLocaleString()}
        />
        <StatCard
          label="MAU (last 30d)"
          value={(mauRes.count ?? 0).toLocaleString()}
        />
        <StatCard
          label="Subscribed"
          value={(subscribedRes.count ?? 0).toLocaleString()}
        />
        <StatCard
          label="Books in catalog"
          value={(bookCountRes.count ?? 0).toLocaleString()}
        />
      </section>

      <section className="mt-6">
        <Panel heading="Signups, last 30 days">
          <SignupsLine data={signups} />
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <Panel heading="Subscription mix">
          <DonutChart data={tierData} />
          <Legend items={tierData} />
        </Panel>
        <Panel heading="Books by source">
          <DonutChart data={sources} />
          <Legend items={sources} />
        </Panel>
      </section>

      <section className="mt-6">
        <Panel heading="AI cache by action, last 30 days">
          {aiUsage.length === 0 ? (
            <p className="font-source-serif-4 text-sm text-text-tertiary">
              No AI cache entries yet.
            </p>
          ) : (
            <CountBarChart data={aiUsage} />
          )}
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <Panel heading="Top themes in catalog">
          {topThemes.length === 0 ? (
            <p className="font-source-serif-4 text-sm text-text-tertiary">
              Themes not populated yet.
            </p>
          ) : (
            <CountBarChart data={topThemes} />
          )}
        </Panel>
        <Panel heading="Top books this week">
          {topBooks.length === 0 ? (
            <p className="font-source-serif-4 text-sm text-text-tertiary">
              No reading activity in the last 7 days.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {topBooks.map((b) => (
                <li key={b.id} className="flex items-center gap-3">
                  <div className="relative h-10 w-7 shrink-0 overflow-hidden rounded bg-bg-sunken">
                    {b.cover_url && (
                      <Image
                        src={b.cover_url}
                        alt=""
                        fill
                        sizes="28px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <Link
                    href={`/book/${b.slug ?? b.id}`}
                    className="flex-1 truncate font-dm-sans text-sm text-text-primary hover:text-brand-text"
                  >
                    {b.title}
                  </Link>
                  <span className="font-dm-mono text-xs text-text-tertiary">
                    {b.readers} readers
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  )
}

function bucketByDay(
  dates: string[],
  since: Date,
  days: number,
): Array<{ day: string; count: number }> {
  const buckets: Array<{ day: string; count: number }> = []
  const cursor = new Date(since)
  for (let i = 0; i < days; i++) {
    buckets.push({ day: dayLabel(cursor), count: 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  const startMs = since.getTime()
  for (const d of dates) {
    const t = new Date(d).getTime()
    if (Number.isNaN(t)) continue
    const idx = Math.floor((t - startMs) / (24 * 60 * 60 * 1000))
    if (idx >= 0 && idx < buckets.length) buckets[idx]!.count++
  }
  return buckets
}

function dayLabel(d: Date): string {
  const month = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  return `${month}/${day}`
}

function countField<T>(rows: T[], pick: (r: T) => string): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rows) {
    const k = pick(r)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return map
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

function Legend({
  items,
}: {
  items: Array<{ name: string; value: number }>
}) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-dm-mono text-xs text-text-tertiary">
      {items.map((it) => (
        <li key={it.name}>
          {it.name}: {it.value}
        </li>
      ))}
    </ul>
  )
}

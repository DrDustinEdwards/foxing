import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { CountBarChart, DonutChart, SignupsLine } from './charts'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Analytics · Admin · Foxing',
}

export default async function AdminAnalyticsPage() {
  const admin = createAdminClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  since.setUTCHours(0, 0, 0, 0)

  const [profilesRes, tiersRes, cacheRes, sourcesRes, themesRes] =
    await Promise.all([
      admin
        .from('profiles')
        .select('created_at')
        .gte('created_at', since.toISOString()),
      admin.from('profiles').select('subscription_tier'),
      admin.from('book_ai_cache').select('action'),
      admin.from('books').select('source'),
      admin.from('books').select('themes').limit(2000),
    ])

  const signups = bucketByDay(
    ((profilesRes.data as { created_at: string }[] | null) ?? []).map(
      (p) => p.created_at,
    ),
    since,
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

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Analytics
      </h1>

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
        <Panel heading="AI cache by action (proxy for feature usage)">
          {aiUsage.length === 0 ? (
            <p className="font-source-serif-4 text-sm text-text-tertiary">
              No AI cache entries yet.
            </p>
          ) : (
            <CountBarChart data={aiUsage} />
          )}
        </Panel>
      </section>

      <section className="mt-6">
        <Panel heading="Top themes in catalog">
          {topThemes.length === 0 ? (
            <p className="font-source-serif-4 text-sm text-text-tertiary">
              Themes not populated yet.
            </p>
          ) : (
            <CountBarChart data={topThemes} />
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
    if (idx >= 0 && idx < buckets.length) buckets[idx].count++
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

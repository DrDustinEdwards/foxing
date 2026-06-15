import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '404 log · Admin',
  robots: { index: false, follow: false },
}

interface Row {
  path: string
  referrer: string | null
  created_at: string
}

interface Grouped {
  path: string
  count: number
  last_seen: string
  top_referrer: string | null
}

function groupRows(rows: Row[]): Grouped[] {
  const map = new Map<string, {
    path: string
    count: number
    last_seen: string
    referrers: Map<string, number>
  }>()
  for (const r of rows) {
    const entry = map.get(r.path) ?? {
      path: r.path,
      count: 0,
      last_seen: r.created_at,
      referrers: new Map<string, number>(),
    }
    entry.count++
    if (r.created_at > entry.last_seen) entry.last_seen = r.created_at
    if (r.referrer) {
      entry.referrers.set(r.referrer, (entry.referrers.get(r.referrer) ?? 0) + 1)
    }
    map.set(r.path, entry)
  }
  return [...map.values()]
    .map((e) => {
      let top: string | null = null
      let topCount = 0
      for (const [ref, c] of e.referrers) {
        if (c > topCount) {
          top = ref
          topCount = c
        }
      }
      return {
        path: e.path,
        count: e.count,
        last_seen: e.last_seen,
        top_referrer: top,
      }
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return b.last_seen.localeCompare(a.last_seen)
    })
}

export default async function Admin404sPage() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('page_404s')
    .select('path, referrer, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  const rows = (data as Row[] | null) ?? []
  const grouped = groupRows(rows)

  return (
    <PageWrapper className="py-10">
      <PageHeader
        title="404 log"
        subtitle="Recent broken-link hits, grouped by path. Last 500 events."
        subtitleVariant="description"
      />
      <section className="mt-8">
        {grouped.length === 0 ? (
          <p className="font-source-serif-4 text-base text-text-tertiary">
            No 404s logged yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-subtle font-dm-mono text-[0.6875rem] uppercase tracking-wider text-text-tertiary">
                <tr>
                  <th className="py-2 pr-3">Path</th>
                  <th className="py-2 pr-3">Hits</th>
                  <th className="py-2 pr-3">Last seen</th>
                  <th className="py-2 pr-3">Top referrer</th>
                  <th className="py-2 pr-3">Open</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((g) => (
                  <tr key={g.path} className="border-b border-border-subtle">
                    <td className="py-2 pr-3 font-dm-mono text-xs text-text-primary">
                      {g.path}
                    </td>
                    <td className="py-2 pr-3 font-dm-mono text-xs text-text-secondary">
                      {g.count}
                    </td>
                    <td className="py-2 pr-3 font-dm-mono text-xs text-text-tertiary">
                      {new Date(g.last_seen).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 font-dm-sans text-xs text-text-tertiary">
                      {g.top_referrer ?? '-'}
                    </td>
                    <td className="py-2 pr-3 font-dm-sans text-xs">
                      <a
                        href={g.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-text hover:underline"
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageWrapper>
  )
}

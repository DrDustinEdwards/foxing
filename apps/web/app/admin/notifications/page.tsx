import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatRelativeDate } from '@foxing/utils'
import { BroadcastForm } from './broadcast-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Send notification · Admin · Foxing',
}

interface BroadcastRow {
  id: string
  title: string
  body: string
  data: { target?: string } | null
  created_at: string
}

export default async function AdminNotificationsPage() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('notifications')
    .select('id, title, body, data, created_at')
    .eq('type', 'admin_broadcast')
    .order('created_at', { ascending: false })
    .limit(20)

  // Group by title+body+created_at minute so a fan-out of 1,000 inserts shows
  // as one row.
  const map = new Map<
    string,
    { id: string; title: string; body: string; target: string; created_at: string; count: number }
  >()
  for (const row of (data as BroadcastRow[] | null) ?? []) {
    const minute = row.created_at.slice(0, 16)
    const key = `${minute}-${row.title}-${row.body}`
    const existing = map.get(key)
    if (existing) existing.count++
    else
      map.set(key, {
        id: row.id,
        title: row.title,
        body: row.body,
        target: row.data?.target ?? 'all',
        created_at: row.created_at,
        count: 1,
      })
  }
  const recent = [...map.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Send a notification
      </h1>
      <p className="mt-1 max-w-prose font-source-serif-4 text-sm text-text-tertiary">
        Saved to the notifications table for in-app delivery. No push, no
        scheduling yet.
      </p>

      <section className="mt-6 max-w-2xl rounded-lg border border-border-subtle bg-bg-surface p-5">
        <BroadcastForm />
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Recent broadcasts
        </h2>
        {recent.length === 0 ? (
          <p className="font-source-serif-4 text-sm text-text-tertiary">
            No broadcasts sent yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {recent.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-border-subtle bg-bg-surface p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-fraunces text-base text-text-primary">
                    {r.title}
                  </h3>
                  <div className="flex items-center gap-2 font-dm-mono text-xs text-text-tertiary">
                    <Badge variant="neutral">{r.target}</Badge>
                    <span>{r.count} recipients</span>
                    <span>{formatRelativeDate(r.created_at)}</span>
                  </div>
                </div>
                <p className="mt-2 font-source-serif-4 text-sm text-text-secondary">
                  {r.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatRelativeDate } from '@foxing/utils'
import { BroadcastForm } from './broadcast-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Send notification, Foxing admin',
}

interface LogRow {
  id: string
  title: string
  body: string
  target_type: string
  target_value: string | null
  recipient_count: number
  sent_at: string
}

export default async function AdminNotificationsPage() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_notification_log')
    .select('id, title, body, target_type, target_value, recipient_count, sent_at')
    .order('sent_at', { ascending: false })
    .limit(20)
  const recent = (data as LogRow[] | null) ?? []

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Send a notification
      </h1>
      <p className="mt-1 max-w-prose font-source-serif-4 text-sm text-text-tertiary">
        Inserts into the in-app notifications table. No push, no scheduling.
      </p>

      <section className="mt-6 max-w-2xl rounded-lg border border-border-subtle bg-bg-surface p-5">
        <BroadcastForm />
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="mb-3 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
          Recent sends
        </h2>
        {recent.length === 0 ? (
          <p className="font-source-serif-4 text-sm text-text-tertiary">
            No sends yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {recent.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-border-subtle bg-bg-surface p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-fraunces text-base text-text-primary">
                    {r.title}
                  </h3>
                  <div className="flex items-center gap-2 font-dm-mono text-xs text-text-tertiary">
                    <Badge variant="neutral">
                      {r.target_type}
                      {r.target_value ? ` · @${r.target_value}` : ''}
                    </Badge>
                    <span>{r.recipient_count} recipients</span>
                    <span>{formatRelativeDate(r.sent_at)}</span>
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

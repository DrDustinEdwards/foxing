import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { formatRelativeDate } from '@foxing/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { getAuthedUserId } from '@/lib/nav-user'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/cn'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Notifications · Foxing',
  robots: { index: false, follow: false },
}

interface NotificationRow {
  id: string
  type: string
  title: string
  body: string | null
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

export default async function NotificationsPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')

  const sb = createClient()
  const { data } = await sb
    .from('notifications')
    .select('id, type, title, body, data, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  const items = (data as NotificationRow[] | null) ?? []

  if (items.some((n) => !n.is_read)) {
    await sb
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
  }

  return (
    <PageWrapper className="py-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Notifications
      </h1>
      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState heading="No notifications yet." />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {items.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </ul>
      )}
    </PageWrapper>
  )
}

function NotificationItem({ notification }: { notification: NotificationRow }) {
  const href = hrefFor(notification)
  const content = (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-border-subtle p-4 transition-colors',
        notification.is_read ? 'bg-bg-surface' : 'bg-brand-subtle/30',
      )}
    >
      <span className="mt-0.5 text-lg" aria-hidden="true">
        {iconFor(notification.type)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-dm-sans text-sm font-medium text-text-primary">
          {notification.title}
        </p>
        {notification.body && (
          <p className="font-dm-sans text-sm text-text-secondary">
            {notification.body}
          </p>
        )}
        <time className="font-dm-mono text-[11px] text-text-tertiary">
          {formatRelativeDate(notification.created_at)}
        </time>
      </div>
    </div>
  )
  if (!href) {
    return <li>{content}</li>
  }
  return (
    <li>
      <a href={href} className="block">
        {content}
      </a>
    </li>
  )
}

function iconFor(type: string): string {
  const t = type.toLowerCase()
  if (t.includes('follow')) return '👤'
  if (t.includes('club')) return '📚'
  if (t.includes('book')) return '📖'
  if (t.includes('highlight')) return '✦'
  if (t.includes('badge') || t.includes('achievement')) return '🏆'
  if (t.includes('buddy')) return '🤝'
  return '•'
}

function hrefFor(n: NotificationRow): string | null {
  const data = n.data ?? {}
  if (typeof data.href === 'string') return data.href
  if (typeof data.book_slug === 'string') return `/book/${data.book_slug}`
  if (typeof data.book_id === 'string') return `/book/${data.book_id}`
  if (typeof data.club_slug === 'string') return `/clubs/${data.club_slug}`
  if (typeof data.club_id === 'string') return `/clubs/${data.club_id}`
  if (typeof data.username === 'string') return `/u/${data.username}`
  return null
}

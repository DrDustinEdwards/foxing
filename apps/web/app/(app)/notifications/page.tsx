import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { formatRelativeDate } from '@foxing/utils'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { getAuthedUserId } from '@/lib/nav-user'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/cn'
import { MarkAllReadButton } from './mark-all-read-button'

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
  is_read: boolean | null
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
    .limit(50)
  const items = (data as NotificationRow[] | null) ?? []
  const unreadCount = items.filter((n) => !n.is_read).length

  // Auto-mark all read on inbox open.
  if (unreadCount > 0) {
    await sb
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
  }

  return (
    <PageWrapper className="py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-fraunces text-[2rem] text-text-primary">
          Notifications
        </h1>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>
      {items.length === 0 ? (
        <p className="mt-10 max-w-prose font-source-serif-4 text-base text-text-tertiary">
          Nothing here yet. When club members post or events are scheduled,
          they will show up here.
        </p>
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
  const wasUnread = !notification.is_read
  const content = (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4 transition-colors',
        wasUnread && 'border-l-[3px] border-l-brand-ui',
      )}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 text-text-secondary"
      >
        <NotificationIcon type={notification.type} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-fraunces text-base text-text-primary">
          {notification.title}
        </p>
        {notification.body && (
          <p className="line-clamp-2 font-source-serif-4 text-sm text-text-secondary">
            {notification.body}
          </p>
        )}
        <time className="font-dm-mono text-xs text-text-tertiary">
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

function NotificationIcon({ type }: { type: string }) {
  const t = type.toLowerCase()
  if (t.includes('event') || t.includes('meeting')) return <CalendarIcon />
  if (t.includes('announcement') || t.includes('poll')) return <MegaphoneIcon />
  if (t.includes('follow')) return <PersonIcon />
  return <BellIcon />
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

function CalendarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function MegaphoneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 11v2a2 2 0 0 0 2 2h2l6 4V5L7 9H5a2 2 0 0 0-2 2z" />
      <path d="M16 8a4 4 0 0 1 0 8" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

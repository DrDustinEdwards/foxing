import Image from 'next/image'
import Link from 'next/link'
import { formatRelativeDate } from '@foxing/utils'
import type { ClubAnnouncement } from '@/lib/club-announcements'
import { RemoveAnnouncementButton } from './remove-announcement-button'

function formatEventDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function AnnouncementsSection({
  clubId,
  announcements,
  canModerate,
}: {
  clubId: string
  announcements: ClubAnnouncement[]
  canModerate: boolean
}) {
  if (announcements.length === 0) return null
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        Announcements
      </h2>
      <div className="flex flex-col gap-4">
        {announcements.map((a) => (
          <AnnouncementCard
            key={a.id}
            clubId={clubId}
            announcement={a}
            canModerate={canModerate}
          />
        ))}
      </div>
    </section>
  )
}

function AnnouncementCard({
  clubId,
  announcement: a,
  canModerate,
}: {
  clubId: string
  announcement: ClubAnnouncement
  canModerate: boolean
}) {
  const isEvent = Boolean(a.event_date)
  const location = [
    a.event_location,
    [a.event_city, a.event_state].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {a.is_pinned && (
            <span className="font-dm-mono text-[10px] uppercase tracking-wider text-text-tertiary">
              Pinned
            </span>
          )}
          {isEvent && a.event_date && (
            <span className="rounded-md bg-brand-subtle px-2 py-1 font-dm-mono text-[11px] uppercase tracking-wider text-brand-subtle-text">
              {formatEventDate(a.event_date)}
            </span>
          )}
        </div>
        {canModerate && (
          <RemoveAnnouncementButton id={a.id} clubId={clubId} />
        )}
      </div>
      <h3 className="font-fraunces text-[1.0625rem] text-text-primary">
        {a.title}
      </h3>
      {a.body && (
        <p className="line-clamp-3 whitespace-pre-line font-source-serif-4 text-[0.9375rem] text-text-secondary">
          {a.body}
        </p>
      )}
      {isEvent && location && (
        <p className="font-dm-sans text-sm text-text-secondary">{location}</p>
      )}
      {a.book && (
        <Link
          href={`/book/${a.book.slug ?? a.book.id}`}
          className="mt-1 flex items-center gap-3 rounded-md border border-border-subtle bg-bg-sunken p-2 hover:border-border-interactive"
        >
          <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-sm bg-bg-surface">
            {a.book.cover_url && (
              <Image
                src={a.book.cover_url}
                alt=""
                fill
                sizes="36px"
                className="object-cover"
              />
            )}
          </span>
          <span className="flex flex-col">
            <span className="font-fraunces text-sm text-text-primary">
              {a.book.title}
            </span>
            <span className="font-dm-sans text-xs text-text-tertiary">
              {a.book.author}
            </span>
          </span>
        </Link>
      )}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 font-dm-mono text-xs text-text-tertiary">
        <span>
          {a.created_by_profile?.display_name ?? 'Moderator'} ·{' '}
          {formatRelativeDate(a.created_at)}
        </span>
        {isEvent && (
          <a
            href={`/events/calendar/${a.id}`}
            className="text-brand-text hover:underline"
          >
            Add to calendar
          </a>
        )}
      </div>
    </article>
  )
}

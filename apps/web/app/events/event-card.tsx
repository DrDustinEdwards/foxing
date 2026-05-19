import Image from 'next/image'
import Link from 'next/link'
import type { PublicEvent } from '@/lib/events'
import { formatEventDateTime } from '@/lib/events'

export function EventCard({ event }: { event: PublicEvent }) {
  const cityState = [event.event_city, event.event_state]
    .filter(Boolean)
    .join(', ')
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-md bg-brand-subtle px-2 py-1 font-dm-mono text-[11px] uppercase tracking-wider text-brand-subtle-text">
          {formatEventDateTime(event.event_date)}
        </span>
        {event.club?.is_verified && event.club.club_type === 'bookstore' && (
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-dm-mono text-[10px] uppercase tracking-wider"
            style={{
              backgroundColor: 'var(--brand-ui)',
              color: 'var(--text-on-brand)',
            }}
          >
            Verified
          </span>
        )}
      </div>
      <h3 className="font-fraunces text-xl text-text-primary">{event.title}</h3>
      {event.club && (
        <Link
          href={`/clubs/${event.club.slug ?? event.club.id}`}
          className="font-dm-sans text-sm text-brand-text hover:underline"
        >
          {event.club.name}
        </Link>
      )}
      {cityState && (
        <p className="font-dm-sans text-sm text-text-secondary">{cityState}</p>
      )}
      {event.event_location && (
        <p className="font-dm-sans text-sm text-text-tertiary">
          {event.event_location}
        </p>
      )}
      {event.book && (
        <Link
          href={`/book/${event.book.slug ?? event.book.id}`}
          className="mt-1 flex items-center gap-3 rounded-md border border-border-subtle bg-bg-sunken p-2 hover:border-border-interactive"
        >
          <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-bg-surface">
            {event.book.cover_url && (
              <Image
                src={event.book.cover_url}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
              />
            )}
          </span>
          <span className="flex flex-col">
            <span className="font-fraunces text-sm text-text-primary">
              {event.book.title}
            </span>
            <span className="font-dm-sans text-xs text-text-tertiary">
              {event.book.author}
            </span>
          </span>
        </Link>
      )}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 font-dm-mono text-xs">
        <a
          href={`/events/calendar/${event.id}`}
          className="text-brand-text hover:underline"
        >
          Add to calendar
        </a>
        {event.club && (
          <Link
            href={`/clubs/${event.club.slug ?? event.club.id}`}
            className="text-text-tertiary hover:text-text-primary"
          >
            View club
          </Link>
        )}
      </div>
    </article>
  )
}

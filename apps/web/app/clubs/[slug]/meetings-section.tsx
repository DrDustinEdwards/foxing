import Image from 'next/image'
import Link from 'next/link'
import type { ClubMeeting } from '@/lib/club-meetings'
import { formatMeetingDate } from '@/lib/club-meetings'
import { CreateMeetingForm } from './create-meeting-form'
import { RsvpButtons } from './rsvp-buttons'
import { CancelMeetingButton } from './cancel-meeting-button'

interface Props {
  clubId: string
  clubSlug: string
  meetings: ClubMeeting[]
  canModerate: boolean
  isMember: boolean
  defaultCity: string | null
  defaultState: string | null
}

const TYPE_LABEL: Record<string, string> = {
  in_person: 'In person',
  virtual: 'Virtual',
  hybrid: 'Hybrid',
}

export function MeetingsSection({
  clubId,
  clubSlug,
  meetings,
  canModerate,
  isMember,
  defaultCity,
  defaultState,
}: Props) {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Meetings
        </h2>
      </div>
      {meetings.length === 0 ? (
        <p className="mt-3 font-source-serif-4 text-sm text-text-tertiary">
          No meetings scheduled yet.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {meetings.map((m) => (
            <li key={m.id}>
              <MeetingCard
                meeting={m}
                clubId={clubId}
                clubSlug={clubSlug}
                canModerate={canModerate}
                canRsvp={isMember}
              />
            </li>
          ))}
        </ul>
      )}
      {canModerate && (
        <div className="mt-6">
          <CreateMeetingForm
            clubId={clubId}
            defaultCity={defaultCity}
            defaultState={defaultState}
          />
        </div>
      )}
    </section>
  )
}

function MeetingCard({
  meeting: m,
  clubId,
  clubSlug,
  canModerate,
  canRsvp,
}: {
  meeting: ClubMeeting
  clubId: string
  clubSlug: string
  canModerate: boolean
  canRsvp: boolean
}) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="rounded-md bg-brand-subtle px-2 py-1 font-dm-mono text-[11px] uppercase tracking-wider text-brand-subtle-text">
          {formatMeetingDate(m.meeting_date)}
        </span>
        <span className="font-dm-mono text-[10px] uppercase tracking-wider text-text-tertiary">
          {TYPE_LABEL[m.meeting_type] ?? m.meeting_type}
        </span>
      </div>
      <h3 className="font-fraunces text-lg text-text-primary">{m.title}</h3>
      {m.description && (
        <p className="line-clamp-2 font-source-serif-4 text-[0.9375rem] text-text-secondary">
          {m.description}
        </p>
      )}
      {(m.location_name || m.location_address) && (
        <p className="font-dm-sans text-sm text-text-secondary">
          {[m.location_name, m.location_address].filter(Boolean).join(' · ')}
        </p>
      )}
      {m.location_url && m.meeting_type !== 'in_person' && (
        <a
          href={m.location_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-dm-sans text-sm text-brand-text hover:underline"
        >
          Join link
        </a>
      )}
      {m.book && (
        <Link
          href={`/book/${m.book.slug ?? m.book.id}`}
          className="flex items-center gap-3 rounded-md border border-border-subtle bg-bg-sunken p-2 hover:border-border-interactive"
        >
          <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded-sm bg-bg-surface">
            {m.book.cover_url && (
              <Image
                src={m.book.cover_url}
                alt=""
                fill
                sizes="32px"
                className="object-cover"
              />
            )}
          </span>
          <span className="flex flex-col">
            <span className="font-fraunces text-sm text-text-primary">
              {m.book.title}
            </span>
            <span className="font-dm-sans text-xs text-text-tertiary">
              {m.book.author}
            </span>
          </span>
        </Link>
      )}
      <p className="font-dm-mono text-xs text-text-tertiary">
        Going ({m.rsvp_counts.going}) · Maybe ({m.rsvp_counts.maybe}) · Not
        going ({m.rsvp_counts.not_going})
      </p>
      {canRsvp && <RsvpButtons meetingId={m.id} current={m.user_rsvp} />}
      <div className="flex flex-wrap items-center justify-between gap-2 font-dm-mono text-xs text-text-tertiary">
        <a
          href={`/clubs/${clubSlug}/meetings/${m.id}/calendar`}
          className="text-brand-text hover:underline"
        >
          Add to calendar
        </a>
        {canModerate && (
          <CancelMeetingButton meetingId={m.id} clubId={clubId} />
        )}
      </div>
    </article>
  )
}

import Link from 'next/link'
import { formatRelativeDate } from '@foxing/utils'
import { Avatar } from '@/components/ui/avatar'
import {
  DISCUSSION_TYPE_CLASSES,
  type DiscussionSummary,
} from '@/lib/discussions'
import { CreateDiscussionForm } from './create-discussion-form'

interface Props {
  bookId: string
  bookSlug: string | null
  discussions: DiscussionSummary[]
  canStart: boolean
}

export function DiscussionsSection({
  bookId,
  bookSlug,
  discussions,
  canStart,
}: Props) {
  return (
    <section className="mt-10 border-t border-border-subtle pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-fraunces text-xl text-text-primary">
            Discussions
          </h2>
          <p className="font-source-serif-4 text-sm text-text-tertiary">
            {discussions.length === 0
              ? 'No discussions yet.'
              : `${discussions.length} discussion${discussions.length === 1 ? '' : 's'}`}
          </p>
        </div>
        {canStart && (
          <CreateDiscussionForm bookId={bookId} bookSlug={bookSlug} />
        )}
      </div>

      {discussions.length === 0 ? (
        <p className="mt-6 font-source-serif-4 text-base text-text-tertiary">
          {canStart
            ? 'Start the first one.'
            : 'Sign in to start the first one.'}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {discussions.map((d) => (
            <DiscussionCard key={d.id} discussion={d} bookSlug={bookSlug} />
          ))}
        </ul>
      )}
    </section>
  )
}

function DiscussionCard({
  discussion: d,
  bookSlug,
}: {
  discussion: DiscussionSummary
  bookSlug: string | null
}) {
  const typeClass = DISCUSSION_TYPE_CLASSES[d.type] ?? DISCUSSION_TYPE_CLASSES.general
  return (
    <li>
      <Link
        href={`/book/${bookSlug ?? ''}/discussions/${d.id}`}
        className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-4 hover:border-border-interactive"
      >
        <div className="flex flex-wrap items-center gap-2">
          {d.is_pinned && (
            <span className="font-dm-mono text-[10px] uppercase tracking-wider text-text-tertiary">
              Pinned
            </span>
          )}
          <span
            className={`rounded-md px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-wider ${typeClass}`}
          >
            {d.type.replace(/_/g, ' ')}
          </span>
          {d.spoiler_tagged && (
            <span className="rounded-md bg-bg-sunken px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-wider text-text-tertiary">
              Spoilers
            </span>
          )}
        </div>
        <p className="font-fraunces text-base text-text-primary">{d.title}</p>
        <div className="flex flex-wrap items-center gap-2 font-dm-mono text-xs text-text-tertiary">
          <Avatar
            src={d.author?.avatar_url ?? null}
            name={d.author?.display_name ?? '?'}
            size="sm"
          />
          <span>
            {d.author?.display_name ?? 'Reader'} started this discussion
          </span>
          <span>· {formatRelativeDate(d.created_at)}</span>
          {d.reply_count > 0 && (
            <span>
              · {d.reply_count} {d.reply_count === 1 ? 'reply' : 'replies'}
            </span>
          )}
          {d.reply_count > 0 && (
            <span>
              · Last reply {formatRelativeDate(d.last_activity_at)}
            </span>
          )}
        </div>
      </Link>
    </li>
  )
}

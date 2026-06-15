import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { formatRelativeDate } from '@foxing/utils'
import type { ClubThreadSummary } from '@/lib/club-threads'
import { ClubSectionHeader } from './club-section-header'
import { NewThreadForm } from './new-thread-form'

export function DiscussionsSection({
  clubId,
  clubSlug,
  threads,
  isMember,
}: {
  clubId: string
  clubSlug: string
  threads: ClubThreadSummary[]
  isMember: boolean
}) {
  return (
    <section>
      <ClubSectionHeader title="Discussions" />

      {isMember && (
        <div className="mb-5">
          <NewThreadForm clubId={clubId} clubSlug={clubSlug} />
        </div>
      )}

      {threads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-subtle bg-bg-surface p-8 text-center">
          <p className="font-source-serif-4 text-base text-text-secondary">
            No threads yet.
          </p>
          <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
            {isMember
              ? 'Start the first one and open the conversation.'
              : 'Join the club to start the conversation.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {threads.map((t) => (
            <li key={t.id}>
              <Link
                href={`/clubs/${clubSlug}/threads/${t.id}`}
                className="block rounded-lg border border-border-subtle bg-bg-surface p-4 transition-colors hover:border-border-interactive"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {t.is_pinned && (
                        <span className="rounded-full bg-brand-subtle px-2 py-0.5 font-dm-mono text-[0.625rem] uppercase tracking-wider text-brand-subtle-text">
                          Pinned
                        </span>
                      )}
                      {t.has_spoilers && (
                        <span className="rounded-full bg-bg-sunken px-2 py-0.5 font-dm-mono text-[0.625rem] uppercase tracking-wider text-text-tertiary">
                          Spoilers
                        </span>
                      )}
                      <h3 className="truncate font-fraunces text-base text-text-primary">
                        {t.title}
                      </h3>
                    </div>
                    {t.chapter && (
                      <p className="mt-0.5 font-dm-mono text-[0.6875rem] uppercase tracking-[0.15em] text-text-tertiary">
                        {t.chapter}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-dm-mono text-xs text-text-tertiary">
                    {t.post_count} {t.post_count === 1 ? 'post' : 'posts'}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Avatar
                    src={t.author?.avatar_url ?? null}
                    name={t.author?.display_name ?? 'Reader'}
                    size="sm"
                  />
                  <span className="font-dm-sans text-xs text-text-tertiary">
                    {t.author?.display_name ?? 'Reader'} · last activity{' '}
                    {formatRelativeDate(t.updated_at ?? t.created_at)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

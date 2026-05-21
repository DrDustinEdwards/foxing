import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { formatRelativeDate } from '@foxing/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchBookBySlug } from '@/lib/queries'
import { fetchBookDiscussions } from '@/lib/discussions'
import {
  DISCUSSION_TYPES,
  DISCUSSION_TYPE_CLASSES,
  type DiscussionType,
} from '@/lib/discussion-types'
import { getAuthedUserId } from '@/lib/nav-user'
import { FOXING_BASE_URL } from '@/lib/metadata'
import { CreateDiscussionForm } from '../create-discussion-form'

export const dynamic = 'force-dynamic'

const TYPE_LABEL = new Map<DiscussionType, string>(
  DISCUSSION_TYPES.map((t) => [t.value, t.label]),
)

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const book = await fetchBookBySlug(params.slug)
  if (!book) return { title: 'Discussions' }
  return {
    title: `${book.title} discussions · Foxing`,
    description: `Join the discussion about ${book.title} on Foxing.`,
    alternates: {
      canonical: `${FOXING_BASE_URL}/book/${params.slug}/discussions`,
    },
  }
}

export default async function BookDiscussionsIndexPage({
  params,
}: {
  params: { slug: string }
}) {
  const [viewerId, book] = await Promise.all([
    getAuthedUserId(),
    fetchBookBySlug(params.slug),
  ])
  if (!book) notFound()
  const discussions = await fetchBookDiscussions(book.id)
  const bookPath = book.slug ?? book.id

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <Link
            href={`/book/${bookPath}`}
            className="font-dm-sans text-sm text-brand-text hover:underline"
          >
            ← {book.title}
          </Link>
          <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                Discussions
              </p>
              <h1 className="font-fraunces text-[2rem] text-text-primary">
                {book.title}
              </h1>
              <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
                {discussions.length}{' '}
                {discussions.length === 1 ? 'discussion' : 'discussions'}
              </p>
            </div>
            {viewerId ? (
              <CreateDiscussionForm bookId={book.id} bookSlug={book.slug} />
            ) : (
              <Link
                href={`/sign-in?next=/book/${bookPath}/discussions`}
                className="font-dm-sans text-sm text-brand-text hover:underline"
              >
                Sign in to start a discussion
              </Link>
            )}
          </header>

          <section className="mt-8">
            {discussions.length === 0 ? (
              <p className="font-source-serif-4 text-base text-text-tertiary">
                No discussions yet. Start one.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {discussions.map((d) => {
                  const typeClass =
                    DISCUSSION_TYPE_CLASSES[d.type] ??
                    DISCUSSION_TYPE_CLASSES.general
                  const typeLabel = TYPE_LABEL.get(d.type) ?? d.type
                  return (
                    <li key={d.id}>
                      <Link
                        href={`/book/${bookPath}/discussions/${d.id}`}
                        className="block rounded-lg border border-border-subtle bg-bg-surface p-4 hover:bg-bg-hover"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-wider ${typeClass}`}
                          >
                            {typeLabel}
                          </span>
                          {d.is_pinned ? (
                            <Badge variant="info">Pinned</Badge>
                          ) : null}
                          {d.spoiler_tagged ? (
                            <Badge variant="warning">Spoilers</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 font-fraunces text-base text-text-primary">
                          {d.title}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {d.author ? (
                            <div className="flex items-center gap-2">
                              <Avatar
                                src={d.author.avatar_url}
                                name={d.author.display_name}
                                size="sm"
                              />
                              <span className="font-dm-sans text-xs text-text-tertiary">
                                {d.author.display_name} ·{' '}
                                {formatRelativeDate(d.last_activity_at)}
                              </span>
                            </div>
                          ) : (
                            <span className="font-dm-sans text-xs text-text-tertiary">
                              {formatRelativeDate(d.last_activity_at)}
                            </span>
                          )}
                          <span className="font-dm-mono text-xs text-text-tertiary">
                            {d.reply_count}{' '}
                            {d.reply_count === 1 ? 'reply' : 'replies'}
                          </span>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

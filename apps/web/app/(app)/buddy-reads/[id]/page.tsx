import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchBuddyReadById,
  fetchBuddyReadPosts,
  type BuddyRead,
  type BuddyReadPost,
} from '@/lib/missing-pages-queries'
import { BUDDY_READS_METADATA } from '@/lib/metadata'
import { getAuthedUserId } from '@/lib/nav-user'
import { PostForm } from './post-form'
import {
  DeletePostButton,
  FinishBuddyReadButton,
} from './post-actions-buttons'
import { SpoilerContent } from './spoiler-content'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = BUDDY_READS_METADATA

export default async function BuddyReadPage(
  props: {
    params: Promise<{ id: string }>
  }
) {
  const params = await props.params;
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const buddyRead = await fetchBuddyReadById(params.id, userId)
  if (!buddyRead) notFound()
  const posts = await fetchBuddyReadPosts(buddyRead.id)

  return (
    <PageWrapper className="py-10">
      <Link
        href="/buddy-reads"
        className="font-dm-sans text-sm text-text-tertiary hover:text-text-primary"
      >
        ← Buddy reads
      </Link>
      <BuddyReadHeader buddyRead={buddyRead} />
      {buddyRead.is_active && (
        <div className="mt-6 flex justify-end">
          <FinishBuddyReadButton buddyReadId={buddyRead.id} />
        </div>
      )}
      <PostList posts={posts} viewerId={userId} buddyReadId={buddyRead.id} />
      {buddyRead.is_active && <PostForm buddyReadId={buddyRead.id} />}
    </PageWrapper>
  )
}

function BuddyReadHeader({ buddyRead }: { buddyRead: BuddyRead }) {
  return (
    <header className="mt-6 flex flex-col gap-5 md:flex-row md:items-start">
      {buddyRead.book && (
        <Link
          href={`/book/${buddyRead.book.slug ?? buddyRead.book.id}`}
          className="relative h-40 w-28 shrink-0 overflow-hidden rounded bg-bg-sunken shadow-sm"
        >
          {buddyRead.book.cover_url && (
            <Image
              src={buddyRead.book.cover_url}
              alt={buddyRead.book.title}
              fill
              sizes="112px"
              className="object-cover"
            />
          )}
        </Link>
      )}
      <div className="flex flex-col gap-2">
        <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Buddy read
        </p>
        <h1 className="font-fraunces text-[1.75rem] text-text-primary">
          {buddyRead.book?.title ?? 'Buddy read'}
        </h1>
        {buddyRead.book?.author && (
          <p className="font-dm-sans text-sm text-text-tertiary">
            {buddyRead.book.author}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-4">
          {buddyRead.user1 && (
            <PersonChip person={buddyRead.user1} />
          )}
          {buddyRead.user2 && (
            <PersonChip person={buddyRead.user2} />
          )}
        </div>
        {buddyRead.started_at && (
          <p className="font-dm-mono text-[11px] text-text-tertiary">
            Started {new Date(buddyRead.started_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </header>
  )
}

function PersonChip({
  person,
}: {
  person: NonNullable<BuddyRead['user1']>
}) {
  return (
    <Link
      href={`/u/${person.username}`}
      className="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-3 py-1.5"
    >
      <Avatar src={person.avatar_url} name={person.display_name} size="sm" />
      <span className="font-dm-sans text-sm text-text-primary">
        {person.display_name}
      </span>
    </Link>
  )
}

function PostList({
  posts,
  viewerId,
  buddyReadId,
}: {
  posts: BuddyReadPost[]
  viewerId: string
  buddyReadId: string
}) {
  if (posts.length === 0) {
    return (
      <div className="mt-10 rounded-lg border border-border-subtle bg-bg-surface p-6 text-center">
        <p className="font-source-serif-4 text-base text-text-tertiary">
          No posts yet. Start a discussion when one of you finishes a chapter.
        </p>
      </div>
    )
  }
  return (
    <ol className="mt-10 flex flex-col gap-4">
      {posts.map((p) => (
        <li
          key={p.id}
          className="flex gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
        >
          <Avatar
            src={p.author?.avatar_url ?? null}
            name={p.author?.display_name ?? '?'}
            size="sm"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-dm-sans text-sm font-medium text-text-primary">
                  {p.author?.display_name ?? 'Reader'}
                </span>
                <time className="font-dm-mono text-[11px] text-text-tertiary">
                  {new Date(p.created_at).toLocaleString()}
                </time>
                {p.page_number && (
                  <Badge variant="neutral">p. {p.page_number}</Badge>
                )}
                {p.chapter && <Badge variant="neutral">{p.chapter}</Badge>}
                {p.has_spoiler && <Badge variant="warning">Spoiler</Badge>}
              </div>
              {p.author_id === viewerId && (
                <DeletePostButton postId={p.id} buddyReadId={buddyReadId} />
              )}
            </div>
            {p.has_spoiler ? (
              <SpoilerContent>{p.content}</SpoilerContent>
            ) : (
              <p className="whitespace-pre-line font-source-serif-4 text-sm text-text-primary">
                {p.content}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

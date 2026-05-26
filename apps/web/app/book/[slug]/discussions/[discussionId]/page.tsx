import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { formatRelativeDate } from '@foxing/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  DISCUSSION_TYPE_CLASSES,
  fetchDiscussion,
  fetchDiscussionPosts,
  fetchReactionsForPosts,
  type DiscussionPost,
} from '@/lib/discussions'
import { fetchBookBySlug } from '@/lib/queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { FOXING_BASE_URL } from '@/lib/metadata'
import { ReactionButtons } from './reaction-buttons'
import { ReplyForm } from './reply-form'
import { PostEditDeleteButtons } from './post-edit-delete-buttons'
import { SpoilerText } from './spoiler-text'

export const dynamic = 'force-dynamic'

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string; discussionId: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const discussion = await fetchDiscussion(params.discussionId)
  if (!discussion) return { title: 'Discussion not found' }
  return {
    title: `${discussion.title} · Foxing`,
    alternates: {
      canonical: `${FOXING_BASE_URL}/book/${params.slug}/discussions/${params.discussionId}`,
    },
    robots: { index: false, follow: true },
  }
}

export default async function DiscussionPage(
  props: {
    params: Promise<{ slug: string; discussionId: string }>
  }
) {
  const params = await props.params;
  const [viewerId, discussion] = await Promise.all([
    getAuthedUserId(),
    fetchDiscussion(params.discussionId),
  ])
  if (!discussion) notFound()

  const book = await fetchBookBySlug(params.slug)
  if (!book || book.id !== discussion.book_id) notFound()

  const posts = await fetchDiscussionPosts(discussion.id)
  const reactions = await fetchReactionsForPosts(posts.map((p) => p.id))
  const typeClass =
    DISCUSSION_TYPE_CLASSES[discussion.type] ?? DISCUSSION_TYPE_CLASSES.general
  const bookPath = book.slug ?? book.id

  const topLevel = posts.filter((p) => !p.parent_id)
  const repliesByParent = new Map<string, DiscussionPost[]>()
  for (const p of posts) {
    if (!p.parent_id) continue
    const list = repliesByParent.get(p.parent_id) ?? []
    list.push(p)
    repliesByParent.set(p.parent_id, list)
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <Link
            href={`/book/${bookPath}`}
            className="font-dm-sans text-sm text-text-tertiary hover:text-text-primary"
          >
            ← {book.title}
          </Link>

          <header className="mt-4 flex flex-col gap-3">
            <div className="flex items-start gap-4">
              <Link
                href={`/book/${bookPath}`}
                className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-bg-sunken"
              >
                {book.cover_url && (
                  <Image
                    src={book.cover_url}
                    alt={book.title}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                )}
              </Link>
              <div className="flex flex-col gap-2">
                <h1 className="font-fraunces text-[1.75rem] text-text-primary">
                  {discussion.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-wider ${typeClass}`}
                  >
                    {discussion.type.replace(/_/g, ' ')}
                  </span>
                  {discussion.spoiler_tagged && (
                    <Badge variant="warning">Spoilers</Badge>
                  )}
                  {discussion.chapter_gate && (
                    <span className="font-dm-mono text-[11px] text-text-tertiary">
                      {discussion.chapter_gate}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 font-dm-mono text-xs text-text-tertiary">
                  <Avatar
                    src={discussion.author?.avatar_url ?? null}
                    name={discussion.author?.display_name ?? '?'}
                    size="sm"
                  />
                  <span>
                    Started by {discussion.author?.display_name ?? 'Reader'} ·{' '}
                    {formatRelativeDate(discussion.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </header>

          <ol className="mt-8 flex flex-col gap-4">
            {topLevel.map((post) => (
              <li key={post.id}>
                <PostCard
                  post={post}
                  viewerId={viewerId}
                  bookSlug={bookPath}
                  discussionId={discussion.id}
                  reactions={reactions.get(post.id) ?? []}
                />
                {(repliesByParent.get(post.id) ?? []).length > 0 && (
                  <ol className="mt-3 flex flex-col gap-3 pl-8">
                    {(repliesByParent.get(post.id) ?? []).map((reply) => (
                      <li key={reply.id}>
                        <PostCard
                          post={reply}
                          viewerId={viewerId}
                          bookSlug={bookPath}
                          discussionId={discussion.id}
                          reactions={reactions.get(reply.id) ?? []}
                          isReply
                        />
                      </li>
                    ))}
                  </ol>
                )}
                {viewerId && !post.parent_id && (
                  <div className="pl-8">
                    <ReplyForm
                      discussionId={discussion.id}
                      bookSlug={bookPath}
                      parentId={post.id}
                      compact
                    />
                  </div>
                )}
              </li>
            ))}
          </ol>

          <div className="mt-10">
            {viewerId ? (
              <ReplyForm discussionId={discussion.id} bookSlug={bookPath} />
            ) : (
              <p className="rounded-lg border border-border-subtle bg-bg-surface p-4 text-center font-dm-sans text-sm text-text-secondary">
                <Link href="/sign-in" className="text-brand-text hover:underline">
                  Sign in
                </Link>{' '}
                to join this discussion.
              </p>
            )}
          </div>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  );
}

function PostCard({
  post,
  viewerId,
  bookSlug,
  discussionId,
  reactions,
  isReply,
}: {
  post: DiscussionPost
  viewerId: string | null
  bookSlug: string
  discussionId: string
  reactions: { reaction: string; count: number; users: string[] }[]
  isReply?: boolean
}) {
  const isOwn = viewerId !== null && post.author_id === viewerId
  return (
    <article className="flex gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <Avatar
        src={post.author?.avatar_url ?? null}
        name={post.author?.display_name ?? '?'}
        size={isReply ? 'sm' : 'md'}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-dm-sans text-sm font-medium text-text-primary">
              {post.author?.display_name ?? 'Reader'}
            </span>
            <time className="font-dm-mono text-[11px] text-text-tertiary">
              {formatRelativeDate(post.created_at)}
              {post.is_edited && ' · edited'}
            </time>
            {post.has_spoiler && <Badge variant="warning">Spoiler</Badge>}
          </div>
          {isOwn && (
            <PostEditDeleteButtons
              postId={post.id}
              content={post.content}
              bookSlug={bookSlug}
              discussionId={discussionId}
            />
          )}
        </div>
        {post.has_spoiler ? (
          <SpoilerText>{post.content}</SpoilerText>
        ) : (
          <p className="whitespace-pre-line font-source-serif-4 text-base text-text-primary">
            {post.content}
          </p>
        )}
        <ReactionButtons
          postId={post.id}
          bookSlug={bookSlug}
          discussionId={discussionId}
          viewerId={viewerId}
          reactions={reactions}
        />
      </div>
    </article>
  )
}

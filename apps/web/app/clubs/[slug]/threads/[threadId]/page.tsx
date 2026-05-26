import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchPublicClubBySlug } from '@/lib/queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { fetchClubThread } from '@/lib/club-threads'
import { fetchDiscussionGuide } from '@/lib/discussion-guide'
import { getClubRole, isClubMod } from '@/lib/club-membership'
import { ThreadDiscussionPanel } from '../../thread-discussion-panel'
import { ThreadPostActions } from './thread-post-actions'
import { ReplyForm } from './reply-form'

export const dynamic = 'force-dynamic'

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string; threadId: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  return {
    title: `Thread · ${params.slug} · Foxing`,
    robots: { index: false, follow: false },
  }
}

export default async function ThreadPage(
  props: {
    params: Promise<{ slug: string; threadId: string }>
  }
) {
  const params = await props.params;
  const [viewerId, club] = await Promise.all([
    getAuthedUserId(),
    fetchPublicClubBySlug(params.slug),
  ])
  if (!club) notFound()
  if (!viewerId) redirect(`/sign-in?next=/clubs/${params.slug}/threads/${params.threadId}`)
  const data = await fetchClubThread(club.id, params.threadId)
  if (!data) notFound()
  const { thread, posts, savedSet } = data

  const [discussionGuide, role] = await Promise.all([
    club.current_book_id
      ? fetchDiscussionGuide(club.current_book_id)
      : Promise.resolve(null),
    getClubRole(club.id, viewerId),
  ])
  const canGenerate = isClubMod(role)

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <Link
            href={`/clubs/${params.slug}`}
            className="font-dm-sans text-sm text-brand-text hover:underline"
          >
            ← {club.name}
          </Link>
          <header className="mt-3 flex flex-col gap-1">
            <h1 className="font-fraunces text-[1.75rem] text-text-primary">
              {thread.title ?? 'Thread'}
            </h1>
            <p className="font-dm-mono text-xs text-text-tertiary">
              Started {formatTime(thread.created_at)} · {posts.length}{' '}
              {posts.length === 1 ? 'post' : 'posts'}
            </p>
          </header>

          {club.current_book_id && club.current_book ? (
            <ThreadDiscussionPanel
              bookId={club.current_book_id}
              bookSlug={club.current_book.slug}
              bookTitle={club.current_book.title}
              initialQuestions={discussionGuide?.questions ?? null}
              canGenerate={canGenerate}
            />
          ) : null}

          <ul className="mt-6 flex flex-col gap-4">
            {posts.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-border-subtle bg-bg-surface p-4"
              >
                <header className="flex items-start gap-3">
                  <Avatar
                    src={p.author?.avatar_url ?? null}
                    name={p.author?.display_name ?? 'Reader'}
                    size="sm"
                  />
                  <div className="flex flex-col leading-tight">
                    <span className="font-dm-sans text-sm text-text-primary">
                      {p.author?.display_name ?? 'Reader'}
                    </span>
                    <time className="font-dm-mono text-xs text-text-tertiary">
                      {formatTime(p.created_at)}
                      {p.updated_at &&
                        p.updated_at !== p.created_at &&
                        ' · edited'}
                    </time>
                  </div>
                </header>
                <p className="mt-3 whitespace-pre-line font-source-serif-4 text-base text-text-primary">
                  {p.content}
                </p>
                <ThreadPostActions
                  postId={p.id}
                  threadId={thread.id}
                  isOwn={p.author_id === viewerId}
                  initialSaved={savedSet.has(p.id)}
                  initialContent={p.content}
                />
              </li>
            ))}
          </ul>

          <section className="mt-8">
            <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
              Reply
            </h2>
            <ReplyForm threadId={thread.id} />
          </section>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

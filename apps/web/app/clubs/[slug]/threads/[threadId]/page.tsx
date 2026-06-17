import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchPublicClubBySlug } from '@/lib/queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { fetchClubThread } from '@/lib/club-threads'
import { fetchDiscussionGuide } from '@/lib/discussion-guide'
import { getClubRole, isClubMod } from '@/lib/club-membership'
import { createAdminClient } from '@/lib/supabase/admin'
import { ThreadDiscussionPanel } from '../../thread-discussion-panel'
import { ThreadPosts } from './thread-posts'
import { ReplyForm } from './reply-form'
import { LockedChapterGate } from './locked-chapter-gate'

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
  const { thread, posts, savedSet, likedSet } = data

  const [discussionGuide, role] = await Promise.all([
    club.current_book_id
      ? fetchDiscussionGuide(club.current_book_id)
      : Promise.resolve(null),
    getClubRole(club.id, viewerId),
  ])
  const canGenerate = isClubMod(role)

  // Chapter gating: if this thread's chapter is on the schedule with a future
  // unlock, blur it for regular members (author + mods always see it).
  const chapterNorm = thread.chapter?.trim().toLowerCase()
  let lockedUntil: string | null = null
  if (chapterNorm && !isClubMod(role) && thread.author_id !== viewerId) {
    const admin = createAdminClient()
    const { data: scheduleRows } = await admin
      .from('club_schedule')
      .select('chapter_name, unlock_date')
      .eq('club_id', club.id)
    const match = (
      (scheduleRows as { chapter_name: string; unlock_date: string }[] | null) ??
      []
    ).find(
      (r) =>
        r.chapter_name.trim().toLowerCase() === chapterNorm &&
        new Date(r.unlock_date).getTime() > Date.now(),
    )
    lockedUntil = match?.unlock_date ?? null
  }

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

          <div className="mt-6">
            {lockedUntil ? (
              <LockedChapterGate unlockLabel={formatTime(lockedUntil)}>
                <ThreadPosts
                  posts={posts}
                  threadId={thread.id}
                  viewerId={viewerId}
                  savedSet={savedSet}
                  likedSet={likedSet}
                />
              </LockedChapterGate>
            ) : (
              <ThreadPosts
                posts={posts}
                threadId={thread.id}
                viewerId={viewerId}
                savedSet={savedSet}
                likedSet={likedSet}
              />
            )}
          </div>

          <section className="mt-8">
            <h2 className="mb-3 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
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

import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { formatRelativeDate } from '@foxing/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { getAuthedUserId } from '@/lib/nav-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { UnsaveButton } from './unsave-button'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Saved posts · Foxing',
  robots: { index: false, follow: false },
}

interface SavedPostRow {
  post_id: string
  saved_at: string
  post: {
    id: string
    content: string
    created_at: string
    has_spoiler: boolean | null
    is_removed: boolean | null
    thread: {
      id: string
      title: string
      club: { id: string; name: string; slug: string | null } | null
    } | null
    author: {
      username: string
      display_name: string
      avatar_url: string | null
    } | null
  } | null
}

export default async function SavedPostsPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')

  const admin = createAdminClient()
  const { data } = await admin
    .from('saved_posts')
    .select(
      'post_id, saved_at, post:post_id(id, content, created_at, has_spoiler, is_removed, thread:thread_id(id, title, club:club_id(id, name, slug)), author:author_id(username, display_name, avatar_url))',
    )
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })
    .limit(50)
  const rows = ((data as unknown as SavedPostRow[] | null) ?? []).filter(
    (r) => r.post && !r.post.is_removed,
  )

  return (
    <PageWrapper className="py-10">
      <PageHeader title="Saved Posts" />
      {rows.length === 0 ? (
        <p className="mt-10 max-w-prose font-source-serif-4 text-base text-text-tertiary">
          No saved posts yet. Bookmark posts in your clubs to find them here.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {rows.map((r) => {
            const post = r.post!
            const club = post.thread?.club
            const clubPath = club?.slug ?? club?.id
            return (
              <li
                key={r.post_id}
                className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
              >
                <header className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={post.author?.avatar_url ?? null}
                      name={post.author?.display_name ?? '?'}
                      size="sm"
                    />
                    <div className="flex flex-col leading-tight">
                      <span className="font-dm-sans text-sm text-text-primary">
                        {post.author?.display_name ?? 'Reader'}
                      </span>
                      <span className="font-dm-mono text-xs text-text-tertiary">
                        Saved {formatRelativeDate(r.saved_at)}
                      </span>
                    </div>
                  </div>
                  <UnsaveButton postId={r.post_id} />
                </header>
                {post.has_spoiler ? (
                  <Badge variant="warning">Spoiler hidden</Badge>
                ) : (
                  <p className="line-clamp-3 whitespace-pre-line font-source-serif-4 text-sm text-text-secondary">
                    {post.content}
                  </p>
                )}
                {club && (
                  <p className="font-dm-mono text-xs text-text-tertiary">
                    In{' '}
                    <Link
                      href={`/clubs/${clubPath}`}
                      className="text-brand-text hover:underline"
                    >
                      {club.name}
                    </Link>
                    {post.thread?.title && ` · ${post.thread.title}`}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </PageWrapper>
  )
}

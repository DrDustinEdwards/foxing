import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatRelativeDate } from '@foxing/utils'
import { DeletePostButton } from './delete-post-button'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Club posts · Admin · Foxing',
}

interface PostRow {
  id: string
  content: string
  has_spoiler: boolean | null
  created_at: string
  thread_id: string
  profiles: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
  club_threads: { title: string } | null
}

export default async function AdminClubPostsPage({
  params,
}: {
  params: { id: string }
}) {
  const admin = createAdminClient()
  const { data: club } = await admin
    .from('clubs')
    .select('id, name')
    .eq('id', params.id)
    .maybeSingle()
  if (!club) notFound()

  const { data: threads } = await admin
    .from('club_threads')
    .select('id')
    .eq('club_id', params.id)
  const threadIds = ((threads as { id: string }[] | null) ?? []).map(
    (t) => t.id,
  )

  let posts: PostRow[] = []
  if (threadIds.length > 0) {
    const { data } = await admin
      .from('club_posts')
      .select(
        'id, content, has_spoiler, created_at, thread_id, profiles:author_id(username, display_name, avatar_url), club_threads:thread_id(title)',
      )
      .in('thread_id', threadIds)
      .order('created_at', { ascending: false })
      .limit(200)
    posts = (data as unknown as PostRow[] | null) ?? []
  }

  const clubName = (club as { name: string }).name

  return (
    <div className="p-6 md:p-10">
      <p className="mb-4 font-dm-sans text-sm">
        <Link href="/admin/clubs" className="text-brand-text hover:underline">
          ← All clubs
        </Link>
      </p>

      <h1 className="font-fraunces text-[2rem] text-text-primary">
        {clubName}
      </h1>
      <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
        {posts.length} recent posts
      </p>

      {posts.length === 0 ? (
        <p className="mt-10 font-source-serif-4 text-sm text-text-tertiary">
          No posts in this club yet.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {posts.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-border-subtle bg-bg-surface p-4"
            >
              <header className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={p.profiles?.avatar_url}
                    name={p.profiles?.display_name ?? 'Reader'}
                    size="sm"
                  />
                  <div className="flex flex-col leading-tight">
                    <span className="font-dm-sans text-sm text-text-primary">
                      {p.profiles?.display_name ?? 'Reader'}
                    </span>
                    <span className="font-dm-mono text-xs text-text-tertiary">
                      @{p.profiles?.username ?? 'unknown'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-dm-mono text-xs text-text-tertiary">
                  {p.club_threads?.title && (
                    <Badge variant="neutral">{p.club_threads.title}</Badge>
                  )}
                  {p.has_spoiler && <Badge variant="warning">Spoiler</Badge>}
                  <span>{formatRelativeDate(p.created_at)}</span>
                </div>
              </header>
              <p className="mt-3 whitespace-pre-wrap font-source-serif-4 text-sm text-text-secondary">
                {p.content}
              </p>
              <div className="mt-3 flex justify-end">
                <DeletePostButton postId={p.id} clubId={params.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

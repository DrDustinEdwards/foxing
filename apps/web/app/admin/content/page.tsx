import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatRelativeDate } from '@foxing/utils'
import { ReportActions } from './report-actions'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Content reports, Foxing admin',
}

interface ReporterRef {
  username: string
  display_name: string
  avatar_url: string | null
}

interface ReportRow {
  id: string
  post_id: string | null
  post_type: string | null
  reporter_id: string | null
  reason: string
  created_at: string
  status: string
  reporter: ReporterRef | null
}

interface PostRecord {
  id: string
  content: string
  author_id: string | null
  created_at: string | null
  author?: {
    username: string
    display_name: string
  } | null
}

async function fetchPostRecord(
  postId: string,
  postType: string | null,
): Promise<PostRecord | null> {
  const admin = createAdminClient()
  const kind = postType ?? 'club_post'
  if (kind === 'passage_comment') {
    const { data } = await admin
      .from('passage_comments')
      .select(
        'id, content, user_id, created_at, author:user_id(username, display_name)',
      )
      .eq('id', postId)
      .maybeSingle()
    return shape(data, 'content', 'user_id')
  }
  if (kind === 'diary_entry') {
    const { data } = await admin
      .from('diary_entries')
      .select(
        'id, review, user_id, created_at, author:user_id(username, display_name)',
      )
      .eq('id', postId)
      .maybeSingle()
    return shape(data, 'review', 'user_id')
  }
  if (kind === 'highlight') {
    const { data } = await admin
      .from('highlights')
      .select(
        'id, text, user_id, created_at, author:user_id(username, display_name)',
      )
      .eq('id', postId)
      .maybeSingle()
    return shape(data, 'text', 'user_id')
  }
  if (kind === 'review') {
    const { data } = await admin
      .from('user_books')
      .select(
        'id, review, user_id, created_at, author:user_id(username, display_name)',
      )
      .eq('id', postId)
      .maybeSingle()
    return shape(data, 'review', 'user_id')
  }
  // Default: club_post uses author_id, not user_id.
  const { data } = await admin
    .from('club_posts')
    .select(
      'id, content, author_id, created_at, author:author_id(username, display_name)',
    )
    .eq('id', postId)
    .maybeSingle()
  return shape(data, 'content', 'author_id')
}

function shape(
  data: unknown,
  contentField: string,
  authorField: string,
): PostRecord | null {
  if (!data) return null
  const row = data as Record<string, unknown>
  const authorRaw = row.author
  const author = Array.isArray(authorRaw)
    ? ((authorRaw[0] as { username: string; display_name: string } | undefined) ?? null)
    : ((authorRaw as { username: string; display_name: string } | null) ?? null)
  return {
    id: String(row.id ?? ''),
    content: String(row[contentField] ?? ''),
    author_id: (row[authorField] as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    author,
  }
}

export default async function AdminContentPage() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('post_reports')
    .select(
      'id, post_id, post_type, reporter_id, reason, created_at, status, reporter:reporter_id(username, display_name, avatar_url)',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)
  const reports = (data as unknown as ReportRow[] | null) ?? []

  const posts = new Map<string, PostRecord | null>()
  await Promise.all(
    reports.map(async (r) => {
      if (!r.post_id) return
      const post = await fetchPostRecord(r.post_id, r.post_type)
      posts.set(r.id, post)
    }),
  )

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="Content reports"
        subtitle="Pending reports only. Dismissed and actioned reports are kept for audit."
        subtitleVariant="description"
      />

      {reports.length === 0 ? (
        <div className="mt-10">
          <EmptyState heading="Queue is empty." />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {reports.map((r) => {
            const post = posts.get(r.id) ?? null
            return (
              <li
                key={r.id}
                className="rounded-lg border border-border-subtle bg-bg-surface p-4"
              >
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={r.reporter?.avatar_url}
                      name={r.reporter?.display_name ?? 'Reporter'}
                      size="sm"
                    />
                    <div className="flex flex-col leading-tight">
                      <span className="font-dm-sans text-sm text-text-primary">
                        Reported by{' '}
                        {r.reporter?.display_name ?? 'unknown reporter'}
                      </span>
                      <span className="font-dm-mono text-xs text-text-tertiary">
                        {r.reporter?.username
                          ? `@${r.reporter.username}`
                          : 'no profile'}
                        {r.post_type ? ` · type: ${r.post_type}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="font-dm-mono text-xs text-text-tertiary">
                    {formatRelativeDate(r.created_at)}
                  </span>
                </header>

                <div className="mt-3 rounded-md bg-bg-sunken p-3">
                  <p className="font-dm-mono text-xs uppercase tracking-wide text-text-tertiary">
                    Reason
                  </p>
                  <p className="mt-1 font-source-serif-4 text-sm text-text-secondary">
                    {r.reason}
                  </p>
                </div>

                {post ? (
                  <div className="mt-3 rounded-md border border-border-subtle p-3">
                    <p className="font-dm-mono text-xs uppercase tracking-wide text-text-tertiary">
                      {r.post_type ?? 'post'} by{' '}
                      {post.author?.display_name
                        ? `${post.author.display_name} (@${post.author.username})`
                        : 'unknown'}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap font-source-serif-4 text-sm text-text-primary">
                      {post.content}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 font-dm-sans text-sm text-text-tertiary">
                    The reported {r.post_type ?? 'post'} was already deleted.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <ReportActions
                    reportId={r.id}
                    postId={post?.id ?? null}
                    postType={r.post_type}
                    authorId={post?.author_id ?? null}
                    reason={r.reason}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatRelativeDate } from '@foxing/utils'
import { ReportActions } from './report-actions'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Content reports · Admin · Foxing',
}

interface ReportRow {
  id: string
  post_id: string | null
  reporter_id: string | null
  reason: string
  created_at: string
  reporter: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
  post:
    | {
        id: string
        content: string
        author_id: string | null
        created_at: string
        author: {
          username: string
          display_name: string
        } | null
      }
    | null
}

export default async function AdminContentPage() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('post_reports')
    .select(
      'id, post_id, reporter_id, reason, created_at, reporter:reporter_id(username, display_name, avatar_url), post:post_id(id, content, author_id, created_at, author:author_id(username, display_name))',
    )
    .order('created_at', { ascending: false })
    .limit(50)
  const reports = (data as unknown as ReportRow[] | null) ?? []

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Content reports
      </h1>
      <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
        Resolved reports are deleted from the queue.
      </p>

      {reports.length === 0 ? (
        <div className="mt-10">
          <EmptyState heading="Queue is empty." />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {reports.map((r) => (
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

              {r.post ? (
                <div className="mt-3 rounded-md border border-border-subtle p-3">
                  <p className="font-dm-mono text-xs uppercase tracking-wide text-text-tertiary">
                    Post by{' '}
                    {r.post.author?.display_name
                      ? `${r.post.author.display_name} (@${r.post.author.username})`
                      : 'unknown'}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap font-source-serif-4 text-sm text-text-primary">
                    {r.post.content}
                  </p>
                </div>
              ) : (
                <p className="mt-3 font-dm-sans text-sm text-text-tertiary">
                  The reported post was already deleted.
                </p>
              )}

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <ReportActions
                  reportId={r.id}
                  postId={r.post?.id ?? null}
                  authorId={r.post?.author_id ?? null}
                  reason={r.reason}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

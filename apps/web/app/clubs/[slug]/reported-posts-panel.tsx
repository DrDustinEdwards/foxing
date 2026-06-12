'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatRelativeDate } from '@foxing/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  actionReport,
  dismissReport,
  removeClubPost,
} from './actions'

export interface ReportView {
  id: string
  post_id: string
  reason: string
  created_at: string
  post: {
    content: string
    author_name: string
    author_id: string
    has_spoiler: boolean
  }
  reporter_name: string
}

interface Props {
  clubId: string
  reports: ReportView[]
}

export function ReportedPostsPanel({ clubId, reports }: Props) {
  if (reports.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
          Reports
        </h3>
        <p className="font-source-serif-4 text-sm text-text-tertiary">
          No pending reports.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
        Reports ({reports.length})
      </h3>
      <ul className="flex flex-col gap-3">
        {reports.map((r) => (
          <li key={r.id}>
            <ReportRow clubId={clubId} report={r} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ReportRow({
  clubId,
  report,
}: {
  clubId: string
  report: ReportView
}) {
  const router = useRouter()
  const [pending, setPending] = useState<'dismiss' | 'remove' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDismiss() {
    setError(null)
    setPending('dismiss')
    const fd = new FormData()
    fd.set('report_id', report.id)
    fd.set('club_id', clubId)
    const res = await dismissReport(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  async function handleRemove() {
    if (!confirm('Remove this post and mark report as actioned?')) return
    setError(null)
    setPending('remove')
    const removeFd = new FormData()
    removeFd.set('post_id', report.post_id)
    removeFd.set('club_id', clubId)
    removeFd.set('reason', `Removed via report: ${report.reason}`)
    const r1 = await removeClubPost(removeFd)
    if (!r1.ok) {
      setPending(null)
      setError(r1.error)
      return
    }
    const actionFd = new FormData()
    actionFd.set('report_id', report.id)
    actionFd.set('club_id', clubId)
    await actionReport(actionFd)
    setPending(null)
    router.refresh()
  }

  return (
    <article className="rounded-lg border border-border-subtle bg-bg-sunken p-3">
      <p className="line-clamp-3 whitespace-pre-line font-source-serif-4 text-sm text-text-primary">
        {report.post.has_spoiler ? '(Spoiler content hidden)' : report.post.content}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 font-dm-mono text-xs text-text-tertiary">
        <span>By {report.post.author_name}</span>
        <span>· Reported by {report.reporter_name}</span>
        <Badge variant="warning">{report.reason}</Badge>
        <span>· {formatRelativeDate(report.created_at)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          loading={pending === 'dismiss'}
          onClick={handleDismiss}
        >
          Dismiss
        </Button>
        <Button
          variant="danger"
          size="sm"
          loading={pending === 'remove'}
          onClick={handleRemove}
        >
          Remove post
        </Button>
      </div>
      {error && (
        <p className="mt-2 font-dm-sans text-xs text-error">{error}</p>
      )}
    </article>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  reportClubPost,
  removeClubPost,
  saveClubPost,
} from '@/app/clubs/[slug]/actions'
import { ReplyForm } from './reply-form'
import { unsaveOwnClubPost, updateClubPost } from './actions'

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'spoilers', label: 'Spoilers' },
  { value: 'offensive', label: 'Offensive' },
  { value: 'other', label: 'Other' },
]

interface Props {
  postId: string
  threadId: string
  isOwn: boolean
  initialSaved: boolean
  initialContent: string
}

export function ThreadPostActions({
  postId,
  threadId,
  isOwn,
  initialSaved,
  initialContent,
}: Props) {
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [savingPending, setSavingPending] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(initialContent)
  const [reason, setReason] = useState(REPORT_REASONS[0].value)
  const [reportPending, setReportPending] = useState(false)
  const [editPending, setEditPending] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [reportDone, setReportDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSaveToggle() {
    setSavingPending(true)
    const fd = new FormData()
    fd.set('post_id', postId)
    const res = saved
      ? await unsaveOwnClubPost(fd)
      : await saveClubPost(fd)
    setSavingPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSaved(!saved)
  }

  async function handleReport(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setReportPending(true)
    const fd = new FormData()
    fd.set('post_id', postId)
    fd.set('reason', reason)
    const res = await reportClubPost(fd)
    setReportPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setReportDone(true)
    setReportOpen(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setError(null)
    setEditPending(true)
    const fd = new FormData()
    fd.set('post_id', postId)
    fd.set('content', content)
    const res = await updateClubPost(fd)
    setEditPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Delete this post?')) return
    setError(null)
    setDeletePending(true)
    const fd = new FormData()
    fd.set('post_id', postId)
    const res = await removeClubPost(fd)
    setDeletePending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-3 font-dm-mono text-xs text-text-tertiary">
        <button
          type="button"
          onClick={handleSaveToggle}
          disabled={savingPending}
          className="hover:text-text-primary disabled:opacity-50"
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setReplyOpen((v) => !v)}
          className="hover:text-text-primary"
        >
          Reply
        </button>
        <button
          type="button"
          onClick={() => setReportOpen((v) => !v)}
          className="hover:text-error"
        >
          {reportDone ? 'Reported' : 'Report'}
        </button>
        {isOwn && (
          <>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="hover:text-text-primary"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletePending}
              className="hover:text-error disabled:opacity-50"
            >
              Delete
            </button>
          </>
        )}
      </div>

      {error && <p className="font-dm-sans text-xs text-error">{error}</p>}

      {editing && (
        <form onSubmit={handleEdit} className="flex flex-col gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            maxLength={5000}
            className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-base text-text-primary"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={editPending}
              disabled={!content.trim()}
            >
              Save changes
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false)
                setContent(initialContent)
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {reportOpen && (
        <form
          onSubmit={handleReport}
          className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-sunken p-3"
        >
          <label className="font-dm-sans text-sm text-text-secondary">
            Reason
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="ml-2 rounded-md border border-border-interactive bg-bg-surface px-2 py-1 text-text-primary"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={reportPending}
            >
              Submit report
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReportOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {replyOpen && (
        <div className="mt-1 rounded-md border border-border-subtle bg-bg-sunken p-3">
          <ReplyForm
            threadId={threadId}
            parentPostId={postId}
            onDone={() => setReplyOpen(false)}
          />
        </div>
      )}
    </div>
  )
}

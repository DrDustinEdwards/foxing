'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  deleteDiscussionPost,
  updateDiscussionPost,
} from '../../actions'

interface Props {
  postId: string
  content: string
  bookSlug: string
  discussionId: string
}

export function PostEditDeleteButtons({
  postId,
  content,
  bookSlug,
  discussionId,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!draft.trim()) {
      setError('Cannot be empty.')
      return
    }
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('post_id', postId)
    fd.set('book_slug', bookSlug)
    fd.set('discussion_id', discussionId)
    fd.set('content', draft)
    const res = await updateDiscussionPost(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Delete this post?')) return
    setPending(true)
    const fd = new FormData()
    fd.set('post_id', postId)
    fd.set('book_slug', bookSlug)
    fd.set('discussion_id', discussionId)
    await deleteDiscussionPost(fd)
    setPending(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="flex w-full flex-col gap-2">
        <textarea
          aria-label="Edit post"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={5000}
          rows={4}
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
        />
        {error && (
          <p className="font-dm-sans text-xs text-error">{error}</p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={pending}
            onClick={handleSave}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false)
              setDraft(content)
              setError(null)
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 font-dm-mono text-xs">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-text-tertiary hover:text-text-primary"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="text-text-tertiary hover:text-error disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  )
}

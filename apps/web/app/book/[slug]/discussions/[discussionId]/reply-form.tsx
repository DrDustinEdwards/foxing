'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createDiscussionPost } from '../../actions'

interface Props {
  discussionId: string
  bookSlug: string
  parentId?: string | null
  compact?: boolean
}

export function ReplyForm({
  discussionId,
  bookSlug,
  parentId = null,
  compact = false,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(!compact)
  const [content, setContent] = useState('')
  const [hasSpoiler, setHasSpoiler] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!content.trim()) {
      setError('Write a reply.')
      return
    }
    setSaving(true)
    const fd = new FormData()
    fd.set('discussion_id', discussionId)
    fd.set('book_slug', bookSlug)
    if (parentId) fd.set('parent_id', parentId)
    fd.set('content', content)
    if (hasSpoiler) fd.set('has_spoiler', 'on')
    const res = await createDiscussionPost(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setContent('')
    setHasSpoiler(false)
    if (compact) setOpen(false)
    router.refresh()
  }

  if (compact && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 font-dm-sans text-xs text-brand-text hover:underline"
      >
        Reply
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-surface p-3"
    >
      <textarea
        aria-label="Reply"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={5000}
        rows={compact ? 2 : 4}
        placeholder={compact ? 'Write a reply' : 'Join the conversation'}
        className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
      />
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 font-dm-sans text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={hasSpoiler}
            onChange={(e) => setHasSpoiler(e.target.checked)}
          />
          Spoiler
        </label>
        <div className="flex gap-2">
          {compact && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false)
                setContent('')
                setError(null)
              }}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" variant="primary" size="sm" loading={saving}>
            {parentId ? 'Reply' : 'Post'}
          </Button>
        </div>
      </div>
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-xs text-error">
          {error}
        </p>
      )}
    </form>
  )
}

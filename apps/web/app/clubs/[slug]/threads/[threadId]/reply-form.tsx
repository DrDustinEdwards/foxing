'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClubPostReply } from './actions'

export function ReplyForm({
  threadId,
  parentPostId,
  onDone,
}: {
  threadId: string
  parentPostId?: string
  onDone?: () => void
}) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [hasSpoiler, setHasSpoiler] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('thread_id', threadId)
    if (parentPostId) fd.set('parent_post_id', parentPostId)
    fd.set('content', content.trim())
    if (hasSpoiler) fd.set('has_spoiler', 'on')
    const res = await createClubPostReply(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setContent('')
    setHasSpoiler(false)
    onDone?.()
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={5000}
        placeholder="Your reply..."
        className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-base text-text-primary"
      />
      <label className="flex items-center gap-2 font-dm-sans text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={hasSpoiler}
          onChange={(e) => setHasSpoiler(e.target.checked)}
        />
        Contains spoilers
      </label>
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={pending}
          disabled={!content.trim()}
        >
          Post reply
        </Button>
      </div>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClubThread } from './actions'

export function NewThreadForm({
  clubId,
  clubSlug,
}: {
  clubId: string
  clubSlug: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [chapter, setChapter] = useState('')
  const [content, setContent] = useState('')
  const [hasSpoilers, setHasSpoilers] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('club_id', clubId)
    fd.set('title', title.trim())
    if (chapter.trim()) fd.set('chapter', chapter.trim())
    fd.set('content', content.trim())
    if (hasSpoilers) fd.set('has_spoilers', 'on')
    const res = await createClubThread(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.push(`/clubs/${clubSlug}/threads/${res.threadId}`)
  }

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        Start a thread
      </Button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        autoFocus
        placeholder="Thread title"
        aria-label="Thread title"
        className="rounded-md border border-border-interactive bg-bg-base px-3 py-2 font-fraunces text-lg text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none"
      />
      <input
        type="text"
        value={chapter}
        onChange={(e) => setChapter(e.target.value)}
        maxLength={80}
        placeholder="Chapter or section (optional)"
        aria-label="Chapter or section"
        className="rounded-md border border-border-interactive bg-bg-base px-3 py-1.5 font-dm-sans text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        maxLength={5000}
        placeholder="Open the discussion..."
        aria-label="Opening post"
        className="rounded-md border border-border-interactive bg-bg-base px-3 py-2 font-source-serif-4 text-base text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none"
      />
      <label className="flex items-center gap-2 font-dm-sans text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={hasSpoilers}
          onChange={(e) => setHasSpoilers(e.target.checked)}
        />
        Contains spoilers
      </label>
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={pending}
          disabled={!title.trim() || !content.trim()}
        >
          Post thread
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

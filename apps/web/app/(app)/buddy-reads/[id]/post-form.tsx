'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createBuddyReadPost } from '../actions'

export function PostForm({ buddyReadId }: { buddyReadId: string }) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [page, setPage] = useState('')
  const [chapter, setChapter] = useState('')
  const [hasSpoiler, setHasSpoiler] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!content.trim()) {
      setError('Write something to post.')
      return
    }
    setSaving(true)
    const fd = new FormData()
    fd.set('buddy_read_id', buddyReadId)
    fd.set('content', content)
    if (page) fd.set('page_number', page)
    if (chapter) fd.set('chapter', chapter)
    if (hasSpoiler) fd.set('has_spoiler', 'on')
    const res = await createBuddyReadPost(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setContent('')
    setPage('')
    setChapter('')
    setHasSpoiler(false)
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="buddy-content"
          className="font-dm-sans text-sm text-text-secondary"
        >
          What is on your mind?
        </label>
        <textarea
          id="buddy-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={3000}
          rows={3}
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Page you are on"
          type="number"
          min={1}
          value={page}
          onChange={(e) => setPage(e.target.value)}
        />
        <Input
          label="Chapter"
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
          placeholder="e.g. Chapter 12"
        />
      </div>
      <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={hasSpoiler}
          onChange={(e) => setHasSpoiler(e.target.checked)}
        />
        Contains a spoiler
      </label>
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Post
        </Button>
      </div>
    </form>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateCelebrityPick } from './actions'

interface Props {
  pickId: string
  initial: {
    book_title: string
    book_author: string
    curator_quote: string
    official_announcement_url: string
  }
}

export function PickEditor({ pickId, initial }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(initial.book_title)
  const [author, setAuthor] = useState(initial.book_author)
  const [quote, setQuote] = useState(initial.curator_quote)
  const [url, setUrl] = useState(initial.official_announcement_url)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)
    const fd = new FormData()
    fd.set('pick_id', pickId)
    fd.set('book_title', title)
    fd.set('book_author', author)
    fd.set('curator_quote', quote)
    fd.set('official_announcement_url', url)
    const res = await updateCelebrityPick(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error ?? 'Save failed.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <div className="mt-3 flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Edit
        </Button>
        {saved && (
          <span className="font-dm-mono text-xs text-success">Saved</span>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label="Book title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Input
          label="Author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`quote-${pickId}`}
          className="font-dm-sans text-sm text-text-secondary"
        >
          Curator quote
        </label>
        <textarea
          id={`quote-${pickId}`}
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          rows={3}
          maxLength={400}
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
        />
        <span className="font-dm-mono text-xs text-text-tertiary">
          {quote.length} / 400
        </span>
      </div>
      <Input
        label="Announcement URL"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
      />
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

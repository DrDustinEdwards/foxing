'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addManualCelebrityPick } from './actions'

interface Props {
  clubId: string
  clubName: string
  year: number
  month: number
}

export function MissingClubAdd({ clubId, clubName, year, month }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [quote, setQuote] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const fd = new FormData()
    fd.set('club_id', clubId)
    fd.set('book_title', title)
    fd.set('book_author', author)
    fd.set('pick_month', String(month))
    fd.set('pick_year', String(year))
    fd.set('curator_quote', quote)
    fd.set('official_announcement_url', url)
    const res = await addManualCelebrityPick(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error ?? 'Save failed.')
      return
    }
    setOpen(false)
    setTitle('')
    setAuthor('')
    setQuote('')
    setUrl('')
    router.refresh()
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Add pick for {clubName}
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label="Book title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
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
          htmlFor={`add-quote-${clubId}`}
          className="font-dm-sans text-sm text-text-secondary"
        >
          Curator quote
        </label>
        <textarea
          id={`add-quote-${clubId}`}
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          rows={3}
          maxLength={400}
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
        />
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
          Add
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

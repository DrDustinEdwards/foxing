'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { clearAiCache, updateBook } from './actions'

interface BookData {
  id: string
  title: string
  author: string
  description: string | null
  cover_url: string | null
  themes: string[] | null
  reading_difficulty: number | null
  word_count: number | null
}

interface Props {
  book: BookData
  cacheCount: number
}

export function BookEditForm({ book, cacheCount }: Props) {
  const [coverUrl, setCoverUrl] = useState(book.cover_url ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [cacheStatus, setCacheStatus] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    const fd = new FormData(e.currentTarget)
    fd.set('id', book.id)
    await updateBook(fd)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleClear() {
    if (
      !window.confirm(
        'Delete all AI cache entries for this book? Content will regenerate on next request.',
      )
    )
      return
    setClearing(true)
    setCacheStatus(null)
    const fd = new FormData()
    fd.set('id', book.id)
    await clearAiCache(fd)
    setClearing(false)
    setCacheStatus('Cleared. AI content will regenerate on next request.')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input label="Title" name="title" defaultValue={book.title} required />
      <Input label="Author" name="author" defaultValue={book.author} required />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="description"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={book.description ?? ''}
          rows={6}
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_120px]">
        <Input
          label="Cover URL"
          name="cover_url"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="https://..."
        />
        {coverUrl && (
          <div className="flex items-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt="Cover preview"
              className="h-32 w-24 rounded border border-border-subtle object-cover"
            />
          </div>
        )}
      </div>

      <Input
        label="Themes (comma separated)"
        name="themes"
        defaultValue={book.themes?.join(', ') ?? ''}
        hint="Stored as a text array. Used for mood-based browsing."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Reading difficulty"
          type="number"
          name="reading_difficulty"
          defaultValue={book.reading_difficulty ?? ''}
          min={1}
          max={10}
          step={0.1}
        />
        <Input
          label="Word count"
          type="number"
          name="word_count"
          defaultValue={book.word_count ?? ''}
          min={0}
          step={1}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" loading={saving}>
            Save changes
          </Button>
          {saved && (
            <span className="font-dm-mono text-xs text-success">Saved</span>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleClear}
          loading={clearing}
        >
          Clear AI cache ({cacheCount})
        </Button>
      </div>
      {cacheStatus && (
        <p className="font-dm-mono text-xs text-text-tertiary">{cacheStatus}</p>
      )}
    </form>
  )
}

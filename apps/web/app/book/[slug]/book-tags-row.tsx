'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { addBookTag, removeBookTag } from './actions'

interface Props {
  bookId: string
  bookSlug: string | null
  initialTags: string[]
}

export function BookTagsRow({ bookId, bookSlug, initialTags }: Props) {
  const router = useRouter()
  const [tags, setTags] = useState(initialTags)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function normalizeLocal(raw: string): string {
    return raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 30)
  }

  async function addTag(rawValue: string) {
    const normalized = normalizeLocal(rawValue)
    if (!normalized) return
    if (tags.includes(normalized)) {
      setDraft('')
      return
    }
    if (tags.length >= 20) {
      setError('Up to 20 tags per book.')
      return
    }
    setError(null)
    setPending(normalized)
    const fd = new FormData()
    fd.set('book_id', bookId)
    if (bookSlug) fd.set('book_slug', bookSlug)
    fd.set('tag', normalized)
    const res = await addBookTag(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setTags((prev) => [...prev, normalized])
    setDraft('')
    router.refresh()
  }

  async function handleRemove(tag: string) {
    setError(null)
    setPending(tag)
    const fd = new FormData()
    fd.set('book_id', bookId)
    if (bookSlug) fd.set('book_slug', bookSlug)
    fd.set('tag', tag)
    const res = await removeBookTag(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setTags((prev) => prev.filter((t) => t !== tag))
    router.refresh()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(draft)
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      const last = tags[tags.length - 1]
      handleRemove(last)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        Your tags
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-bg-sunken px-2 py-0.5 font-dm-mono text-xs text-text-secondary"
          >
            {t}
            <button
              type="button"
              onClick={() => handleRemove(t)}
              disabled={pending === t}
              aria-label={`Remove ${t}`}
              className="text-text-tertiary hover:text-error disabled:opacity-50"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a tag..."
          maxLength={30}
          className="min-w-[8rem] flex-1 rounded-md border border-border-subtle bg-bg-surface px-2 py-1 font-dm-mono text-xs text-text-primary"
        />
      </div>
      {error && (
        <p className="font-dm-sans text-xs text-error">{error}</p>
      )}
    </div>
  )
}

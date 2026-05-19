'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DISCUSSION_TYPES, type DiscussionType } from '@/lib/discussion-types'
import { createDiscussion } from './actions'

interface Props {
  bookId: string
  bookSlug: string | null
}

export function CreateDiscussionForm({ bookId, bookSlug }: Props) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<DiscussionType>('general')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const fd = new FormData(e.currentTarget)
    fd.set('book_id', bookId)
    fd.set('type', type)
    if (bookSlug) fd.set('book_slug', bookSlug)
    try {
      await createDiscussion(fd)
    } catch (err) {
      setSubmitting(false)
      setError(err instanceof Error ? err.message : 'Could not start.')
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Start a discussion
      </Button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex w-full flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
    >
      <Input label="Title" name="title" maxLength={120} required />
      <fieldset className="flex flex-col gap-2">
        <legend className="font-dm-sans text-sm text-text-secondary">
          Type
        </legend>
        <div className="grid grid-cols-2 gap-1 font-dm-sans text-sm text-text-secondary sm:grid-cols-3">
          {DISCUSSION_TYPES.map((t) => (
            <label key={t.value} className="flex items-center gap-2">
              <input
                type="radio"
                name="_type"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Input
        label="Chapter gate (optional)"
        name="chapter_gate"
        placeholder="e.g. Readers past Chapter 12 only"
      />
      <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
        <input type="checkbox" name="spoiler_tagged" />
        Contains spoilers
      </label>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="discussion-first-post"
          className="font-dm-sans text-sm text-text-secondary"
        >
          First post
        </label>
        <textarea
          id="discussion-first-post"
          name="first_post"
          maxLength={5000}
          rows={4}
          required
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
        />
      </div>
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" loading={submitting}>
          Start discussion
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

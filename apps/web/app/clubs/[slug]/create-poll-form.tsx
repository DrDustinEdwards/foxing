'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClubPoll } from './actions'

interface OptionDraft {
  label: string
  bookId: string
}

export function CreatePollForm({ clubId }: { clubId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pollType, setPollType] = useState<'single' | 'ranked'>('single')
  const [options, setOptions] = useState<OptionDraft[]>([
    { label: '', bookId: '' },
    { label: '', bookId: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addOption() {
    if (options.length >= 8) return
    setOptions((prev) => [...prev, { label: '', bookId: '' }])
  }
  function removeOption(idx: number) {
    setOptions((prev) =>
      prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx),
    )
  }
  function updateOption(idx: number, patch: Partial<OptionDraft>) {
    setOptions((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const validOptions = options.filter((o) => o.label.trim().length > 0)
    if (validOptions.length < 2) {
      setError('Add at least 2 options.')
      return
    }
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    fd.set('club_id', clubId)
    fd.set('poll_type', pollType)
    fd.delete('option_label[]')
    fd.delete('option_book_id[]')
    for (const o of validOptions) {
      fd.append('option_label[]', o.label.trim())
      fd.append('option_book_id[]', o.bookId.trim())
    }
    const res = await createClubPoll(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setOpen(false)
    setOptions([
      { label: '', bookId: '' },
      { label: '', bookId: '' },
    ])
    router.refresh()
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Create a poll
      </Button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
    >
      <h3 className="font-fraunces text-lg text-text-primary">New poll</h3>
      <Input label="Question" name="title" maxLength={120} required />
      <fieldset className="flex flex-col gap-2">
        <legend className="font-dm-sans text-sm text-text-secondary">
          Poll type
        </legend>
        <div className="flex flex-wrap gap-3 font-dm-sans text-sm text-text-secondary">
          {(['single', 'ranked'] as const).map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input
                type="radio"
                name="_poll_type"
                value={t}
                checked={pollType === t}
                onChange={() => setPollType(t)}
              />
              {t === 'single' ? 'Single choice' : 'Ranked choice'}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <p className="font-dm-sans text-sm text-text-secondary">
          Options ({options.length})
        </p>
        {options.map((o, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                label={`Option ${i + 1}`}
                value={o.label}
                onChange={(e) => updateOption(i, { label: e.target.value })}
                placeholder="Book title or option text"
                required={i < 2}
              />
              <input
                type="text"
                value={o.bookId}
                onChange={(e) => updateOption(i, { bookId: e.target.value })}
                placeholder="Optional book UUID"
                className="mt-1.5 w-full rounded-md border border-border-default bg-bg-surface px-3 py-1.5 font-dm-mono text-xs text-text-primary"
              />
            </div>
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="mt-7 font-dm-sans text-xs text-text-tertiary hover:text-error"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {options.length < 8 && (
          <button
            type="button"
            onClick={addOption}
            className="self-start font-dm-sans text-sm text-brand-text hover:underline"
          >
            Add option
          </button>
        )}
      </div>
      <Input
        label="Closes at (optional)"
        type="datetime-local"
        name="closes_at"
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="poll-description"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Description (optional)
        </label>
        <textarea
          id="poll-description"
          name="description"
          maxLength={2000}
          rows={3}
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
        />
      </div>
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Create poll
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

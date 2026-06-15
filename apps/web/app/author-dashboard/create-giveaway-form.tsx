'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { createGiveaway } from '@/app/giveaways/actions'

export function CreateGiveawayForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [bookId, setBookId] = useState('')
  const [kind, setKind] = useState<'digital' | 'physical'>('digital')
  const [prizeCount, setPrizeCount] = useState('1')
  const [deadline, setDeadline] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState(false)

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Create giveaway
      </Button>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('title', title)
    if (description) fd.set('description', description)
    if (bookId) fd.set('book_id', bookId)
    fd.set('kind', kind)
    fd.set('prize_count', prizeCount)
    fd.set('deadline', deadline)
    const res = await createGiveaway(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setCreated(true)
    setTitle('')
    setDescription('')
    setBookId('')
    setPrizeCount('1')
    setDeadline('')
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
    >
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        required
      />
      <Input
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={2000}
      />
      <Input
        label="Book ID (optional)"
        value={bookId}
        onChange={(e) => setBookId(e.target.value)}
        placeholder="UUID of the book being given away"
      />
      <label className="flex flex-col gap-1 font-dm-sans text-sm text-text-secondary">
        Kind
        <Select
          value={kind}
          onChange={(v) => setKind(v as 'digital' | 'physical')}
          size="sm"
          options={[
            { value: 'digital', label: 'Digital' },
            { value: 'physical', label: 'Physical' },
          ]}
        />
      </label>
      <Input
        label="Prize count"
        type="number"
        min={1}
        max={100}
        value={prizeCount}
        onChange={(e) => setPrizeCount(e.target.value)}
      />
      <Input
        label="Deadline"
        type="datetime-local"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
        required
      />
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      {created && (
        <p className="font-dm-sans text-xs text-success">Giveaway created.</p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={pending}
          disabled={!title.trim() || !deadline}
        >
          Create
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

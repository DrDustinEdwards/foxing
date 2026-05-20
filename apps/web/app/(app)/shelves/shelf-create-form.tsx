'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createShelf } from './actions'

export function ShelfCreateForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('name', name)
    if (description) fd.set('description', description)
    if (isPublic) fd.set('is_public', 'on')
    const res = await createShelf(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setName('')
    setDescription('')
    setIsPublic(false)
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
    >
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Russian winter reads"
        maxLength={60}
        required
      />
      <Input
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What ties these books together?"
        maxLength={280}
      />
      <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        Make this shelf public on my profile
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
          disabled={!name.trim()}
        >
          Create shelf
        </Button>
      </div>
    </form>
  )
}

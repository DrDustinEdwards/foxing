'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteShelf, updateShelf } from '../actions'

interface Props {
  shelf: {
    id: string
    name: string
    description: string | null
    is_public: boolean
  }
}

export function ShelfEditPanel({ shelf }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(shelf.name)
  const [description, setDescription] = useState(shelf.description ?? '')
  const [isPublic, setIsPublic] = useState(shelf.is_public)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('shelf_id', shelf.id)
    fd.set('name', name.trim())
    if (description.trim()) fd.set('description', description.trim())
    if (isPublic) fd.set('is_public', 'on')
    const res = await updateShelf(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm(`Delete the shelf "${shelf.name}"?`)) return
    setPending(true)
    const fd = new FormData()
    fd.set('shelf_id', shelf.id)
    const res = await deleteShelf(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.push('/shelves')
    router.refresh()
  }

  if (!editing) {
    return (
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-dm-sans text-sm text-brand-text hover:underline"
        >
          Edit shelf
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="font-dm-sans text-sm text-text-tertiary hover:text-error disabled:opacity-50"
        >
          Delete shelf
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSave}
      className="mt-4 flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
    >
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        required
      />
      <Input
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={280}
      />
      <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        Public on my profile
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
          disabled={!name.trim()}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setName(shelf.name)
            setDescription(shelf.description ?? '')
            setIsPublic(shelf.is_public)
            setEditing(false)
            setError(null)
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

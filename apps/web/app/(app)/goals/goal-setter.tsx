'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteReadingGoal, setReadingGoal } from './actions'

interface Props {
  currentTarget: number | null
  year: number
}

export function GoalSetter({ currentTarget, year }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(currentTarget === null)
  const [target, setTarget] = useState(
    currentTarget ? String(currentTarget) : '',
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const n = Number(target)
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      setError('Enter a number between 1 and 365.')
      return
    }
    setPending(true)
    const fd = new FormData()
    fd.set('target', String(n))
    const res = await setReadingGoal(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  async function handleRemove() {
    if (!confirm(`Remove your ${year} reading goal?`)) return
    setPending(true)
    const res = await deleteReadingGoal()
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setTarget('')
    setEditing(true)
    router.refresh()
  }

  if (!editing && currentTarget !== null) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-dm-sans text-sm text-brand-text hover:underline"
        >
          Edit goal
        </button>
        <button
          type="button"
          onClick={handleRemove}
          disabled={pending}
          className="font-dm-sans text-sm text-text-tertiary hover:text-error disabled:opacity-50"
        >
          Remove goal
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3">
      <p className="font-source-serif-4 text-base text-text-secondary">
        {currentTarget === null
          ? `Set your reading goal for ${year}.`
          : `Update your ${year} goal.`}
      </p>
      <div className="flex items-end gap-3">
        <div className="w-32">
          <Input
            label="Books"
            type="number"
            min={1}
            max={365}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={pending}
          disabled={!target}
        >
          {currentTarget === null ? 'Set goal' : 'Update goal'}
        </Button>
        {currentTarget !== null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false)
              setTarget(String(currentTarget))
              setError(null)
            }}
          >
            Cancel
          </Button>
        )}
      </div>
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
    </form>
  )
}

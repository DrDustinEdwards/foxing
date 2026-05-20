'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  deleteMonthlyGoal,
  deleteWeeklyGoal,
  setMonthlyGoal,
  setWeeklyGoal,
} from './actions'

interface Props {
  period: 'monthly' | 'weekly'
  currentTarget: number | null
  periodLabel: string
}

const MAX: Record<Props['period'], number> = {
  monthly: 50,
  weekly: 14,
}

export function PeriodGoalSetter({
  period,
  currentTarget,
  periodLabel,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(currentTarget === null)
  const [target, setTarget] = useState(
    currentTarget ? String(currentTarget) : '',
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const max = MAX[period]
  const setFn = period === 'monthly' ? setMonthlyGoal : setWeeklyGoal
  const delFn = period === 'monthly' ? deleteMonthlyGoal : deleteWeeklyGoal

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const n = Number(target)
    if (!Number.isInteger(n) || n < 1 || n > max) {
      setError(`Enter a number between 1 and ${max}.`)
      return
    }
    setPending(true)
    const fd = new FormData()
    fd.set('target', String(n))
    const res = await setFn(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  async function handleRemove() {
    if (!confirm(`Remove your ${periodLabel} goal?`)) return
    setPending(true)
    const res = await delFn()
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
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-dm-sans text-sm text-brand-text hover:underline"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleRemove}
          disabled={pending}
          className="font-dm-sans text-sm text-text-tertiary hover:text-error disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="mt-3 flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="w-28">
          <Input
            label="Books"
            type="number"
            min={1}
            max={max}
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
          {currentTarget === null ? 'Set' : 'Update'}
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

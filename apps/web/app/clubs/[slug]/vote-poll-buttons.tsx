'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { voteOnPoll } from './actions'

interface OptionView {
  id: string
  label: string
}

export function SingleChoiceVote({
  pollId,
  clubId,
  options,
  currentOptionId,
  disabled,
}: {
  pollId: string
  clubId: string
  options: OptionView[]
  currentOptionId: string | null
  disabled: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(currentOptionId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) {
      setError('Choose an option.')
      return
    }
    setError(null)
    setSaving(true)
    const fd = new FormData()
    fd.set('poll_id', pollId)
    fd.set('club_id', clubId)
    fd.set('option_id', selected)
    const res = await voteOnPoll(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5 font-dm-sans text-sm text-text-primary">
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-2">
            <input
              type="radio"
              name="option"
              value={o.id}
              checked={selected === o.id}
              onChange={() => setSelected(o.id)}
              disabled={disabled}
            />
            {o.label}
          </label>
        ))}
      </div>
      {error && (
        <p className="font-dm-sans text-xs text-error">{error}</p>
      )}
      <div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={saving}
          disabled={disabled || !selected || selected === currentOptionId}
        >
          {currentOptionId ? 'Change vote' : 'Submit vote'}
        </Button>
      </div>
    </form>
  )
}

export function RankedChoiceVote({
  pollId,
  clubId,
  options,
  currentRanks,
  disabled,
}: {
  pollId: string
  clubId: string
  options: OptionView[]
  currentRanks: Map<string, number>
  disabled: boolean
}) {
  const router = useRouter()
  const initial: Record<string, number | ''> = Object.fromEntries(
    options.map((o) => [o.id, currentRanks.get(o.id) ?? '']),
  )
  const [ranks, setRanks] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const entries = options
      .map((o) => ({ id: o.id, rank: ranks[o.id] }))
      .filter((x) => typeof x.rank === 'number' && x.rank > 0)
    if (entries.length === 0) {
      setError('Rank at least one option.')
      return
    }
    setError(null)
    setSaving(true)
    const fd = new FormData()
    fd.set('poll_id', pollId)
    fd.set('club_id', clubId)
    for (const e2 of entries) {
      fd.append('ranked_option_id[]', e2.id)
      fd.append('ranked_rank[]', String(e2.rank))
    }
    const res = await voteOnPoll(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        {options.map((o) => (
          <div key={o.id} className="flex items-center gap-3">
            <select
              value={ranks[o.id]}
              onChange={(e) => {
                const v = e.target.value
                setRanks((prev) => ({
                  ...prev,
                  [o.id]: v === '' ? '' : Number(v),
                }))
              }}
              disabled={disabled}
              className={cn(
                'rounded-md border border-border-default bg-bg-surface px-2 py-1 font-dm-mono text-xs text-text-primary',
                'disabled:opacity-50',
              )}
            >
              <option value="">Skip</option>
              {options.map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <span className="font-dm-sans text-sm text-text-primary">
              {o.label}
            </span>
          </div>
        ))}
      </div>
      {error && (
        <p className="font-dm-sans text-xs text-error">{error}</p>
      )}
      <div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={saving}
          disabled={disabled}
        >
          Submit ranking
        </Button>
      </div>
    </form>
  )
}

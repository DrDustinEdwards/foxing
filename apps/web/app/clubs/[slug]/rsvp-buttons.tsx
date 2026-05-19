'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { rsvpToMeeting } from './actions'
import type { RsvpStatus } from '@/lib/club-meetings'

const OPTIONS: Array<{ value: RsvpStatus; label: string }> = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_going', label: "Can't make it" },
]

export function RsvpButtons({
  meetingId,
  current,
}: {
  meetingId: string
  current: RsvpStatus | null
}) {
  const router = useRouter()
  const [pending, setPending] = useState<RsvpStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useState<RsvpStatus | null>(current)

  async function handleClick(status: RsvpStatus) {
    setError(null)
    setPending(status)
    setOptimistic(status)
    const fd = new FormData()
    fd.set('meeting_id', meetingId)
    fd.set('status', status)
    const res = await rsvpToMeeting(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error)
      setOptimistic(current)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const active = optimistic === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleClick(opt.value)}
              disabled={pending !== null}
              className={cn(
                'rounded-md border px-3 py-1.5 font-dm-sans text-xs transition-colors disabled:opacity-50',
                active
                  ? 'border-brand-ui bg-brand-subtle text-brand-subtle-text'
                  : 'border-border-default bg-bg-surface text-text-secondary hover:border-border-interactive',
              )}
            >
              {pending === opt.value ? '...' : opt.label}
            </button>
          )
        })}
      </div>
      {error && (
        <p className="font-dm-sans text-xs text-error">{error}</p>
      )}
    </div>
  )
}

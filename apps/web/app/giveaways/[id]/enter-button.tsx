'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { enterGiveaway } from '../actions'

interface Props {
  giveawayId: string
  disabled: boolean
  alreadyEntered: boolean
}

export function EnterGiveawayButton({
  giveawayId,
  disabled,
  alreadyEntered,
}: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entered, setEntered] = useState(alreadyEntered)

  async function handleEnter() {
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('giveaway_id', giveawayId)
    const res = await enterGiveaway(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setEntered(true)
    router.refresh()
  }

  if (entered) {
    return (
      <span className="rounded-full bg-success-bg px-3 py-1 font-dm-sans text-sm text-success">
        You are entered
      </span>
    )
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="primary"
        size="sm"
        loading={pending}
        disabled={disabled}
        onClick={handleEnter}
      >
        Enter giveaway
      </Button>
      {error && (
        <p className="font-dm-sans text-xs text-error">{error}</p>
      )}
    </div>
  )
}

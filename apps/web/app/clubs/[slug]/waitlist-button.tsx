'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { joinWaitlist, leaveWaitlist } from './actions'

export function WaitlistButton({
  clubId,
  onWaitlist,
}: {
  clubId: string
  onWaitlist: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('club_id', clubId)
    const res = onWaitlist ? await leaveWaitlist(fd) : await joinWaitlist(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={onWaitlist ? 'ghost' : 'primary'}
        size="md"
        loading={pending}
        onClick={handleClick}
      >
        {onWaitlist ? 'On waitlist · Leave' : 'Join waitlist'}
      </Button>
      {error && (
        <p className="font-dm-sans text-xs text-error">{error}</p>
      )}
    </div>
  )
}

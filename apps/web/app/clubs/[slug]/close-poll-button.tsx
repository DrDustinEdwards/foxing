'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { closePoll } from './actions'

export function ClosePollButton({
  pollId,
  clubId,
}: {
  pollId: string
  clubId: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={async () => {
        if (!confirm('Close this poll?')) return
        setPending(true)
        const fd = new FormData()
        fd.set('poll_id', pollId)
        fd.set('club_id', clubId)
        await closePoll(fd)
        setPending(false)
        router.refresh()
      }}
    >
      Close poll
    </Button>
  )
}

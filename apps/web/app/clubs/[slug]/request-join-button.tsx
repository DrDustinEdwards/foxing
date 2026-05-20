'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { requestToJoinClub } from './actions'

interface Props {
  clubId: string
  alreadyPending: boolean
}

export function RequestJoinButton({ clubId, alreadyPending }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [requested, setRequested] = useState(alreadyPending)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('club_id', clubId)
    const res = await requestToJoinClub(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setRequested(true)
    router.refresh()
  }

  if (requested) {
    return (
      <span className="inline-flex items-center rounded-md border border-border-subtle bg-bg-sunken px-3 py-2 font-dm-sans text-sm text-text-secondary">
        Request sent. Pending approval.
      </span>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="primary"
        size="md"
        loading={pending}
        onClick={handleClick}
      >
        Request to join
      </Button>
      {error && <p className="font-dm-sans text-xs text-error">{error}</p>}
    </div>
  )
}

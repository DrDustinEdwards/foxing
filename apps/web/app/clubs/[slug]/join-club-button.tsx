'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { joinClub } from './actions'

export function JoinClubButton({ clubId }: { clubId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('club_id', clubId)
    const res = await joinClub(fd)
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
        variant="primary"
        size="md"
        loading={pending}
        onClick={handleClick}
      >
        Join this club
      </Button>
      {error && <p className="font-dm-sans text-xs text-error">{error}</p>}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { leaveClub } from './actions'

export function LeaveClubButton({ clubId }: { clubId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (!confirm('Leave this club?')) return
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('club_id', clubId)
    const res = await leaveClub(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={pending}
        onClick={handleClick}
      >
        Leave club
      </Button>
      {error && <p className="font-dm-sans text-xs text-error">{error}</p>}
    </div>
  )
}

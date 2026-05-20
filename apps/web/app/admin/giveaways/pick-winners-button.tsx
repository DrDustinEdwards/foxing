'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { pickGiveawayWinners } from '@/app/giveaways/actions'

export function PickWinnersButton({ giveawayId }: { giveawayId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePick() {
    if (!confirm('Pick winners now? This cannot be undone.')) return
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('giveaway_id', giveawayId)
    const res = await pickGiveawayWinners(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="primary"
        size="sm"
        loading={pending}
        onClick={handlePick}
      >
        Pick winners
      </Button>
      {error && <p className="font-dm-sans text-xs text-error">{error}</p>}
    </div>
  )
}

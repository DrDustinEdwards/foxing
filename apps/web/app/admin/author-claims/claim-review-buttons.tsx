'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { reviewAuthorClaim } from '@/app/(app)/settings/author-claim-actions'

export function ClaimReviewButtons({ claimId }: { claimId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState<'verified' | 'rejected' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function review(decision: 'verified' | 'rejected') {
    setError(null)
    setPending(decision)
    const fd = new FormData()
    fd.set('claim_id', claimId)
    fd.set('decision', decision)
    const res = await reviewAuthorClaim(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={pending === 'verified'}
          onClick={() => review('verified')}
        >
          Verify
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={pending === 'rejected'}
          onClick={() => review('rejected')}
        >
          Reject
        </Button>
      </div>
      {error && (
        <p className="font-dm-sans text-xs text-error">{error}</p>
      )}
    </div>
  )
}
